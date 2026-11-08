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

// ── Video (v1.28): Engine kapbeni-media muss laufen ──────────────────────
const { execFileSync } = require('child_process');
const os = require('os');
function testVideo(sekunden, groesse = '320x240') {
  const ziel = path.join(os.tmpdir(), `kp-test-${sekunden}s-${groesse}.mp4`);
  if (!fs.existsSync(ziel))
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `testsrc=s=${groesse}:r=15:d=${sekunden}`, '-f', 'lavfi', '-i', `sine=d=${sekunden}`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', ziel]);
  return fs.readFileSync(ziel);
}
async function inseratMitVideo(token, video) {
  const kat = (await q("SELECT id FROM kategoriler WHERE slug='antika'")).rows[0].id;
  const f = new FormData();
  for (const [k, v] of Object.entries({ baslik: TITEL, aciklama: 'Automatischer Videotest, wird sofort gelöscht.', fiyat: '100',
    kategori_id: String(kat), sehir: 'Aksaray', ilce: 'Merkez', durum: 'kullanilmis' })) f.append(k, v);
  f.append('fotograflar', new Blob([await handyFoto()], { type: 'image/jpeg' }), 'handy.jpg');
  f.append('video', new Blob([video], { type: 'video/mp4' }), 'test.mp4');
  return api('POST', '/ilanlar', { token, form: f });
}
async function warteAufJob(id, sek = 90) {
  for (let i = 0; i < sek; i++) {
    const r = (await q('SELECT * FROM medya_isleri WHERE id=$1', [id])).rows[0];
    if (r && (r.durum === 'tamam' || r.durum === 'hata')) return r;
    await new Promise((x) => setTimeout(x, 1000));
  }
  throw new Error(`Job ${id} nicht fertig geworden`);
}

test('Video laenger als 60 s: 400 schon vor dem Anlegen', async () => {
  const token = await tokenFuer(TESTKONTO);
  const vorher = (await q('SELECT count(*)::int n FROM ilanlar WHERE user_id=$1 AND baslik=$2', [TESTKONTO, TITEL])).rows[0].n;
  const r = await inseratMitVideo(token, testVideo(65, '160x120'));
  assert.strictEqual(r.status, 400, JSON.stringify(r.body));
  assert.match(r.body.hata, /en fazla 60 saniye/);
  const nachher = (await q('SELECT count(*)::int n FROM ilanlar WHERE user_id=$1 AND baslik=$2', [TESTKONTO, TITEL])).rows[0].n;
  assert.strictEqual(nachher, vorher);
});

test('Video: Job → 720p H.264/AAC/faststart + WebP-Poster; kaputte Datei → hata + Meldung', async () => {
  const motor = await fetch('http://127.0.0.1:3901/saglik').then((x) => x.json()).catch(() => null);
  assert.ok(motor && motor.ok, 'kapbeni-media laeuft nicht');
  const token = await tokenFuer(TESTKONTO);
  let uuid = null;
  try {
    const r = await inseratMitVideo(token, testVideo(3, '1920x1080'));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    uuid = r.body.ilan.uuid;
    assert.strictEqual(r.body.ilan.video_durum, 'isleniyor');
    let d = (await api('GET', `/ilanlar/${uuid}`, { token })).body;
    assert.ok(!d.video_url || d.video_durum === 'tamam', 'vor dem Ende kein halbes Video');
    const job = (await q("SELECT id FROM medya_isleri WHERE ilan_uuid=$1 AND tip='video' ORDER BY id DESC LIMIT 1", [uuid])).rows[0];
    const fertig = await warteAufJob(job.id);
    assert.strictEqual(fertig.durum, 'tamam', fertig.hata || '');
    d = (await api('GET', `/ilanlar/${uuid}`, { token })).body;
    assert.strictEqual(d.video_durum, 'tamam');
    assert.strictEqual(d.has_video, true);
    assert.match(d.video_url, new RegExp(`${uuid}_video_${job.id}\\.mp4$`));
    assert.match(d.video_poster_url, /_poster_\d+\.webp$/);
    const vPfad = path.join(UP, 'ilanlar', path.basename(d.video_url));
    const pPfad = path.join(UP, 'ilanlar', path.basename(d.video_poster_url));
    assert.ok(fs.existsSync(pPfad), 'Poster fehlt');
    assert.strictEqual((await sharp(pPfad).metadata()).format, 'webp');
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', vPfad]).toString());
    const v = info.streams.find((x) => x.codec_type === 'video'), a = info.streams.find((x) => x.codec_type === 'audio');
    assert.strictEqual(v.codec_name, 'h264'); assert.strictEqual(v.height, 720); assert.strictEqual(v.pix_fmt, 'yuv420p');
    assert.strictEqual(a.codec_name, 'aac');
    const kopf = fs.readFileSync(vPfad).subarray(0, 64 * 1024).toString('latin1');
    assert.ok(kopf.indexOf('moov') > -1 && (kopf.indexOf('mdat') === -1 || kopf.indexOf('moov') < kopf.indexOf('mdat')), 'faststart: moov vor mdat');
    assert.ok(!fs.readdirSync(path.join(UP, 'tmp', 'medya')).some((n) => n.startsWith(uuid)), 'Rohdatei weggeraeumt');

    // Kaputte Datei: Job direkt anlegen (die API laesst sie gar nicht erst durch)
    const kaputt = path.join(UP, 'tmp', 'medya', `${uuid}_kaputt.mp4`);
    fs.writeFileSync(kaputt, Buffer.from('kein video '.repeat(100)));
    const ilanId = (await q('SELECT id FROM ilanlar WHERE uuid=$1', [uuid])).rows[0].id;
    const j2 = (await q(`INSERT INTO medya_isleri(tip,ilan_id,ilan_uuid,user_id,kaynak) VALUES('video',$1,$2,$3,$4) RETURNING id`, [ilanId, uuid, TESTKONTO, kaputt])).rows[0].id;
    await q("UPDATE ilanlar SET video_is_id=$1, video_durum='isleniyor' WHERE id=$2", [j2, ilanId]);
    await fetch('http://127.0.0.1:3901/uyandir', { method: 'POST', headers: { Authorization: `Bearer ${process.env.MEDYA_MOTORU_TOKEN}` } });
    const f2 = await warteAufJob(j2, 30);
    assert.strictEqual(f2.durum, 'hata');
    assert.match(f2.hata_kullanici, /okunamadı|işlenemedi/);
    d = (await api('GET', `/ilanlar/${uuid}`, { token })).body;
    assert.strictEqual(d.video_durum, 'hata');
    assert.ok(d.video_hata, 'Eigentuemer sieht die Meldung');
    assert.ok(d.video_url, 'das fertige Video bleibt erhalten');
    const fremd = (await api('GET', `/ilanlar/${uuid}`)).body;
    assert.strictEqual(fremd.video_hata, undefined, 'Fremde sehen keine Fehlermeldung');
    const b = await q("DELETE FROM bildirimler WHERE user_id=$1 AND tip='medya' AND link LIKE $2 RETURNING id", [TESTKONTO, `%${uuid}%`]);
    assert.strictEqual(b.rows.length, 1, 'Kunde bekommt eine Benachrichtigung');
    fs.rmSync(kaputt, { force: true });
  } finally {
    if (uuid) { await api('DELETE', `/ilanlar/${uuid}`, { token }); await arsivAufraeumen(uuid); }
  }
});

test.after(() => pool.end());
