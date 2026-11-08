// ════════════════════════════════════════════════════════════════════════════
//  Benachrichtigungen (v1.35): Ausloeser Nachricht / Angebot / Angebot
//  angenommen-abgelehnt / Inserat freigegeben-abgelehnt, Einstellungen,
//  Zaehler, Gelesen-Markierung. Nur Testkonten; eigenes Testinserat, alles
//  Angelegte wird entfernt. Nie users.id=1.
// ════════════════════════════════════════════════════════════════════════════
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { api, tokenFuer, q, pool, adminApi, adminGiris } = require('./_hilfe');

const FRONT = '/opt/kapbeni/Kapbeni_Prod/src/src';
const KAEUFER = 71;   // Ayşe Yılmaz (Seed-Testkunde)
let SATICI, ilan, maxBildirim;

const bildirimleri = async (uid) => (await q(
  'SELECT * FROM bildirimler WHERE user_id=$1 AND id>$2 ORDER BY id', [uid, maxBildirim])).rows;

test.before(async () => {
  SATICI = (await q("SELECT id FROM users WHERE email='elif.koc@test.kapbeni.com' AND test_verisi")).rows[0].id;
  assert.ok(SATICI && SATICI !== 1 && KAEUFER !== 1);
  maxBildirim = (await q('SELECT coalesce(max(id),0)::int m FROM bildirimler')).rows[0].m;
  ilan = (await q(`INSERT INTO ilanlar(user_id,kategori_id,baslik,aciklama,fiyat,durum,ilan_durum,sehir,ilce)
    VALUES($1,3,'Test Bildirim x_bildirim','Benachrichtigungs-Test, wird sofort entfernt.',1500,'kullanilmis','aktif','İstanbul','Kadıköy')
    RETURNING id, uuid`, [SATICI])).rows[0];
});

test.after(async () => {
  try {
    const k = (await q('SELECT id FROM konusmalar WHERE ilan_id=$1', [ilan.id])).rows.map((r) => r.id);
    if (k.length) {
      const m = (await q('SELECT id FROM mesajlar WHERE konusma_id = ANY($1)', [k])).rows.map((r) => String(r.id));
      await q("DELETE FROM musteri_olaylari WHERE olay='mesaj' AND hedef_id = ANY($1)", [m]);
      await q('DELETE FROM mesajlar WHERE konusma_id = ANY($1)', [k]);
      await q('DELETE FROM konusmalar WHERE id = ANY($1)', [k]);
    }
    const t = (await q('SELECT id FROM teklifler WHERE ilan_id=$1', [ilan.id])).rows.map((r) => String(r.id));
    await q("DELETE FROM musteri_olaylari WHERE olay='teklif' AND hedef_id = ANY($1)", [t]);
    await q("DELETE FROM audit_log WHERE olay='teklif.olustur' AND detay->>'ilan'=$1", [String(ilan.uuid)]);
    await q('DELETE FROM teklifler WHERE ilan_id=$1', [ilan.id]);
    await q("DELETE FROM audit_log WHERE hedef_tip='ilan' AND hedef_id::text=$1::text AND olay LIKE 'ilan.%'", [ilan.id]).catch(() => {});
    await q('DELETE FROM bildirimler WHERE user_id = ANY($1) AND id>$2', [[SATICI, KAEUFER], maxBildirim]);
    await require('../src/lib/meiliSync').deleteListing(String(ilan.uuid)).catch(() => {});
    await q('DELETE FROM ilanlar WHERE id=$1 AND user_id=$2', [ilan.id, SATICI]);
    await q('UPDATE users SET bildirim_mesaj=true, bildirim_teklif=true WHERE id=$1', [SATICI]);
  } finally { await pool.end(); }
});

test('Nachricht: eine Meldung je Konversation, Öffnen markiert gelesen, Zähler', async () => {
  const tk = await tokenFuer(KAEUFER), ts = await tokenFuer(SATICI);
  const vorher = (await api('GET', '/bildirimler/ozet', { token: ts })).body;
  assert.ok(Number.isInteger(vorher.bildirim) && Number.isInteger(vorher.mesaj));
  const k = await api('POST', '/mesajlar/konusma', { token: tk, body: { ilan_uuid: ilan.uuid } });
  assert.strictEqual(k.status, 200);
  assert.strictEqual((await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: tk, body: { metin: 'Merhaba, hâlâ satılık mı? (Test)' } })).status, 200);
  let b = await bildirimleri(SATICI);
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].tip, 'mesaj');
  assert.strictEqual(b[0].link, `/#/mesajlar/${k.body.id}`);
  assert.match(b[0].baslik, /size mesaj gönderdi/);
  assert.match(b[0].icerik, /hâlâ satılık mı/);
  // zweite Nachricht: dieselbe Meldung wird aktualisiert, keine zweite
  await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: tk, body: { metin: 'Pazarlık payı var mı? (Test)' } });
  b = await bildirimleri(SATICI);
  assert.strictEqual(b.length, 1);
  assert.match(b[0].icerik, /Pazarlık payı/);
  let o = (await api('GET', '/bildirimler/ozet', { token: ts })).body;
  assert.strictEqual(o.bildirim, vorher.bildirim + 1);
  assert.strictEqual(o.mesaj, vorher.mesaj + 2);
  // Liste der Konversationen kennt die ungelesenen
  const liste = (await api('GET', '/mesajlar/konusmalar', { token: ts })).body;
  assert.strictEqual(liste.find((x) => x.id === k.body.id).okunmamis, 2);
  // Absender bekommt nichts
  assert.strictEqual((await bildirimleri(KAEUFER)).length, 0);
  // Verkäufer öffnet → Nachrichten + Meldung gelesen
  await api('GET', `/mesajlar/konusma/${k.body.id}`, { token: ts });
  assert.strictEqual((await bildirimleri(SATICI))[0].okundu, true);
  o = (await api('GET', '/bildirimler/ozet', { token: ts })).body;
  assert.strictEqual(o.bildirim, vorher.bildirim);
  assert.strictEqual(o.mesaj, vorher.mesaj);
  // nach dem Lesen erzeugt eine neue Nachricht wieder eine (neue) ungelesene Meldung
  await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: tk, body: { metin: 'Yarın bakabilir miyim? (Test)' } });
  b = await bildirimleri(SATICI);
  assert.strictEqual(b.length, 2);
  assert.strictEqual(b[1].okundu, false);
  // Antwort des Verkäufers → Käufer bekommt eine Meldung
  await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: ts, body: { metin: 'Tabii, saat 18 uygun. (Test)' } });
  const bk = await bildirimleri(KAEUFER);
  assert.strictEqual(bk.length, 1);
  assert.strictEqual(bk[0].link, `/#/mesajlar/${k.body.id}`);
});

test('Einstellung „Yeni mesaj bildirimleri“ aus: keine Meldung', async () => {
  await q('UPDATE users SET bildirim_mesaj=false WHERE id=$1', [SATICI]);
  try {
    const tk = await tokenFuer(KAEUFER);
    const k = await api('POST', '/mesajlar/konusma', { token: tk, body: { ilan_uuid: ilan.uuid } });
    await q("UPDATE bildirimler SET okundu=true WHERE user_id=$1 AND id>$2", [SATICI, maxBildirim]);
    const n = (await bildirimleri(SATICI)).length;
    const m = await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: tk, body: { metin: 'Ayar testi (Test)' } });
    assert.strictEqual(m.status, 200, 'Nachricht selbst geht durch');
    assert.strictEqual((await bildirimleri(SATICI)).length, n);
  } finally { await q('UPDATE users SET bildirim_mesaj=true WHERE id=$1', [SATICI]); }
});

test('Angebot: Verkäufer erfährt es, Käufer erfährt Annahme/Ablehnung; ungültiger Status 400', async () => {
  const tk = await tokenFuer(KAEUFER), ts = await tokenFuer(SATICI);
  const t1 = await api('POST', '/teklifler', { token: tk, body: { ilan_uuid: ilan.uuid, teklif_fiyat: 1200 } });
  assert.strictEqual(t1.status, 201);
  const s = (await bildirimleri(SATICI)).filter((x) => x.tip === 'teklif_yeni');
  assert.strictEqual(s.length, 1);
  assert.match(s[0].baslik, /1\.200 TL/);
  assert.strictEqual(s[0].link, '/#/panel/gelen-teklifler');
  assert.strictEqual((await api('PUT', `/teklifler/${t1.body.id}`, { token: ts, body: { status: 'irgendwas' } })).status, 400);
  // Käufer darf nicht entscheiden
  assert.strictEqual((await api('PUT', `/teklifler/${t1.body.id}`, { token: tk, body: { status: 'kabul' } })).status, 404);
  assert.strictEqual((await api('PUT', `/teklifler/${t1.body.id}`, { token: ts, body: { status: 'reddedildi' } })).status, 200);
  const t2 = await api('POST', '/teklifler', { token: tk, body: { ilan_uuid: ilan.uuid, teklif_fiyat: 1400 } });
  assert.strictEqual((await api('PUT', `/teklifler/${t2.body.id}`, { token: ts, body: { status: 'kabul' } })).status, 200);
  const k = await bildirimleri(KAEUFER);
  const red = k.find((x) => x.tip === 'teklif_red'), kabul = k.find((x) => x.tip === 'teklif_kabul');
  assert.ok(red && kabul, k.map((x) => x.tip).join(','));
  assert.match(kabul.baslik, /kabul edildi: 1\.400 TL/);
  assert.match(red.icerik, /reddedildi/);
  assert.strictEqual(kabul.link, '/#/panel/tekliflerim');
});

test('Admin: Freigabe und Ablehnung benachrichtigen den Eigentümer', async () => {
  await q("UPDATE ilanlar SET ilan_durum='moderasyonda' WHERE id=$1", [ilan.id]);
  const tok = await adminGiris();
  try {
    assert.strictEqual((await adminApi('POST', `/ilanlar/${ilan.id}/onayla`, { token: tok })).status, 200);
    const on = (await bildirimleri(SATICI)).find((x) => x.tip === 'ilan_onay');
    assert.ok(on);
    assert.strictEqual(on.link, `/#/ilan/${ilan.uuid}`);
    assert.strictEqual(on.baslik, 'İlanınız yayında');
  } finally { await adminApi('POST', '/cikis', { token: tok }); }
  // Ablehnung (archiviert zusätzlich — darum direkt über die Bibliothek wie der Admin-Pfad, Archiv-Test in p_arsiv)
  const quelle = fs.readFileSync('/opt/kapbeni/admin/server.js', 'utf8');
  assert.match(quelle, /tip: 'ilan_red'/);
  const b = require('../src/lib/bildirim');
  const id = await b.gonder({ userId: SATICI, tip: 'ilan_red', kaynakTip: 'ilan', kaynakId: ilan.id, baslik: 'İlanınız yayına alınmadı', icerik: 'Sebep: Test', link: '/#/panel/ilanlarim' });
  assert.ok(id);
});

test('Liste, Gelesen, Fremdzugriff, ungültige Kennung', async () => {
  const ts = await tokenFuer(SATICI), tk = await tokenFuer(KAEUFER);
  const l = await api('GET', '/bildirimler', { token: ts });
  assert.strictEqual(l.status, 200);
  assert.ok(Array.isArray(l.body.bildirimler) && Number.isInteger(l.body.okunmamis) && Number.isInteger(l.body.mesaj_okunmamis));
  const eigene = await bildirimleri(SATICI);
  const offen = eigene.find((x) => !x.okundu);
  assert.ok(offen);
  // Fremder kann nicht als gelesen markieren
  await api('PUT', `/bildirimler/${offen.id}/oku`, { token: tk });
  assert.strictEqual((await q('SELECT okundu FROM bildirimler WHERE id=$1', [offen.id])).rows[0].okundu, false);
  assert.strictEqual((await api('PUT', `/bildirimler/${offen.id}/oku`, { token: ts })).status, 200);
  assert.strictEqual((await q('SELECT okundu FROM bildirimler WHERE id=$1', [offen.id])).rows[0].okundu, true);
  assert.strictEqual((await api('PUT', '/bildirimler/abc/oku', { token: ts })).status, 400);
  assert.strictEqual((await api('GET', '/bildirimler/ozet')).status, 401);
  // Gelöschte Konten bekommen nichts; unbekannte Nutzer ebenso (wirft nie)
  const b = require('../src/lib/bildirim');
  assert.strictEqual(await b.gonder({ userId: 999999999, tip: 'mesaj', baslik: 'x' }), null);
});

test('Oberfläche: Glocke in der Navbar, Mesajlar-Zähler aus der API statt Mock', () => {
  const nav = fs.readFileSync(`${FRONT}/components/Navbar.tsx`, 'utf8');
  assert.match(nav, /<BildirimZili gorunum="masaustu"/);
  assert.match(nav, /<BildirimZili gorunum="menu"/);
  const app = fs.readFileSync(`${FRONT}/App.tsx`, 'utf8');
  assert.doesNotMatch(app, /chats\.filter\(\(c\) => c\.unread\)/);
  assert.match(app, /const unreadCount = bildirimOzet\.mesaj/);
  const dash = fs.readFileSync(`${FRONT}/pages/Dashboard.tsx`, 'utf8');
  assert.match(dash, /'gelen-teklifler'/);
  // Verhalten im Browser: api/tests/ui/bildirim.js
});
