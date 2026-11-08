// ════════════════════════════════════════════════════════════════════════════
//  Fehler aus dem E2E-Test Staging (08.11.2026), je Fix ein Test.
//  Nur Testkonten (test_verisi=true); was angelegt wird, wird wieder entfernt.
// ════════════════════════════════════════════════════════════════════════════
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { api, tokenFuer, q, pool, adminApi, adminGiris } = require('./_hilfe');

const FRONT = '/opt/kapbeni/Kapbeni_Prod/src/src';
const KAEUFER = 71;   // Ayşe Yılmaz (Seed-Testkunde)

/** Aktives Inserat eines anderen Testkontos (nie users.id=1). */
async function fremdesTestinserat(nicht) {
  const { rows } = await q(`SELECT i.id, i.uuid, i.user_id FROM ilanlar i JOIN users u ON u.id=i.user_id
    WHERE u.test_verisi AND u.id<>$1 AND u.id<>1 AND i.ilan_durum='aktif' ORDER BY i.id LIMIT 1`, [nicht]);
  if (!rows[0]) throw new Error('kein aktives Testinserat');
  return rows[0];
}

test.after(() => pool.end());

test('v1.33.1 Chat: Website-Pfad = API-Route, Nachricht wird gespeichert', async () => {
  const quelle = fs.readFileSync(`${FRONT}/api/index.ts`, 'utf8');
  assert.match(quelle, /ve\.post\(`\/mesajlar\/konusma\/\$\{id\}\/mesaj`/, 'Frontend sendet an /konusma/:id/mesaj');
  const il = await fremdesTestinserat(KAEUFER);
  const t = await tokenFuer(KAEUFER);
  const vorher = (await q('SELECT id FROM konusmalar WHERE ilan_id=$1 AND alici_id=$2', [il.id, KAEUFER])).rows[0];
  const k = await api('POST', '/mesajlar/konusma', { token: t, body: { ilan_uuid: il.uuid } });
  assert.strictEqual(k.status, 200);
  try {
    // alter Pfad existiert nicht (Gegenprobe), neuer speichert
    assert.strictEqual((await api('POST', `/mesajlar/konusma/${k.body.id}`, { token: t, body: { metin: 'x' } })).status, 404);
    const m = await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: t, body: { metin: 'Merhaba, ürün duruyor mu? (Test)' } });
    assert.strictEqual(m.status, 200);
    assert.ok(m.body.mesaj && m.body.mesaj.id);
    const g = await api('GET', `/mesajlar/konusma/${k.body.id}`, { token: t });
    assert.ok(g.body.some((x) => x.id === m.body.mesaj.id));
  } finally {
    await q('DELETE FROM mesajlar WHERE konusma_id=$1 AND gonderen_id=$2', [k.body.id, KAEUFER]);
    await q("DELETE FROM musteri_olaylari WHERE user_id=$1 AND olay='mesaj' AND (detay->>'konusma_id')::int=$2", [KAEUFER, k.body.id]);
    if (!vorher) await q('DELETE FROM konusmalar WHERE id=$1', [k.body.id]);
  }
});

test('v1.33.2 Combobox: Escape bei offener Liste wird nicht an das Fenster weitergereicht', () => {
  const cb = fs.readFileSync(`${FRONT}/components/Combobox.tsx`, 'utf8');
  assert.match(cb, /if \(offen\) \{ e\.preventDefault\(\); e\.nativeEvent\.stopPropagation\(\) \}/);
  const gt = fs.readFileSync(`${FRONT}/lib/geriTusu.ts`, 'utf8');
  assert.match(gt, /if \(e\.defaultPrevented\) return/);
  // Verhalten im Browser: api/tests/ui/e2e.js Schritt „escape“ (390/1280 px)
});

/** Dokument im Meili-Index vorhanden? */
async function imIndex(uuid) {
  const { meili } = require('../src/lib/meili');
  try { const d = await meili('GET', `/indexes/ilanlar/documents/${encodeURIComponent(uuid)}`); return !!(d && d.uuid); }
  catch { return false; }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
/** Wartet, bis Meili die Aufgabe verarbeitet hat (asynchron, meist < 1 s). */
async function indexWarten(uuid, soll) { for (let i = 0; i < 20; i++) { if (await imIndex(uuid) === soll) return soll; await warte(300); } return !soll; }

test('v1.33.3 İlan Onayı: Freigabe nimmt das Inserat sofort in den Suchindex', async () => {
  const sahip = (await q("SELECT id FROM users WHERE email='elif.koc@test.kapbeni.com' AND test_verisi")).rows[0].id;
  const { rows } = await q(`INSERT INTO ilanlar(user_id,kategori_id,baslik,aciklama,fiyat,durum,ilan_durum,sehir,ilce)
    VALUES($1,3,'Test Onay Meili w_e2e','Freigabe-Test, wird sofort entfernt.',123,'kullanilmis','moderasyonda','İstanbul','Kadıköy') RETURNING id, uuid`, [sahip]);
  const il = rows[0];
  try {
    assert.strictEqual(await imIndex(il.uuid), false);
    const t = await adminGiris();
    const r = await adminApi('POST', `/ilanlar/${il.id}/onayla`, { token: t });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(await indexWarten(il.uuid, true), true, 'nach Freigabe im Index');
    await adminApi('POST', '/cikis', { token: t });
  } finally {
    await require('../src/lib/meiliSync').deleteListing(il.uuid);
    await q('DELETE FROM ilanlar WHERE id=$1 AND user_id=$2', [il.id, sahip]);
  }
});

test('v1.33.4 Anlegen: Meldung richtet sich nach ilan_durum', () => {
  const app = fs.readFileSync(`${FRONT}/App.tsx`, 'utf8');
  assert.match(app, /sonuc\?\.ilan\?\.ilan_durum === 'moderasyonda'/);
  assert.match(app, /İlanınız incelemeye alındı/);
  // Verhalten im Browser: api/tests/ui/e2e.js Schritt „toast“
});

test('v1.33.5 Detail-Nachfrage ?medya=1 zählt keinen Aufruf', async () => {
  const il = await fremdesTestinserat(KAEUFER);
  const z = async () => (await q('SELECT goruntulenme FROM ilanlar WHERE id=$1', [il.id])).rows[0].goruntulenme;
  const a = await z();
  for (let i = 0; i < 3; i++) assert.strictEqual((await api('GET', `/ilanlar/${il.uuid}?medya=1`)).status, 200);
  assert.strictEqual(await z(), a);
  await api('GET', `/ilanlar/${il.uuid}`);
  assert.strictEqual(await z(), a + 1);
  await q('UPDATE ilanlar SET goruntulenme=goruntulenme-1 WHERE id=$1', [il.id]);
});

test('v1.34.0 Satıldı: per uuid, nur Eigentümer, nur aktiv, raus aus dem Index, Ereignis', async () => {
  const sahip = (await q("SELECT id FROM users WHERE email='elif.koc@test.kapbeni.com' AND test_verisi")).rows[0].id;
  const { rows } = await q(`INSERT INTO ilanlar(user_id,kategori_id,baslik,aciklama,fiyat,durum,ilan_durum,sehir,ilce)
    VALUES($1,3,'Test Satildi w_e2e','Satıldı-Test, wird sofort entfernt.',321,'kullanilmis','aktif','İstanbul','Kadıköy') RETURNING id, uuid`, [sahip]);
  const il = rows[0];
  const ms = require('../src/lib/meiliSync');
  try {
    await ms.syncListing(il.uuid);
    assert.strictEqual(await indexWarten(il.uuid, true), true);
    // fremder Nutzer → 404, nichts geaendert
    assert.strictEqual((await api('PUT', `/ilanlar/${il.uuid}/satildi`, { token: await tokenFuer(KAEUFER), body: {} })).status, 404);
    const t = await tokenFuer(sahip);
    assert.strictEqual((await api('PUT', `/ilanlar/${il.uuid}/satildi`, { token: t, body: {} })).status, 200);
    assert.strictEqual((await q('SELECT ilan_durum FROM ilanlar WHERE id=$1', [il.id])).rows[0].ilan_durum, 'satildi');
    assert.strictEqual(await indexWarten(il.uuid, false), false, 'nicht mehr im Index');
    assert.strictEqual((await q("SELECT count(*)::int n FROM musteri_olaylari WHERE user_id=$1 AND olay='ilan_satildi' AND hedef_id=$2", [sahip, String(il.uuid)])).rows[0].n, 1);
    // zweites Mal: nicht mehr aktiv → 404; Unsinn-Kennung → 404
    assert.strictEqual((await api('PUT', `/ilanlar/${il.uuid}/satildi`, { token: t, body: {} })).status, 404);
    assert.strictEqual((await api('PUT', '/ilanlar/abc/satildi', { token: t, body: {} })).status, 404);
  } finally {
    await ms.deleteListing(il.uuid);
    await q("DELETE FROM musteri_olaylari WHERE user_id=$1 AND hedef_id=$2", [sahip, String(il.uuid)]);
    await q("DELETE FROM audit_log WHERE olay='ilan.satildi' AND hedef_id::text=$1::text", [il.id]).catch(() => {});
    await q('DELETE FROM ilanlar WHERE id=$1 AND user_id=$2', [il.id, sahip]);
  }
});

module.exports = { fremdesTestinserat, KAEUFER, FRONT };
