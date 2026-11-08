// M – Merkmalswerte (Marken) im Express-Admin pflegen: hinzufuegen, Dublette, umbenennen
// (inkl. vorhandener Inseratswerte), sortieren, entfernen; „Diğer“ bleibt am Ende.
// Arbeitet mit einem eigenen Testwert und einem Inserat des Testkontos; alles wird entfernt.
const test = require('node:test');
const assert = require('node:assert');
const { q, pool, adminApi, adminGiris, TESTKONTO } = require('./_hilfe');

test('Kategoriler + Özellikler', async () => {
  const tok = await adminGiris();
  const z = Date.now(), wert = `TestMarka${z}`;
  let ilanId = null;
  try {
    const k = await adminApi('GET', '/kategoriler', { token: tok });
    assert.strictEqual(k.status, 200); assert.ok(k.body.length > 100 && k.body.filter((x) => !x.ust_id).length >= 10, 'Kategorien aus der DB');
    const tel = k.body.find((x) => x.slug === 'telefon');
    const iphone = k.body.find((x) => x.slug === 'iphone-ios');
    let o = (await adminApi('GET', `/kategoriler/${iphone.id}/ozellikler`, { token: tok })).body;
    const marka = o.find((x) => x.alan_adi === 'marka');
    assert.ok(marka && marka.miras && marka.kategori_id === tel.id, 'Marke von Telefon geerbt');
    assert.strictEqual(marka.secenekler.at(-1).deger, 'Diğer');
    // hinzufuegen + Dublette
    assert.strictEqual((await adminApi('POST', `/ozellik/${marka.id}/secenek`, { token: tok, body: { deger: wert } })).status, 200);
    assert.strictEqual((await adminApi('POST', `/ozellik/${marka.id}/secenek`, { token: tok, body: { deger: wert.toLowerCase() } })).status, 409);
    assert.strictEqual((await adminApi('POST', `/ozellik/${marka.id}/secenek`, { token: tok, body: { deger: '  ' } })).status, 400);
    o = (await adminApi('GET', `/kategoriler/${tel.id}/ozellikler`, { token: tok })).body.find((x) => x.alan_adi === 'marka');
    const s = o.secenekler.find((x) => x.deger === wert);
    assert.ok(s); assert.strictEqual(o.secenekler.at(-1).deger, 'Diğer'); assert.strictEqual(o.secenekler.at(-2).deger, wert);
    // Inserat des Testkontos nutzt den Wert; Umbenennen mit mevcut zieht ihn mit
    ilanId = (await q(`INSERT INTO ilanlar(user_id,kategori_id,baslik,fiyat,durum,ilan_durum) VALUES($1,$2,'TEST marka',1,'sifir','pasif') RETURNING id`, [TESTKONTO, iphone.id])).rows[0].id;
    await q('INSERT INTO ilan_ozellik_degerleri(ilan_id,tanim_id,deger) VALUES($1,$2,$3)', [ilanId, marka.id, wert]);
    let r = await adminApi('PUT', `/secenek/${s.id}`, { token: tok, body: { deger: wert + 'X', mevcut: true } });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.guncellenen_ilan, 1);
    assert.strictEqual((await q('SELECT deger FROM ilan_ozellik_degerleri WHERE ilan_id=$1', [ilanId])).rows[0].deger, wert + 'X');
    // sortieren: an den Anfang, „Diğer“ bleibt hinten
    const ids = o.secenekler.map((x) => x.id); ids.splice(ids.indexOf(s.id), 1); ids.unshift(s.id);
    assert.strictEqual((await adminApi('POST', `/ozellik/${marka.id}/sirala`, { token: tok, body: { ids } })).status, 200);
    o = (await adminApi('GET', `/kategoriler/${tel.id}/ozellikler`, { token: tok })).body.find((x) => x.alan_adi === 'marka');
    assert.strictEqual(o.secenekler[0].id, s.id); assert.strictEqual(o.secenekler.at(-1).deger, 'Diğer');
    assert.strictEqual((await adminApi('POST', `/ozellik/${marka.id}/sirala`, { token: tok, body: { ids: [999999] } })).status, 400);
    // entfernen; „Diğer“ nicht
    const diger = o.secenekler.at(-1);
    assert.strictEqual((await adminApi('DELETE', `/secenek/${diger.id}`, { token: tok })).status, 400);
    assert.strictEqual((await adminApi('DELETE', `/secenek/${s.id}`, { token: tok })).status, 200);
    assert.strictEqual((await q('SELECT count(*)::int c FROM kategori_ozellik_secenekleri WHERE id=$1', [s.id])).rows[0].c, 0);
    // alte Reihenfolge wiederherstellen
    const alt = marka.secenekler.map((x) => x.id);
    assert.strictEqual((await adminApi('POST', `/ozellik/${marka.id}/sirala`, { token: tok, body: { ids: alt } })).status, 200);
  } finally {
    await q("DELETE FROM kategori_ozellik_secenekleri WHERE deger LIKE $1", [wert + '%']);
    if (ilanId) await q('DELETE FROM ilanlar WHERE id=$1 AND user_id=$2', [ilanId, TESTKONTO]);
    await adminApi('POST', '/cikis', { token: tok });
  }
});

test.after(() => pool.end());
