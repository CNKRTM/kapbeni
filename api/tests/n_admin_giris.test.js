// Admin-Login (v1.17): Sitzungen in admin_oturumlar, IP-Protokoll, /ben, /cikis,
// alte Tokens ohne Sitzung werden abgewiesen. Nur das Test-Admin-Konto.
require('dotenv').config({ path: '/etc/kapbeni.env' });
const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { adminApi, adminGiris, q, pool, TEST_ADMIN_EMAIL } = require('./_hilfe');
test.after(() => pool.end());

test('Admin-Login: Fehlversuch protokolliert, Sitzung, Abmelden', async () => {
  const cfg = await adminApi('GET', '/giris-yapilandirma');
  assert.strictEqual(cfg.status, 200);
  assert.match(cfg.body.version, /^\d+\.\d+\.\d+$/);
  assert.strictEqual(cfg.body.google.aktif, false, 'Google ohne Konfiguration inaktiv');
  assert.ok(!JSON.stringify(cfg.body).match(/secret/i), 'keine Geheimnisse');

  const vorher = (await q("SELECT max(id) m FROM audit_log")).rows[0].m || 0;
  const f = await adminApi('POST', '/giris', { body: { email: TEST_ADMIN_EMAIL, password: 'falsch-' + Date.now() } });
  assert.strictEqual(f.status, 401);
  const au = (await q("SELECT olay, ip_adresi FROM audit_log WHERE id>$1 AND olay='admin.giris_hata' ORDER BY id DESC LIMIT 1", [vorher])).rows[0];
  assert.ok(au && au.ip_adresi, 'Fehlversuch mit IP im audit_log');

  const token = await adminGiris();
  const d = jwt.decode(token);
  assert.ok(d.sid, 'Token traegt sid');
  const o = (await q('SELECT * FROM admin_oturumlar WHERE id=$1', [d.sid])).rows[0];
  assert.ok(o && !o.kapandi_at && o.ip);
  let r = await adminApi('GET', '/ben', { token });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.admin.email, TEST_ADMIN_EMAIL); assert.strictEqual(r.body.kilitli, false);

  // Token ohne sid (altes Format) wird abgewiesen
  const alt = jwt.sign({ id: d.id, email: d.email, rol: d.rol, kaynak: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  r = await adminApi('GET', '/dashboard/stats', { token: alt });
  assert.strictEqual(r.status, 401);

  r = await adminApi('POST', '/cikis', { token });
  assert.strictEqual(r.status, 200);
  r = await adminApi('GET', '/ben', { token });
  assert.strictEqual(r.status, 401, 'nach Abmelden ungueltig');
});
