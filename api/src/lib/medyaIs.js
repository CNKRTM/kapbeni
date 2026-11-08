// ════════════════════════════════════════════════════════════════════════════
//  Jobs fuer die Medien-Engine kapbeni-media anlegen (Auftragssammlung J, v1.28).
//
//  Ablauf beim Video (API-Seite):
//    1. multer legt die Rohdatei unter uploads/tmp/ ab, ffprobe prueft Inhalt
//       und Laenge VOR dem INSERT (medienPruefen in routes/ilanlar.js).
//    2. In DERSELBEN Transaktion wie das Inserat: Job-Zeile 'bekliyor',
//       ilanlar.video_durum='isleniyor', ilanlar.video_is_id=<job>.
//    3. Erst nach dem COMMIT wird die Rohdatei nach uploads/tmp/medya/
//       verschoben (rename, gleiches Dateisystem) und die Engine geweckt.
//  Scheitert Schritt 3, steht der Job auf 'hata' mit verstaendlicher Meldung —
//  das Inserat bleibt (ohne Video) bestehen, kein Geister-Inserat.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const http = require('http');
const { query } = require('../db/pool');

const TMP_MEDYA = () => path.join(process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads', 'tmp', 'medya');
const MOTOR_PORT = Number(process.env.MEDYA_MOTORU_PORT || 3901);

/** Job innerhalb der laufenden Transaktion anlegen. db = Client mit BEGIN. */
async function videoJobAnlegen(db, { ilan, userId, datei, probe }) {
  const endung = (path.extname(datei.originalname || '') || '.bin').replace(/[^.a-z0-9]/gi, '').slice(0, 6) || '.bin';
  const rohPfad = path.join(TMP_MEDYA(), `${ilan.uuid}_${Date.now()}_${Math.round(Math.random() * 1e6)}${endung}`);
  const { rows } = await db.query(
    `INSERT INTO medya_isleri(tip,durum,ilan_id,ilan_uuid,user_id,kaynak,boyut_once,detay)
     VALUES('video','bekliyor',$1,$2,$3,$4,$5,$6) RETURNING id`,
    [ilan.id, ilan.uuid, userId, rohPfad, datei.size || null,
     JSON.stringify({ dauer: probe ? Math.round(probe.dauer * 10) / 10 : null, breite: probe?.breite, hoehe: probe?.hoehe,
                      mime: datei.mimetype, ad: String(datei.originalname || '').slice(0, 120) })]);
  const jobId = rows[0].id;
  await db.query(`UPDATE ilanlar SET video_durum='isleniyor', video_hata=NULL, video_is_id=$1 WHERE id=$2`, [jobId, ilan.id]);
  return { jobId, rohPfad, quelle: datei.path };
}

/** Nach dem COMMIT: Rohdatei in das Engine-Verzeichnis schieben, Engine wecken. */
async function nachCommit(job) {
  if (!job) return;
  try {
    fs.mkdirSync(TMP_MEDYA(), { recursive: true });
    fs.renameSync(job.quelle, job.rohPfad);
  } catch (e) {
    console.error('[medya] Rohdatei nicht uebernommen:', e.message);
    const msg = 'Video sunucuya aktarılamadı. Lütfen videoyu yeniden yükleyin.';
    await query(`UPDATE medya_isleri SET durum='hata', hata=$2, hata_kullanici=$3, bitti_at=now() WHERE id=$1`,
      [job.jobId, 'rename: ' + e.message, msg]).catch(() => {});
    await query(`UPDATE ilanlar SET video_durum='hata', video_hata=$2 WHERE video_is_id=$1`, [job.jobId, msg]).catch(() => {});
    return;
  }
  motorWecken();
}

/** Engine anstossen (sie pollt ohnehin alle 5 s — das hier verkuerzt nur die Wartezeit). */
function motorWecken() {
  const token = process.env.MEDYA_MOTORU_TOKEN;
  if (!token) return;
  const req = http.request({ host: '127.0.0.1', port: MOTOR_PORT, path: '/uyandir', method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Length': 0 }, timeout: 2000 });
  req.on('error', () => { /* Engine aus: Job wartet in der DB */ });
  req.on('timeout', () => req.destroy());
  req.end();
}

module.exports = { videoJobAnlegen, nachCommit, motorWecken, TMP_MEDYA, MOTOR_PORT };
