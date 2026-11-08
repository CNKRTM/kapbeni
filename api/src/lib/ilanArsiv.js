// ════════════════════════════════════════════════════════════════════════════
//  Archiv beendeter Inserate (Auftragssammlung G).
//
//  Solange ein Inserat existiert, zeigt der Admin die Bilder direkt aus dem
//  Inserat (ilan_fotograflar.url). Erst wenn es endet — geloescht, abgelehnt,
//  vom Admin entfernt oder bei der Kontoschliessung — entsteht EIN Snapshot in
//  ilan_arsiv, und die Dateien liegen danach unter
//      <UPLOAD_DIR>/archiv/<musteri_no>/<ilan-uuid>/<datei>
//  Dieser Pfad wird nie oeffentlich ausgeliefert (API-Static sperrt
//  /uploads/archiv, nginx ebenso); der Admin liest ihn ueber eine
//  authentifizierte Route (admin/server.js, /admin/api/arsiv/dosya/…).
//
//  Loeschen = verschieben (die Zeile verschwindet), Ablehnen = kopieren (die
//  Zeile bleibt, der Eigentuemer sieht sein abgelehntes Inserat weiter).
//
//  ilanSilVeArsivle() ist der EINE Loeschweg fuer Eigentuemer (routes/ilanlar.js),
//  SPA-Admin (routes/admin.js) und Express-Admin (admin/server.js). Er behaelt
//  alle Sicherungen der frueheren Handler: Besitzpruefung, 409 bei offener
//  Transaktion, Belege behalten ihre Zeile (ilan_id=NULL), Gebote gehen mit,
//  Dateien erst nach dem COMMIT, Meili-Delete, audit_log.
//  Aufbewahrung 2 Jahre -> eskileriSil() (Cron).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { query, pool, auditLog } = require('../db/pool');

const SAKLAMA_GUN = 730;
const UPLOAD = () => process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const ARSIV = () => path.join(UPLOAD(), 'archiv');
const ILAN_DIR = () => path.join(UPLOAD(), 'ilanlar');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFEN = ['odeme_bekleniyor', 'aktif', 'askida', 'kargoya_verildi', 'itiraz_acildi'];
// Sieben Fremdschluessel auf ilanlar stehen auf NO ACTION. Geschaeftsunterlagen
// behalten ihre Zeile und verlieren nur den Verweis; Gebote gehen mit; der Rest
// (Fotos, Favoriten, Chats, Warenkorb, Merkmale, Beobachter) per CASCADE.
const LOESEN = ['odemeler', 'payments', 'islemler', 'degerlendirmeler', 'ilan_sikayetler', 'ilan_vitaminler', 'support_tickets'];

const ordnerName = (s) => String(s || 'ohne-nummer').replace(/[^A-Za-z0-9-]/g, '').slice(0, 30) || 'ohne-nummer';

/** Relativer Archivpfad fuer eine Inseratsdatei — oder null (externes Bild,
 *  fremde Datei). Dieselbe Schranke wie beim frueheren Loeschen: der Dateiname
 *  MUSS mit der uuid des Inserats beginnen, sonst liesse sich ueber foto_url
 *  die Datei eines fremden Inserats ins eigene Archiv ziehen. */
function arsivPfad(url, uuid, musteriNo) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/ilanlar/')) return null;
  const name = path.basename(url);
  if (!name.startsWith(`${uuid}_`)) return null;
  return `${ordnerName(musteriNo)}/${uuid}/${name}`;
}

/** Alle Daten fuer den Snapshot lesen (vor dem Loeschen, innerhalb der Transaktion). */
async function snapshotLesen(db, ilanId) {
  const { rows } = await db.query(
    `SELECT i.*, k.ad AS kategori_ad, u.musteri_no
       FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id LEFT JOIN users u ON u.id=i.user_id
      WHERE i.id=$1`, [ilanId]);
  const i = rows[0];
  if (!i) return null;
  const { rows: fotos } = await db.query('SELECT url FROM ilan_fotograflar WHERE ilan_id=$1 ORDER BY sira, id', [ilanId]);
  const { rows: oz } = await db.query(
    `SELECT t.alan_adi, t.etiket, v.deger FROM ilan_ozellik_degerleri v JOIN kategori_ozellik_tanimlari t ON t.id=v.tanim_id
      WHERE v.ilan_id=$1 ORDER BY (t.alan_adi='marka') DESC, t.sira, t.id`, [ilanId]);
  return { ilan: i, fotos: fotos.map((f) => f.url), ozellikler: oz };
}

/** Snapshot-Zeile schreiben. `snap` aus snapshotLesen(). Liefert { id, dateien } —
 *  dateien = [[quelle, ziel]] zum Verschieben/Kopieren NACH dem Commit. */
async function snapshotYaz(db, snap, { grund, grundDetay = null, kaynak, adminId = null, ip = null }) {
  const i = snap.ilan;
  const dateien = [];
  const eintrag = (url) => {
    const rel = arsivPfad(url, i.uuid, i.musteri_no);
    if (rel) dateien.push([path.join(ILAN_DIR(), path.basename(url)), path.join(ARSIV(), rel)]);
    // Kleine Variante (v1.27) wandert still mit, damit keine _sm-Waise liegen
    // bleibt; im Snapshot steht weiter nur die grosse Datei.
    const klein = require('./bild').kleinUrl(url);
    const relK = klein && klein !== url ? arsivPfad(klein, i.uuid, i.musteri_no) : null;
    if (relK) dateien.push([path.join(ILAN_DIR(), path.basename(klein)), path.join(ARSIV(), relK)]);
    return { url, arsiv: rel };
  };
  const bilder = snap.fotos.map(eintrag);
  const video = i.video_url ? eintrag(i.video_url) : null;
  const marka = (snap.ozellikler.find((o) => o.alan_adi === 'marka') || {}).deger || null;
  const { rows } = await db.query(
    `INSERT INTO ilan_arsiv(ilan_uuid,ilan_id,ilan_no,user_id,musteri_no,baslik,aciklama,fiyat,kategori_id,kategori_ad,marka,durum,
       sehir,ilce,ilan_durum_onceki,bilder,video,ozellikler,grund,grund_detay,kaynak,admin_id,ip,ilan_created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
    [i.uuid, i.id, i.ilan_no || i.ilan_numarasi || null, i.user_id, i.musteri_no, i.baslik, i.aciklama, i.fiyat, i.kategori_id,
     i.kategori_ad, marka, i.durum, i.sehir, i.ilce, i.ilan_durum, JSON.stringify(bilder), video ? JSON.stringify(video) : null,
     JSON.stringify(snap.ozellikler), grund, grundDetay, kaynak, adminId, ip ? String(ip).slice(0, 45) : null, i.created_at]);
  return { id: rows[0].id, dateien };
}

/** Dateien ins Archiv bringen (nach dem COMMIT). kopieren=true laesst das Original liegen. */
function dateienUebertragen(dateien, { kopieren = false } = {}) {
  let n = 0;
  for (const [quelle, ziel] of dateien) {
    try {
      if (path.dirname(quelle) !== ILAN_DIR() || !ziel.startsWith(ARSIV() + path.sep)) continue;
      if (!fs.existsSync(quelle)) continue;
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      if (kopieren) fs.copyFileSync(quelle, ziel);
      else {
        try { fs.renameSync(quelle, ziel); }
        catch { fs.copyFileSync(quelle, ziel); fs.unlinkSync(quelle); }   // anderes Dateisystem
      }
      n++;
    } catch (e) { console.error('[arsiv] Datei', path.basename(quelle), e.message); }
  }
  return n;
}

/**
 * Ein Inserat endgueltig entfernen und archivieren.
 * opts: uuid, sahipId (Besitzpruefung; null = Admin), grund, grundDetay, kaynak,
 *       adminId, ip, audit: { kaynak, userId, adminId }.
 * Liefert { status, hata } bei Ablehnung oder { ok, ilan_id, arsiv_id, dateien }.
 */
async function ilanSilVeArsivle({ uuid, sahipId = null, grund = 'silindi', grundDetay = null, kaynak = 'kullanici', adminId = null, ip = null, audit = {} }) {
  const k = String(uuid || '');
  if (!UUID_RE.test(k)) return { status: 404, hata: 'İlan bulunamadı' };
  // Existenz ueber den Pool, nicht ueber die eigene Verbindung (Doppel-release-Absturz, s. CLAUDE.md 12.09.)
  const vorab = await query(`SELECT id, user_id FROM ilanlar WHERE uuid=$1${sahipId != null ? ' AND user_id=$2' : ''}`,
    sahipId != null ? [k, sahipId] : [k]);
  if (!vorab.rows[0]) return { status: 404, hata: 'İlan bulunamadı' };
  const ilanId = vorab.rows[0].id;

  const c = await pool.connect();
  let ergebnis;
  try {
    await c.query('BEGIN');
    await c.query('SELECT id FROM ilanlar WHERE id=$1 FOR UPDATE', [ilanId]);
    // Ein laufendes Geschaeft darf nicht verschwinden (Vorgang fiele fuer Kaeufer
    // und Verkaeufer aus /islemler/benim, Chat ginge per CASCADE mit).
    const offen = await c.query('SELECT COUNT(*)::int AS n FROM islemler WHERE ilan_id=$1 AND durum = ANY($2::text[])', [ilanId, OFFEN]);
    if (offen.rows[0].n > 0) {
      await c.query('ROLLBACK');
      return { status: 409, hata: 'Bu ilan için devam eden bir işlem var. İşlem tamamlanmadan ilan silinemez.' };
    }
    const snap = await snapshotLesen(c, ilanId);
    const arsiv = await snapshotYaz(c, snap, { grund, grundDetay, kaynak, adminId, ip });
    for (const t of LOESEN) await c.query(`UPDATE ${t} SET ilan_id=NULL WHERE ilan_id=$1`, [ilanId]);
    await c.query('DELETE FROM teklifler WHERE ilan_id=$1', [ilanId]);
    await c.query('DELETE FROM ilanlar WHERE id=$1', [ilanId]);
    await c.query('COMMIT');
    ergebnis = { snap, arsiv };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  // Dateien erst nach dem COMMIT — ein Rollback soll keine Bilder kosten.
  const n = dateienUebertragen(ergebnis.arsiv.dateien, { kopieren: false });
  try { await require('./meiliSync').deleteListing(k); } catch { /* Index folgt spaeter */ }
  await auditLog('ilan.sil', audit.kaynak || (kaynak === 'kullanici' ? 'api' : 'admin'), {
    userId: audit.userId || null, adminId: audit.adminId || null, hedefTip: 'ilan', hedefId: ilanId, ip,
    detay: { uuid: k, baslik: ergebnis.snap.ilan.baslik, grund, arsiv_id: ergebnis.arsiv.id, dateien: n } });
  return { ok: true, ilan_id: ilanId, user_id: ergebnis.snap.ilan.user_id, arsiv_id: ergebnis.arsiv.id, dateien: n };
}

/** Inserat bleibt bestehen (z. B. abgelehnt): Snapshot + Kopie der Dateien. */
async function ilanKopieArsivle(ilanId, { grund, grundDetay = null, kaynak = 'admin', adminId = null, ip = null }) {
  const snap = await snapshotLesen({ query }, ilanId);
  if (!snap) return null;
  const arsiv = await snapshotYaz({ query }, snap, { grund, grundDetay, kaynak, adminId, ip });
  const n = dateienUebertragen(arsiv.dateien, { kopieren: true });
  return { arsiv_id: arsiv.id, dateien: n };
}

/** Kontoschliessung: alle Inserate des Kontos archivieren, Dateien verschieben,
 *  Fotozeilen entfernen (die Inseratszeilen bleiben fuer Belege bestehen). */
async function kontoArsivle(userId) {
  const { rows } = await query('SELECT id FROM ilanlar WHERE user_id=$1', [userId]);
  let n = 0;
  for (const { id } of rows) {
    const snap = await snapshotLesen({ query }, id);
    if (!snap) continue;
    const arsiv = await snapshotYaz({ query }, snap, { grund: 'hesap_kapatildi', kaynak: 'cron' });
    await query('DELETE FROM ilan_fotograflar WHERE ilan_id=$1', [id]);
    await query('UPDATE ilanlar SET video_url=NULL, has_video=false WHERE id=$1', [id]);
    dateienUebertragen(arsiv.dateien, { kopieren: false });
    n++;
  }
  return n;
}

/** Absoluter Pfad einer Archivdatei (fuer die Admin-Route) oder null. */
function dosyaYolu(rel) {
  if (!rel || typeof rel !== 'string') return null;
  const ziel = path.resolve(ARSIV(), rel);
  if (!ziel.startsWith(ARSIV() + path.sep)) return null;
  return fs.existsSync(ziel) ? ziel : null;
}

/** 2 Jahre: Snapshots und ihre Dateien loeschen (Cron). */
async function eskileriSil() {
  const { rows } = await query(`DELETE FROM ilan_arsiv WHERE created_at < NOW() - ($1 || ' days')::interval RETURNING bilder, video, ilan_uuid`, [String(SAKLAMA_GUN)]);
  for (const r of rows) {
    const pfade = [...(r.bilder || []), r.video].filter((x) => x && x.arsiv).map((x) => x.arsiv);
    for (const rel of pfade) {
      // Nur loeschen, wenn kein juengerer Snapshot dieselbe Datei fuehrt (abgelehnt -> spaeter geloescht)
      const { rows: noch } = await query(`SELECT 1 FROM ilan_arsiv WHERE bilder @> $1::jsonb OR video @> $2::jsonb LIMIT 1`,
        [JSON.stringify([{ arsiv: rel }]), JSON.stringify({ arsiv: rel })]);
      if (noch.length) continue;
      const p = dosyaYolu(rel);
      if (p) try { fs.unlinkSync(p); } catch {}
    }
    for (const rel of pfade) { try { fs.rmdirSync(path.dirname(path.resolve(ARSIV(), rel))); } catch {} }
  }
  return rows.length;
}

module.exports = { ilanSilVeArsivle, ilanKopieArsivle, kontoArsivle, snapshotLesen, snapshotYaz, dateienUebertragen,
  arsivPfad, dosyaYolu, eskileriSil, SAKLAMA_GUN, ARSIV };
