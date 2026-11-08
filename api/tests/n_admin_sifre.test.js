// Admin „Şifremi unuttum“ (v1.19): neutrale Antwort, Token gehasht, 30 min, einmal
// nutzbar, Mindestregeln, Sitzungen werden geschlossen, audit_log.
// Das Passwort des Test-Admins wird am Ende wiederhergestellt (alter Hash).
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { adminApi, adminGiris, q, pool, TEST_ADMIN_EMAIL } = require('./_hilfe');
test.after(() => pool.end());

test('Şifremi unuttum: neutral, Token einmalig, Regeln, Sitzungen zu', async () => {
  const admin = (await q('SELECT id, password_hash FROM admin_users WHERE email=$1 AND test_verisi=true', [TEST_ADMIN_EMAIL])).rows[0];
  assert.ok(admin, 'Test-Admin vorhanden');
  try {
    const unbekannt = await adminApi('POST', '/sifre-unuttum', { body: { email: 'gibt-es-nicht-' + Date.now() + '@test.kapbeni.com' } });
    const bekannt = await adminApi('POST', '/sifre-unuttum', { body: { email: TEST_ADMIN_EMAIL } });
    assert.strictEqual(unbekannt.status, 200); assert.strictEqual(bekannt.status, 200);
    assert.strictEqual(unbekannt.body.mesaj, bekannt.body.mesaj, 'Antwort verraet nicht, ob das Konto existiert');
    assert.ok(['log', 'smtp', 'resend'].includes(bekannt.body.mail_kanali));
    const row = (await q("SELECT token_hash, extract(epoch from expires_at-created_at) s FROM admin_sifre_sifirlama WHERE admin_id=$1 ORDER BY id DESC LIMIT 1", [admin.id])).rows[0];
    assert.match(row.token_hash, /^[0-9a-f]{64}$/, 'nur Hash gespeichert');
    assert.ok(Math.abs(row.s - 1800) < 5, '30 Minuten gueltig');
    const au = (await q("SELECT detay, ip_adresi FROM audit_log WHERE olay='admin.sifre_unuttum' ORDER BY id DESC LIMIT 2")).rows;
    assert.ok(au.length === 2 && au.every((a) => a.ip_adresi), 'beide Anfragen im audit_log mit IP');

    // Eigener Token (bekannter Klartext) fuer den Ablauf
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await q("INSERT INTO admin_sifre_sifirlama(admin_id,token_hash,expires_at) VALUES($1,$2,NOW()+interval '30 minutes')", [admin.id, hash]);
    let r = await adminApi('GET', '/sifre-yenile/kontrol?t=' + token);
    assert.strictEqual(r.body.gecerli, true);
    r = await adminApi('POST', '/sifre-yenile', { body: { token, password: 'kurz1A' } });
    assert.strictEqual(r.status, 400, 'Mindestregeln');
    const sessionToken = await adminGiris();
    const neu = 'Yeni' + crypto.randomBytes(6).toString('hex') + '9Q';
    r = await adminApi('POST', '/sifre-yenile', { body: { token, password: neu } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    r = await adminApi('POST', '/sifre-yenile', { body: { token, password: neu } });
    assert.strictEqual(r.status, 400, 'einmal nutzbar');
    r = await adminApi('GET', '/ben', { token: sessionToken });
    assert.strictEqual(r.status, 401, 'offene Sitzungen nach Passwortwechsel geschlossen');
    r = await adminApi('POST', '/giris', { body: { email: TEST_ADMIN_EMAIL, password: neu } });
    assert.strictEqual(r.status, 200, 'Anmeldung mit neuem Passwort');

    // Abgelaufener Token
    const alt = crypto.randomBytes(32).toString('base64url');
    await q("INSERT INTO admin_sifre_sifirlama(admin_id,token_hash,expires_at) VALUES($1,$2,NOW()-interval '1 minute')",
      [admin.id, crypto.createHash('sha256').update(alt).digest('hex')]);
    r = await adminApi('POST', '/sifre-yenile', { body: { token: alt, password: neu + 'x' } });
    assert.strictEqual(r.status, 400, 'abgelaufen');
  } finally {
    await q('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [admin.password_hash, admin.id]);
    await q('DELETE FROM admin_sifre_sifirlama WHERE admin_id=$1', [admin.id]);
  }
});
