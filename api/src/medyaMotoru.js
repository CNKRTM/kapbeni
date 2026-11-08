// ════════════════════════════════════════════════════════════════════════════
//  Medya Motoru — eigener Dienst fuer Videos und Bestandsbilder
//  (Auftragssammlung J, v1.28). PM2-Name kapbeni-media, nur 127.0.0.1:3901.
//
//  Muster wie die Cankartım-PDF-Engine: Jobs stehen in der DB (medya_isleri),
//  der Dienst holt sie mit FOR UPDATE SKIP LOCKED ab, hoechstens `paralel`
//  (1–2, Einstellung) gleichzeitig. ffmpeg belegt ~4,6 von 6 Kernen, deshalb
//  nie mehr als 2.
//
//  Zustaende: bekliyor → isleniyor → tamam | hata. Ein Absturz mitten im Job
//  laesst ihn auf 'isleniyor' stehen; beim Start gehen solche Jobs zurueck auf
//  'bekliyor' (hoechstens 3 Versuche).
//
//  HTTP (nur lokal, Bearer-Token MEDYA_MOTORU_TOKEN aus /etc/kapbeni.env):
//    GET  /saglik    ohne Token, nur {ok}
//    GET  /durum     laufende Jobs, Einstellungen
//    POST /uyandir   sofort nach neuen Jobs sehen (sonst alle 5 s)
// ════════════════════════════════════════════════════════════════════════════
require('dotenv').config({ path: '/etc/kapbeni.env' });
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { query, pool } = require('./db/pool');
const medyaAyar = require('./lib/medyaAyar');
const videoLib = require('./lib/video');
const bild = require('./lib/bild');
const { TMP_MEDYA } = require('./lib/medyaIs');

const PORT = Number(process.env.MEDYA_MOTORU_PORT || 3901);
const TOKEN = process.env.MEDYA_MOTORU_TOKEN || '';
const UPLOAD = process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const ILAN_DIR = path.join(UPLOAD, 'ilanlar');
const MAX_VERSUCHE = 3;

let aktiv = 0;
const laufend = new Map();   // jobId -> { tip, seit }
let pumptGerade = false;

class KundenFehler extends Error {
  constructor(technisch, kunde, endgueltig = true) { super(technisch); this.kunde = kunde; this.endgueltig = endgueltig; }
}

// ── Job holen und verteilen ────────────────────────────────────────────────
async function holen() {
  const { rows } = await query(
    `UPDATE medya_isleri SET durum='isleniyor', deneme=deneme+1, basladi_at=now(), hata=NULL
      WHERE id = (SELECT id FROM medya_isleri WHERE durum='bekliyor' AND senkron=false
                   ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`);
  return rows[0] || null;
}

async function pumpe() {
  if (pumptGerade) return;
  pumptGerade = true;
  try {
    const { paralel } = await medyaAyar.ayarlar();
    while (aktiv < Math.min(2, paralel)) {
      const job = await holen();
      if (!job) break;
      aktiv++;
      laufend.set(job.id, { tip: job.tip, seit: Date.now() });
      verarbeiten(job).catch((e) => console.error('[medya] unerwartet', job.id, e)).finally(() => {
        aktiv--; laufend.delete(job.id); setImmediate(pumpe);
      });
    }
  } catch (e) {
    console.error('[medya] pumpe:', e.message);
  } finally { pumptGerade = false; }
}

async function verarbeiten(job) {
  const t0 = Date.now();
  try {
    let erg;
    if (job.tip === 'video') erg = await videoJob(job);
    else if (job.tip === 'bild_sm') erg = await bildSmJob(job);
    else throw new KundenFehler(`Jobtyp ${job.tip} wird hier nicht verarbeitet`, 'İşlem türü desteklenmiyor.');
    await query(`UPDATE medya_isleri SET durum='tamam', hedef=$2, boyut_sonra=$3, sure_ms=$4, bitti_at=now(),
                   hata=NULL, hata_kullanici=NULL, detay=COALESCE(detay,'{}'::jsonb) || $5::jsonb WHERE id=$1`,
      [job.id, erg.hedef || null, erg.boyut || null, Date.now() - t0, JSON.stringify(erg.detay || {})]);
    console.log(`[medya] #${job.id} ${job.tip} fertig in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) {
    const kunde = e.kunde || 'Medya işlenemedi. Lütfen dosyayı yeniden yükleyin.';
    const nochmal = !e.endgueltig && job.deneme < MAX_VERSUCHE;
    console.error(`[medya] #${job.id} ${job.tip} Fehler (Versuch ${job.deneme}${nochmal ? ', wird wiederholt' : ''}):`, e.message);
    await query(`UPDATE medya_isleri SET durum=$2::varchar, hata=$3, hata_kullanici=$4, sure_ms=$5, bitti_at=CASE WHEN $2::varchar='hata' THEN now() END WHERE id=$1`,
      [job.id, nochmal ? 'bekliyor' : 'hata', String(e.message).slice(0, 1000), kunde, Date.now() - t0]);
    // Bestandsarbeiten melden nichts an Kunden — der Admin sieht den Fehler.
    if (!nochmal && job.tip === 'video' && !(job.detay && job.detay.bestand)) await videoFehlerMelden(job, kunde);
    else if (!nochmal && job.tip === 'video')
      await query(`UPDATE ilanlar SET video_durum=CASE WHEN video_url IS NOT NULL THEN 'tamam' ELSE 'hata' END, video_is_id=NULL WHERE id=$1 AND video_is_id=$2`, [job.ilan_id, job.id]).catch(() => {});
  }
}

// ── Video ──────────────────────────────────────────────────────────────────
function imVerzeichnis(datei, dir) {
  const voll = path.resolve(datei || '');
  return voll.startsWith(path.resolve(dir) + path.sep) ? voll : null;
}
function weg(datei) { try { if (datei && fs.existsSync(datei)) fs.unlinkSync(datei); } catch { /* schon weg */ } }

async function videoJob(job) {
  const ayar = await medyaAyar.ayarlar();
  const quelle = imVerzeichnis(job.kaynak, TMP_MEDYA());
  if (!quelle || !fs.existsSync(quelle))
    throw new KundenFehler('Rohdatei fehlt: ' + job.kaynak, 'Video dosyası sunucuda bulunamadı. Lütfen videoyu yeniden yükleyin.');

  const { rows: il } = await query('SELECT id, uuid, video_is_id FROM ilanlar WHERE id=$1', [job.ilan_id]);
  if (!il[0] || il[0].video_is_id !== job.id) {
    // Inserat geloescht oder Video inzwischen ersetzt/entfernt: nichts mehr zu tun.
    weg(quelle);
    return { detay: { verworfen: il[0] ? 'ueberholt' : 'ilan_silindi' } };
  }
  const uuid = il[0].uuid;

  let probe;
  try { probe = await videoLib.pruefen(quelle); }
  catch (e) { throw new KundenFehler('ffprobe: ' + e.message, 'Video dosyası okunamadı: dosya bozuk ya da desteklenmeyen bir biçimde.'); }
  // Bestandsvideos (Skript --video) behalten ihre Laenge: die 60-s-Grenze gilt
  // fuer neue Uploads, ein vorhandenes Inserat wird nicht nachtraeglich beschnitten.
  const bestand = !!(job.detay && job.detay.bestand);
  if (!bestand && probe.dauer > ayar.video_max_sn + 0.5)
    throw new KundenFehler(`zu lang: ${probe.dauer.toFixed(1)} s`, `Video en fazla ${ayar.video_max_sn} saniye olabilir.`);

  fs.mkdirSync(TMP_MEDYA(), { recursive: true });
  const name = `${uuid}_video_${job.id}.mp4`;
  const posterName = `${uuid}_poster_${job.id}.webp`;
  const tmpVideo = path.join(TMP_MEDYA(), `aus_${name}`);
  const tmpPoster = path.join(TMP_MEDYA(), `aus_${posterName}`);
  try {
    try {
      await videoLib.umrechnen(quelle, tmpVideo, { hoehe: ayar.video_yukseklik, crf: ayar.video_crf, sesKbit: ayar.video_ses_kbit });
    } catch (e) {
      // Zeitgrenze kann an Last liegen → wiederholen; alles andere ist die Datei.
      const zeit = /Zeitgrenze/.test(e.message);
      throw new KundenFehler('ffmpeg: ' + e.message,
        zeit ? 'Video işleme zaman aşımına uğradı. Tekrar denenecek.' : 'Video işlenemedi: dosya bozuk ya da desteklenmeyen bir biçimde.', !zeit);
    }
    let posterBuf;
    try {
      const roh = await videoLib.posterRoh(tmpVideo, probe.dauer);
      posterBuf = await sharp(roh).resize(1280, 720, { fit: 'inside', withoutEnlargement: true }).webp({ quality: ayar.lg_q }).toBuffer();
    } catch (e) { throw new KundenFehler('Poster: ' + e.message, 'Videodan önizleme görseli oluşturulamadı.'); }
    fs.writeFileSync(tmpPoster, posterBuf);

    // Erst an den Zielort legen (noch von keiner Zeile referenziert), dann in
    // EINER Transaktion eintragen. Scheitert das, werden die Dateien entfernt.
    const zielVideo = path.join(ILAN_DIR, name);
    const zielPoster = path.join(ILAN_DIR, posterName);
    fs.renameSync(tmpVideo, zielVideo);
    fs.renameSync(tmpPoster, zielPoster);
    const db = await pool.connect();
    let alt = null; let uebernommen = false;
    try {
      await db.query('BEGIN');
      const { rows } = await db.query('SELECT id, video_is_id, video_url, video_poster_url, ilan_durum FROM ilanlar WHERE id=$1 FOR UPDATE', [job.ilan_id]);
      if (rows[0] && rows[0].video_is_id === job.id) {
        alt = rows[0];
        await db.query(`UPDATE ilanlar SET video_url=$2, video_poster_url=$3, has_video=true, video_durum='tamam', video_hata=NULL, updated_at=NOW() WHERE id=$1`,
          [job.ilan_id, `/uploads/ilanlar/${name}`, `/uploads/ilanlar/${posterName}`]);
        uebernommen = true;
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      weg(zielVideo); weg(zielPoster);
      throw new KundenFehler('DB: ' + e.message, 'Video kaydedilemedi. Tekrar denenecek.', false);
    } finally { db.release(); }

    if (!uebernommen) { weg(zielVideo); weg(zielPoster); weg(quelle); return { detay: { verworfen: 'ueberholt' } }; }
    // Altes Video/Poster erst NACH dem COMMIT entfernen (nur eigene Dateien des Inserats).
    for (const u of [alt.video_url, alt.video_poster_url]) {
      if (!u || !u.startsWith('/uploads/ilanlar/')) continue;
      const n = path.basename(u);
      if (!n.startsWith(`${uuid}_`) || n === name || n === posterName) continue;
      weg(path.join(ILAN_DIR, n));
    }
    weg(quelle);
    try { await require('./lib/meiliSync').syncListing(uuid); } catch { /* Suche zieht nachts nach */ }
    const groesse = fs.statSync(zielVideo).size + posterBuf.length;
    return { hedef: `/uploads/ilanlar/${name}`, boyut: groesse,
      detay: { poster: `/uploads/ilanlar/${posterName}`, dauer: Math.round(probe.dauer * 10) / 10, quelle_hoehe: probe.hoehe, video: fs.statSync(zielVideo).size } };
  } finally {
    weg(tmpVideo); weg(tmpPoster);
  }
}

async function videoFehlerMelden(job, kunde) {
  try {
    const { rows } = await query(`UPDATE ilanlar SET video_durum='hata', video_hata=$2 WHERE id=$1 AND video_is_id=$3 RETURNING uuid, baslik, user_id`,
      [job.ilan_id, kunde, job.id]);
    if (!rows[0]) return;
    await query(`INSERT INTO bildirimler(user_id, tip, baslik, icerik, link) VALUES($1,'medya',$2,$3,$4)`,
      [rows[0].user_id, 'Video işlenemedi', `"${String(rows[0].baslik).slice(0, 80)}" ilanınızın videosu işlenemedi. ${kunde}`, `/#/ilan/${rows[0].uuid}`]);
  } catch (e) { console.error('[medya] Meldung fehlgeschlagen:', e.message); }
}

// ── Bestandsbild: _sm aus _lg nachziehen (auch fuer „Tekrar dene") ─────────
async function bildSmJob(job) {
  const url = String(job.kaynak || '');
  const klein = bild.kleinUrl(url);
  if (!klein || klein === url) throw new KundenFehler('keine eigene Bilddatei: ' + url, 'Görsel bulunamadı.');
  const quelle = path.join(ILAN_DIR, path.basename(url));
  if (!fs.existsSync(quelle)) throw new KundenFehler('Quelldatei fehlt', 'Görsel bulunamadı.');
  const sm = await bild.kleinAusGross(fs.readFileSync(quelle), await medyaAyar.bildAyar());
  fs.writeFileSync(path.join(ILAN_DIR, path.basename(klein)), sm);
  return { hedef: klein, boyut: sm.length };
}

// ── Aufraeumen: Rohdateien fehlgeschlagener Jobs nach 7 Tagen, Waisen nach 1 Tag
async function aufraeumen() {
  try {
    const dir = TMP_MEDYA();
    if (!fs.existsSync(dir)) return;
    const { rows } = await query(`SELECT kaynak, durum, bitti_at FROM medya_isleri WHERE tip='video' AND kaynak IS NOT NULL AND durum IN ('bekliyor','isleniyor','hata')`);
    const behalten = new Map(rows.map((r) => [path.resolve(r.kaynak), r]));
    for (const n of fs.readdirSync(dir)) {
      const voll = path.join(dir, n);
      const alterH = (Date.now() - fs.statSync(voll).mtimeMs) / 3600000;
      const r = behalten.get(path.resolve(voll));
      if (!r && alterH > 24) weg(voll);
      else if (r && r.durum === 'hata' && alterH > 24 * 7) weg(voll);
    }
  } catch (e) { console.error('[medya] aufraeumen:', e.message); }
}

// ── HTTP ───────────────────────────────────────────────────────────────────
function tokenOk(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!TOKEN || !t || t.length !== TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));
}
const server = http.createServer(async (req, res) => {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/saglik') return json(200, { ok: true });
  if (!tokenOk(req)) return json(401, { hata: 'yetkisiz' });
  if (req.method === 'POST' && req.url === '/uyandir') { setImmediate(pumpe); return json(200, { ok: true }); }
  if (req.method === 'GET' && req.url === '/durum') {
    return json(200, { ok: true, aktiv, laufend: [...laufend].map(([id, l]) => ({ id, tip: l.tip, sn: Math.round((Date.now() - l.seit) / 1000) })),
      ayar: await medyaAyar.ayarlar(), pid: process.pid, seit: Math.round(process.uptime()) });
  }
  return json(404, { hata: 'yok' });
});

(async () => {
  if (!TOKEN) console.warn('[medya] MEDYA_MOTORU_TOKEN fehlt — HTTP-Steuerung gesperrt, Jobs laufen trotzdem.');
  fs.mkdirSync(TMP_MEDYA(), { recursive: true });
  // Absturz-Rest: halb verarbeitete Jobs zurueck in die Schlange.
  const r = await query(`UPDATE medya_isleri SET durum='bekliyor' WHERE durum='isleniyor' AND senkron=false RETURNING id`);
  if (r.rows.length) console.log('[medya] zurueckgestellt:', r.rows.map((x) => x.id).join(','));
  server.listen(PORT, '127.0.0.1', () => console.log(`[medya] Medya Motoru auf 127.0.0.1:${PORT}`));
  setInterval(pumpe, 5000);
  setInterval(aufraeumen, 3600 * 1000);
  aufraeumen();
  pumpe();
})().catch((e) => { console.error('[medya] Start fehlgeschlagen:', e); process.exit(1); });

// PM2 reload: laufende ffmpeg-Prozesse nicht abwuergen, sondern Jobs zurueckstellen.
process.on('SIGINT', async () => {
  try { if (laufend.size) await query(`UPDATE medya_isleri SET durum='bekliyor', deneme=GREATEST(deneme-1,0) WHERE id = ANY($1::int[]) AND durum='isleniyor'`, [[...laufend.keys()]]); } catch { /* egal */ }
  process.exit(0);
});
