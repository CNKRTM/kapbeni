// I/J – Medien: zwei Bildgroessen, EXIF/GPS weg, Inhaltspruefung (v1.27).
// Schreibt NUR ein eigenes Testinserat des Testkontos und raeumt es wieder ab.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { api, tokenFuer, q, pool, TESTKONTO } = require('./_hilfe');
const bild = require('../src/lib/bild');

const UP = process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const TITEL = 'TEST-MEDYA Agent bitte ignorieren';

/** Testfoto 3000x2000 mit EXIF (Kamera) und GPS — wie vom Handy. */
async function handyFoto() {
  const roh = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#2d6a4f' } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000"><circle cx="1500" cy="1000" r="700" fill="#f4a261"/><text x="1500" y="1050" font-size="200" text-anchor="middle" fill="#fff">TEST</text></svg>') }])
    .jpeg({ quality: 90 }).toBuffer();
  return sharp(roh).withExif({ IFD0: { Make: 'KapTest', Model: 'Phone X' },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 0/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '29/1 0/1 0/1' } }).jpeg({ quality: 90 }).toBuffer();
}

async function arsivAufraeumen(uuid) {
  await q('DELETE FROM medya_isleri WHERE ilan_uuid=$1', [uuid]);
  const a = (await q('DELETE FROM ilan_arsiv WHERE ilan_uuid=$1 RETURNING musteri_no', [uuid])).rows[0];
  if (a && a.musteri_no) {
    fs.rmSync(path.join(UP, 'archiv', a.musteri_no, uuid), { recursive: true, force: true });
    try { fs.rmdirSync(path.join(UP, 'archiv', a.musteri_no)); } catch { /* nicht leer */ }
  }
}

test('Namensregel kleinUrl', () => {
  assert.strictEqual(bild.kleinUrl('/uploads/ilanlar/abc_0_lg.webp'), '/uploads/ilanlar/abc_0_sm.webp');
  assert.strictEqual(bild.kleinUrl('/uploads/ilanlar/abc_0.webp'), '/uploads/ilanlar/abc_0_sm.webp');
  assert.strictEqual(bild.kleinUrl('https://images.unsplash.com/x.webp'), null);
  assert.strictEqual(bild.kleinUrl('/uploads/ilanlar/../x.webp'), null);
});

test('bildVarianten: 1200/480 px, WebP, ohne EXIF/GPS', async () => {
  const ein = await handyFoto();
  assert.ok((await sharp(ein).metadata()).exif, 'Testfoto muss EXIF tragen');
  const v = await bild.bildVarianten(ein);
  for (const [buf, kante] of [[v.lg, 1200], [v.sm, 480]]) {
    const m = await sharp(buf).metadata();
    assert.strictEqual(m.format, 'webp');
    assert.strictEqual(Math.max(m.width, m.height), kante);
    assert.ok(!m.exif, 'EXIF muss entfernt sein');
    assert.ok(!m.xmp && !m.iptc);
  }
  assert.ok(v.sm.length < v.lg.length);
});

test('POST mit Handyfoto: _lg und _sm auf der Platte, EXIF weg; Archiv nimmt beide mit', async () => {
  const token = await tokenFuer(TESTKONTO);
  const kat = (await q("SELECT id FROM kategoriler WHERE slug='antika'")).rows[0].id;
  const f = new FormData();
  for (const [k, v] of Object.entries({ baslik: TITEL, aciklama: 'Automatischer Medientest, wird sofort gelöscht.', fiyat: '100',
    kategori_id: String(kat), sehir: 'Aksaray', ilce: 'Merkez', durum: 'kullanilmis' })) f.append(k, v);
  f.append('fotograflar', new Blob([await handyFoto()], { type: 'image/jpeg' }), 'handy.jpg');
  let uuid = null;
  try {
    const r = await api('POST', '/ilanlar', { token, form: f });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    uuid = r.body.ilan.uuid;
    const d = (await api('GET', `/ilanlar/${uuid}`, { token })).body;
    const url = d.fotograflar[0].url;
    assert.match(url, new RegExp(`^/uploads/ilanlar/${uuid}_0_lg\.webp$`));
    const lg = path.join(UP, 'ilanlar', path.basename(url));
    const sm = path.join(UP, 'ilanlar', path.basename(bild.kleinUrl(url)));
    assert.ok(fs.existsSync(lg) && fs.existsSync(sm), 'beide Groessen muessen existieren');
    const mlg = await sharp(lg).metadata(), msm = await sharp(sm).metadata();
    assert.strictEqual(mlg.width, 1200); assert.strictEqual(msm.width, 480);
    assert.ok(!mlg.exif && !msm.exif, 'EXIF/GPS muss entfernt sein');
    const prot = (await q("SELECT count(*)::int n FROM medya_isleri WHERE ilan_uuid=$1 AND tip='bild' AND durum='tamam'", [uuid])).rows[0].n;
    assert.strictEqual(prot, 1, 'synchrones Bild wird protokolliert');
    // Loeschen: beide Dateien wandern ins Archiv, keine Waise bleibt
    const del = await api('DELETE', `/ilanlar/${uuid}`, { token });
    assert.strictEqual(del.status, 200);
    assert.ok(!fs.existsSync(lg) && !fs.existsSync(sm), 'nach dem Loeschen keine Datei mehr unter ilanlar/');
    const a = (await q('SELECT musteri_no FROM ilan_arsiv WHERE ilan_uuid=$1', [uuid])).rows[0];
    assert.ok(fs.existsSync(path.join(UP, 'archiv', a.musteri_no, uuid, path.basename(sm))), '_sm liegt im Archiv');
  } finally {
    if (uuid) { await api('DELETE', `/ilanlar/${uuid}`, { token }); await arsivAufraeumen(uuid); }
  }
});

test('POST mit kaputtem Bild: 400, kein Inserat, Fehler fuer den Admin protokolliert', async () => {
  const token = await tokenFuer(TESTKONTO);
  const vorher = (await q('SELECT count(*)::int n FROM ilanlar WHERE user_id=$1 AND baslik=$2', [TESTKONTO, TITEL])).rows[0].n;
  const f = new FormData();
  for (const [k, v] of Object.entries({ baslik: TITEL, aciklama: 'Kaputtes Bild', fiyat: '100', sehir: 'Aksaray', durum: 'kullanilmis' })) f.append(k, v);
  f.append('fotograflar', new Blob([Buffer.from('das ist kein jpeg '.repeat(50))], { type: 'image/jpeg' }), 'kaputt.jpg');
  const r = await api('POST', '/ilanlar', { token, form: f });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.hata, /Fotoğraf işlenemedi/);
  const nachher = (await q('SELECT count(*)::int n FROM ilanlar WHERE user_id=$1 AND baslik=$2', [TESTKONTO, TITEL])).rows[0].n;
  assert.strictEqual(nachher, vorher, 'kein Geister-Inserat');
  const h = await q("DELETE FROM medya_isleri WHERE user_id=$1 AND tip='bild' AND durum='hata' AND created_at > now() - interval '2 minutes' RETURNING id", [TESTKONTO]);
  assert.ok(h.rows.length >= 1, 'Fehler-Job angelegt');
});

test.after(() => pool.end());
