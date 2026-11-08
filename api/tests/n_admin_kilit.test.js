// Bildschirmsperre (v1.18): serverseitiger Zustand, 423 waehrend gesperrt,
// 15-min-Inaktivitaet, Entsperren mit Passwort, Fehlversuche begrenzt/protokolliert.
const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { adminApi, adminGiris, testAdminPw, q, pool } = require('./_hilfe');
test.after(() => pool.end());

test('Bildschirmsperre: manuell, Inaktivitaet, Entsperren, 5 Fehlversuche', async () => {
  const token = await adminGiris();
  const sid = jwt.decode(token).sid;
  let r = await adminApi('POST', '/kilitle', { token, body: { sebep: 'manuel' } });
  assert.strictEqual(r.status, 200);
  r = await adminApi('GET', '/dashboard/stats', { token });
  assert.strictEqual(r.status, 423, 'Daten verweigert, solange gesperrt');
  r = await adminApi('GET', '/ben', { token });
  assert.strictEqual(r.body.kilitli, true, 'Zustand uebersteht Neuladen (/ben)');
  r = await adminApi('POST', '/kilit-ac', { token, body: { password: 'falsch' } });
  assert.strictEqual(r.status, 403); assert.match(r.body.hata, /1\/5/);
  const au = (await q("SELECT ip_adresi FROM audit_log WHERE olay='admin.kilit_ac_hata' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.ok(au?.ip_adresi, 'Fehlversuch mit IP protokolliert');
  r = await adminApi('POST', '/kilit-ac', { token, body: { password: testAdminPw() } });
  assert.strictEqual(r.status, 200);
  r = await adminApi('GET', '/dashboard/stats', { token });
  assert.strictEqual(r.status, 200, 'nach Entsperren wieder Daten');

  // Hintergrundabruf zaehlt nicht als Aktivitaet
  await q("UPDATE admin_oturumlar SET son_aktivite=NOW()-interval '10 minutes' WHERE id=$1", [sid]);
  await adminApi('GET', '/sidebar-sayac', { token, headers: { 'X-Kp-Arka': '1' } });
  const sa = (await q('SELECT extract(epoch from now()-son_aktivite) s FROM admin_oturumlar WHERE id=$1', [sid])).rows[0].s;
  assert.ok(sa > 500, 'X-Kp-Arka verlaengert nicht');

  // 16 Minuten ohne Aktivitaet -> gesperrt
  await q("UPDATE admin_oturumlar SET son_aktivite=NOW()-interval '16 minutes' WHERE id=$1", [sid]);
  r = await adminApi('GET', '/dashboard/stats', { token });
  assert.strictEqual(r.status, 423, 'nach 15 min gesperrt');
  const k = (await q("SELECT detay FROM audit_log WHERE olay='admin.kilit' ORDER BY id DESC LIMIT 1")).rows[0];
  assert.strictEqual(k.detay.sebep, 'zaman_asimi');

  // 5 Fehlversuche (Zaehler wurde beim Entsperren zurueckgesetzt) -> Sitzung zu
  for (let i = 1; i <= 4; i++) {
    r = await adminApi('POST', '/kilit-ac', { token, body: { password: 'falsch' + i } });
    assert.strictEqual(r.status, 403);
  }
  r = await adminApi('POST', '/kilit-ac', { token, body: { password: 'falsch5' } });
  assert.strictEqual(r.status, 401); assert.strictEqual(r.body.cikis, true);
  const o = (await q('SELECT kapandi_at FROM admin_oturumlar WHERE id=$1', [sid])).rows[0];
  assert.ok(o.kapandi_at, 'Sitzung nach 5 Fehlern geschlossen');
});
