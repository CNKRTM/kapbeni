// Google-Login (v1.21, Geruest): ohne aktive Integration 404 und Knopf inaktiv;
// mit (falschen) Testwerten leitet /baslat zu Google weiter. Keine echten Google-Daten.
const test = require('node:test');
const assert = require('node:assert');
const { api, adminApi, adminGiris, q, pool, BASIS } = require('./_hilfe');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
test.after(() => pool.end());

test('Google-Login: gesperrt ohne Integration, Weiterleitung mit Konfiguration', async (t) => {
  const vorher = (await q("SELECT provider FROM entegrasyon_ayarlari WHERE provider IN ('google_admin','google_musteri')")).rows.length;
  if (vorher) return t.skip('Google ist bereits konfiguriert — Test aendert nichts');
  let r = await api('GET', '/auth/google/baslat');
  assert.strictEqual(r.status, 404);
  r = await api('GET', '/auth/google/callback?code=x&state=y');
  assert.strictEqual(r.status, 404);
  r = await adminApi('GET', '/google/baslat');
  assert.strictEqual(r.status, 404);
  r = await adminApi('GET', '/google/callback?code=x&state=y');
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await adminApi('GET', '/giris-yapilandirma')).body.google.aktif, false);

  const token = await adminGiris();
  const werte = { clientId: 'kp-test.apps.googleusercontent.com', clientSecret: 'kp-test-secret' };
  try {
    r = await adminApi('POST', '/entegrasyonlar/google_admin', { token, body: { mod: 'live', degerler: { ...werte, redirectUris: 'https://kapbeni.com/kapbeniadmin/admin/api/google/callback', izinliler: '@test.kapbeni.com' } } });
    assert.strictEqual(r.status, 200);
    r = await adminApi('POST', '/entegrasyonlar/google_musteri', { token, body: { mod: 'live', degerler: { ...werte, redirectUris: 'https://kapbeni.com/api/auth/google/callback' } } });
    assert.strictEqual(r.status, 200);
    r = await adminApi('GET', '/google/baslat');
    assert.strictEqual(r.status, 302);
    const ziel = new URL(r.headers.get('location'));
    assert.strictEqual(ziel.host, 'accounts.google.com');
    assert.strictEqual(ziel.searchParams.get('client_id'), werte.clientId);
    assert.ok(ziel.searchParams.get('state'));
    assert.strictEqual((await adminApi('GET', '/giris-yapilandirma')).body.google.aktif, true);
    // Callback mit gefaelschtem state -> zurueck zum Login mit Fehler, keine Sitzung
    r = await adminApi('GET', '/google/callback?code=x&state=falsch');
    assert.strictEqual(r.status, 302); assert.match(r.headers.get('location'), /#\/giris\?hata=google/);
    await warte(11000);
    const k = await fetch(BASIS + '/auth/google/baslat', { redirect: 'manual' });
    assert.strictEqual(k.status, 302); assert.match(k.headers.get('location'), /^https:\/\/accounts\.google\.com\//);
    assert.strictEqual((await api('GET', '/auth/yapilandirma')).body.google.aktif, true);
  } finally {
    await q("DELETE FROM entegrasyon_ayarlari WHERE provider IN ('google_admin','google_musteri')");
    await warte(11000);
  }
  r = await api('GET', '/auth/google/baslat');
  assert.strictEqual(r.status, 404, 'nach dem Test wieder gesperrt');
});
