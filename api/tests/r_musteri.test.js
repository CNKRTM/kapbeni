// A – Kundenliste und Kundenakte im Express-Admin (admin/musteri.js) gegen die Demo-Testkunden.
// Schreibende Schritte nur am Testkonto Elif Koç (test_verisi) und werden zurueckgesetzt.
const test = require('node:test');
const assert = require('node:assert');
const { q, pool, adminApi, adminGiris } = require('./_hilfe');

let tok = null;
const get = (p) => adminApi('GET', p, { token: tok });

test('Kundenliste und Akte', async (t) => {
  const elif = (await q("SELECT id, musteri_no, cinsiyet FROM users WHERE email='elif.koc@test.kapbeni.com' AND test_verisi")).rows[0];
  if (!elif) return t.skip('Demo-Testkunden fehlen (seed-testkunden.js)');
  const kaya = (await q("SELECT musteri_no, vkn FROM users WHERE email='satis.kayaelektronik@test.kapbeni.com'")).rows[0];
  const emre = (await q("SELECT musteri_no FROM users WHERE email='emre.celik@test.kapbeni.com'")).rows[0];
  tok = await adminGiris();
  const notVor = (await q('SELECT max(id) m FROM admin_kullanici_notlar')).rows[0].m || 0;
  const olayVor = (await q('SELECT max(id) m FROM musteri_olaylari')).rows[0].m || 0;
  try {
    // Suche: Nummer, Name, E-Mail, Telefon (beliebige Schreibweise), VKN, IP
    const such = async (s) => (await get('/musteriler?q=' + encodeURIComponent(s))).body.satirlar.map((x) => x.musteri_no);
    assert.deepStrictEqual(await such(elif.musteri_no), [elif.musteri_no]);
    assert.ok((await such('Elif Koç')).includes(elif.musteri_no));
    assert.ok((await such('elif.koc@test')).includes(elif.musteri_no));
    assert.ok((await such('0555 001 00 08')).includes(elif.musteri_no), 'Telefon normalisiert');
    assert.ok((await such(kaya.vkn)).includes(kaya.musteri_no), 'VKN');
    assert.ok((await such('88.247.150.20')).includes(elif.musteri_no), 'IP');
    // Filter
    let r = await get('/musteriler?tip=kurumsal&test=1');
    assert.strictEqual(r.status, 200); assert.ok(r.body.satirlar.every((x) => x.hesap_tipi === 'kurumsal'));
    r = await get('/musteriler?durum=silme_bekliyor&test=1');
    assert.ok(r.body.satirlar.some((x) => x.musteri_no === emre.musteri_no));
    r = await get('/musteriler?durum=aktif&test=1');
    assert.ok(r.body.satirlar.every((x) => x.aktif_28 === true && x.durum === 'aktif'));
    r = await get('/musteriler?durum=askida');
    assert.ok(r.body.satirlar.every((x) => x.hesap_durum === 'askida'));
    r = await get('/musteriler?test=0');
    assert.ok(r.body.satirlar.every((x) => !x.test_verisi), 'Test verisi aus');
    r = await get('/musteriler?test=1&sirala=ilan&yon=desc&limit=5&sayfa=1');
    assert.strictEqual(r.body.limit, 5); assert.ok(r.body.satirlar.length <= 5);
    const n = r.body.satirlar.map((x) => x.ilan_sayisi); assert.deepStrictEqual(n, [...n].sort((a, b) => b - a));
    assert.ok(r.body.kpi.toplam >= 8 && r.body.kpi.test >= 8);
    assert.strictEqual((await get("/musteriler?sirala=x;DROP TABLE users")).status, 200, 'Sortierung nur aus Liste');

    // Akte
    r = await get('/musteriler/' + emre.musteri_no);
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.hesap_durum, 'silme_bekliyor');
    assert.ok(r.body.silme_kalan_gun >= 0 && r.body.silme_kalan_gun <= 30);
    assert.ok(!('password_hash' in r.body.musteri) && !('tc_no_hash' in r.body.musteri), 'keine Geheimnisse');
    r = await get('/musteriler/' + kaya.musteri_no);
    assert.strictEqual(r.body.aktif, true); assert.strictEqual(r.body.vkn_gecerli, true); assert.ok(r.body.kpi.arsiv >= 1);
    assert.strictEqual((await get('/musteriler/KP-0000-0000000')).status, 404);
    const z = (await get('/musteriler/' + kaya.musteri_no + '/zaman')).body.olaylar;
    assert.ok(z.length > 10 && ['ilan', 'giris', 'belge'].every((tur) => z.some((e) => e.tur === tur)));
    assert.ok(z.some((e) => e.ilan && e.ilan.foto), 'Bild aus dem Inserat');
    const il = (await get('/musteriler/' + kaya.musteri_no + '/ilanlar')).body;
    assert.ok(il.ilanlar.length >= 5 && il.arsiv.length >= 1);
    assert.match(il.arsiv[0].bilder[0].url, /^arsiv\/dosya\//);
    const mehmet = (await q("SELECT musteri_no FROM users WHERE email='mehmet.demir@test.kapbeni.com'")).rows[0].musteri_no;
    const m = (await get('/musteriler/' + mehmet + '/mesajlar')).body.konusmalar;
    assert.ok(m.some((k) => k.mesajlar.some((x) => x.tehlikeli)), 'riskante Nachricht');
    assert.ok((await get('/musteriler/' + mehmet + '/sikayetler')).body.sikayetler.some((s) => s.yon === 'hakkinda'));
    assert.ok((await get('/musteriler/' + mehmet + '/teklifler')).body.teklifler.length >= 1);
    const ip = (await get('/musteriler/' + elif.musteri_no + '/ip')).body;
    assert.ok(ip.satirlar.length > 3 && ip.ipler.length >= 2 && ip.cihazlar.length >= 2);
    const b = (await get('/musteriler/' + kaya.musteri_no + '/belgeler')).body;
    assert.strictEqual(b.belgeler.length, 6); assert.ok(b.kurumsal);

    // Belge-Entscheidung (Ablehnen braucht Grund), danach zurueck
    const beleg = b.belgeler.find((x) => x.tur === 'faaliyet_belgesi');
    assert.strictEqual((await adminApi('POST', `/musteriler/${kaya.musteri_no}/belgeler/${beleg.id}`, { token: tok, body: { karar: 'reddedildi' } })).status, 400);
    assert.strictEqual((await adminApi('POST', `/musteriler/${kaya.musteri_no}/belgeler/${beleg.id}`, { token: tok, body: { karar: 'onayli' } })).status, 200);
    await q("UPDATE musteri_belgeleri SET durum=$1, inceleyen_admin=NULL, inceleme_at=NULL WHERE id=$2", [beleg.durum, beleg.id]);

    // Notiz, Geschlecht, Sperren/Entsperren (Elif, Testkonto)
    assert.strictEqual((await adminApi('POST', `/musteriler/${elif.musteri_no}/notlar`, { token: tok, body: { not: '' } })).status, 400);
    assert.strictEqual((await adminApi('POST', `/musteriler/${elif.musteri_no}/notlar`, { token: tok, body: { not: 'Test notu (r_musteri)' } })).status, 200);
    assert.ok((await get(`/musteriler/${elif.musteri_no}/notlar`)).body.notlar.some((x) => x.not_metni === 'Test notu (r_musteri)'));
    assert.strictEqual((await adminApi('PUT', `/musteriler/${elif.musteri_no}/cinsiyet`, { token: tok, body: { cinsiyet: 'x' } })).status, 400);
    assert.strictEqual((await adminApi('PUT', `/musteriler/${elif.musteri_no}/cinsiyet`, { token: tok, body: { cinsiyet: null } })).status, 200);
    assert.strictEqual((await q('SELECT cinsiyet FROM users WHERE id=$1', [elif.id])).rows[0].cinsiyet, null);
    assert.strictEqual((await adminApi('POST', `/musteriler/${elif.musteri_no}/askiya-al`, { token: tok, body: {} })).status, 400, 'Grund Pflicht');
    assert.strictEqual((await adminApi('POST', `/musteriler/${elif.musteri_no}/askiya-al`, { token: tok, body: { sebep: 'Test (r_musteri)' } })).status, 200);
    assert.strictEqual((await q('SELECT durum, ban_sebebi FROM users WHERE id=$1', [elif.id])).rows[0].ban_sebebi, 'Test (r_musteri)');
    assert.strictEqual((await adminApi('POST', `/musteriler/${elif.musteri_no}/aktifle`, { token: tok, body: {} })).status, 200);
    assert.strictEqual((await q('SELECT durum FROM users WHERE id=$1', [elif.id])).rows[0].durum, 'aktif');
    assert.strictEqual((await adminApi('POST', `/musteriler/${emre.musteri_no}/askiya-al`, { token: tok, body: { sebep: 'x' } })).status, 409, 'Silme sürecinde');

    // Export
    r = await adminApi('GET', `/musteriler/${elif.musteri_no}/disa-aktar?bicim=json`, { token: tok });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.musteri.musteri_no, elif.musteri_no); assert.ok(Array.isArray(r.body.olaylar) && r.body.ilanlar.length >= 1);
    r = await adminApi('GET', `/musteriler/${elif.musteri_no}/disa-aktar?bicim=csv`, { token: tok });
    assert.strictEqual(r.status, 200); assert.match(String(r.body), /zaman;olay;hedef_tip/);
    assert.strictEqual((await adminApi('GET', '/musteriler')).status, 401, 'ohne Anmeldung');
  } finally {
    await q("UPDATE users SET cinsiyet=$1, durum='aktif', ban_sebebi=NULL WHERE id=$2 AND test_verisi", [elif.cinsiyet, elif.id]);
    await q('DELETE FROM admin_kullanici_notlar WHERE id>$1 AND kullanici_id=$2', [notVor, elif.id]);
    await q("DELETE FROM musteri_olaylari WHERE id>$1 AND user_id=$2 AND olay IN ('hesap_askiya','hesap_aktif')", [olayVor, elif.id]);
    if (tok) await adminApi('POST', '/cikis', { token: tok });
  }
});

test.after(() => pool.end());
