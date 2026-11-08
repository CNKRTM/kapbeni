// Entegrasyonlar (Admin → Sistem): Maskierung, Verschluesselung, Speichern ohne
// Maskenrueckschrieb, Tests, Weiterleitung der alten Seite.
// Schreibt nur die Zeile 'resend' (vorher nicht vorhanden) und entfernt sie wieder.
const test = require('node:test');
const assert = require('node:assert');
const { adminApi, adminGiris, q, pool } = require('./_hilfe');
test.after(async () => { await pool.end(); await require('../src/lib/entegrasyon').kapat(); });

test('Entegrasyonlar: Liste, Maske, Verschluesselung, Test', async (t) => {
  const vorher = await q("SELECT 1 FROM entegrasyon_ayarlari WHERE provider='resend'");
  if (vorher.rows.length) return t.skip('resend ist bereits konfiguriert — Test schreibt dort nicht');
  const token = await adminGiris();
  try {
    const l = await adminApi('GET', '/entegrasyonlar', { token });
    assert.strictEqual(l.status, 200);
    const keys = l.body.entegrasyonlar.map((x) => x.key);
    for (const k of ['claude', 'iyzico', 'smtp', 'resend', 'turnstile', 'google_musteri', 'google_admin', 'netgsm', 'r2', 'meilisearch', 'nominatim'])
      assert.ok(keys.includes(k), 'fehlt: ' + k);
    // Kein Klartext-Geheimnis in der Antwort: alle secret-Felder leer oder maskiert
    for (const e of l.body.entegrasyonlar) for (const a of e.alanlar)
      if (a.secret) assert.ok(a.deger === '' || a.deger.startsWith('••••'), `${e.key}.${a.key} nicht maskiert`);
    const meili = l.body.entegrasyonlar.find((x) => x.key === 'meilisearch');
    assert.strictEqual(meili.alanlar.find((a) => a.key === 'apiKey').kaynak, 'env', 'Meili-Schluessel kommt aus .env');
    const tur = l.body.entegrasyonlar.find((x) => x.key === 'turnstile');
    assert.strictEqual(tur.mod, 'test', 'Turnstile Standard = test');

    // Speichern: Geheimfeld verschluesselt, Antwort maskiert
    const geheim = 're_test_' + Date.now() + 'abcd';
    let r = await adminApi('POST', '/entegrasyonlar/resend', { token, body: { mod: 'live', degerler: { apiKey: geheim, from: 'Kap Beni <test@test.kapbeni.com>' } } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const feld = r.body.entegrasyon.alanlar.find((a) => a.key === 'apiKey');
    assert.ok(feld.deger.startsWith('••••') && feld.deger.endsWith('abcd') && feld.kaynak === 'db');
    const roh = (await q("SELECT credentials::text c FROM entegrasyon_ayarlari WHERE provider='resend'")).rows[0].c;
    assert.ok(!roh.includes(geheim) && roh.includes('"ct"'), 'credentials verschluesselt');

    // Maske zurueckschicken aendert nichts
    r = await adminApi('POST', '/entegrasyonlar/resend', { token, body: { mod: 'live', degerler: { apiKey: feld.deger, from: 'Kap Beni <test@test.kapbeni.com>' } } });
    const ent = require('../src/lib/entegrasyon'); ent.cacheLeeren();
    assert.strictEqual((await ent.ayar('resend')).degerler.apiKey, geheim, 'Maske wurde nicht zurueckgeschrieben');

    // Test mit falschem Schluessel -> hata, wird gespeichert
    r = await adminApi('POST', '/entegrasyonlar/resend/test', { token });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.ok, false);
    const zeile = (await q("SELECT son_test_sonuc FROM entegrasyon_ayarlari WHERE provider='resend'")).rows[0];
    assert.strictEqual(zeile.son_test_sonuc, 'hata');

    // Turnstile im Testmodus besteht, Meili besteht
    r = await adminApi('POST', '/entegrasyonlar/turnstile/test', { token });
    assert.strictEqual(r.body.ok, true, r.body.mesaj);
    r = await adminApi('POST', '/entegrasyonlar/meilisearch/test', { token });
    assert.strictEqual(r.body.ok, true, r.body.mesaj);

    // iyzico live auf Staging verboten
    r = await adminApi('POST', '/entegrasyonlar/iyzico', { token, body: { mod: 'live', degerler: {} } });
    assert.strictEqual(r.status, 400);

    // Alte Seite leitet weiter
    r = await adminApi('GET', '/api-durum', { token });
    assert.strictEqual(r.status, 308); assert.match(r.headers.get('location'), /entegrasyonlar$/);
    // audit_log enthaelt Feldnamen, keine Werte
    const au = (await q("SELECT string_agg(detay::text, ' ') d FROM (SELECT detay FROM audit_log WHERE olay='entegrasyon.kaydet' ORDER BY id DESC LIMIT 2) x")).rows[0].d;
    assert.ok(au.includes('apiKey'), 'Feldname im audit_log');
    assert.ok(!au.includes(geheim), 'kein Wert im audit_log');
  } finally {
    await q("DELETE FROM entegrasyon_ayarlari WHERE provider='resend'");
    await q("DELETE FROM entegrasyon_ayarlari WHERE provider IN ('turnstile','meilisearch','iyzico') AND credentials IS NULL AND config='{}'::jsonb AND guncelleyen IS NULL");
  }
});
