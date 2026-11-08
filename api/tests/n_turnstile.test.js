// Turnstile (v1.20): Standard test (blockiert nichts), live mit falschem Schluessel
// blockiert Kunden- und Admin-Login, disabled zeigt nichts. Zustand am Ende wie vorher.
// Die API liest die Einstellung mit 10 s Zwischenspeicher -> Wartezeiten.
const test = require('node:test');
const assert = require('node:assert');
const { api, adminApi, adminGiris, q, pool, TEST_ADMIN_EMAIL } = require('./_hilfe');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
test.after(() => pool.end());

test('Turnstile: test / live / disabled', async (t) => {
  const vorher = (await q("SELECT 1 FROM entegrasyon_ayarlari WHERE provider='turnstile'")).rows.length;
  if (vorher) return t.skip('Turnstile ist konfiguriert — Test aendert nichts');
  const token = await adminGiris();
  try {
    let r = await api('GET', '/auth/yapilandirma');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.turnstile, { aktif: true, mod: 'test', siteKey: '1x00000000000000000000AA' });
    assert.strictEqual(r.body.google.aktif, false);
    // Testmodus: ohne Token kein Block (falsches Passwort -> 401, nicht 400)
    r = await api('POST', '/auth/giris', { body: { email: 'niemand@test.kapbeni.com', password: 'x' } });
    assert.strictEqual(r.status, 401);

    // live mit ungueltigem Schluessel
    r = await adminApi('POST', '/entegrasyonlar/turnstile', { token, body: { mod: 'live', degerler: { siteKey: '0x4AAAAAAATESTONLYSITE', secretKey: '0x4AAAAAAATESTONLYSECRETxxxx' } } });
    assert.strictEqual(r.status, 200);
    await warte(11000);
    r = await api('GET', '/auth/yapilandirma');
    assert.strictEqual(r.body.turnstile.mod, 'live'); assert.strictEqual(r.body.turnstile.siteKey, '0x4AAAAAAATESTONLYSITE');
    assert.ok(!JSON.stringify(r.body).includes('SECRET'), 'Secret nie oeffentlich');
    r = await api('POST', '/auth/giris', { body: { email: 'niemand@test.kapbeni.com', password: 'x' } });
    assert.strictEqual(r.status, 400, 'live ohne Token -> 400'); assert.strictEqual(r.body.alan, 'turnstile');
    r = await api('POST', '/auth/kayit', { body: { email: 'x@test.kapbeni.com', phone: '05551112233', password: 'x', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' } });
    assert.strictEqual(r.status, 400, 'live mit abgelehntem Token -> 400');
    r = await adminApi('POST', '/giris', { body: { email: TEST_ADMIN_EMAIL, password: 'egal' } });
    assert.strictEqual(r.status, 400, 'Admin-Login live ohne Token -> 400');
    r = await adminApi('POST', '/sifre-unuttum', { body: { email: TEST_ADMIN_EMAIL } });
    assert.strictEqual(r.status, 400, 'Şifremi unuttum live ohne Token -> 400');

    // disabled
    r = await adminApi('POST', '/entegrasyonlar/turnstile', { token, body: { mod: 'disabled', degerler: {} } });
    await warte(11000);
    r = await api('GET', '/auth/yapilandirma');
    assert.strictEqual(r.body.turnstile.aktif, false);
    r = await adminApi('GET', '/giris-yapilandirma');
    assert.strictEqual(r.body.turnstile.aktif, false);
  } finally {
    await q("DELETE FROM entegrasyon_ayarlari WHERE provider='turnstile'");
    await warte(11000); // API-Zwischenspeicher leeren lassen: danach wieder Standard „test“
  }
});
