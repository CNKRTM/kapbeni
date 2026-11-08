// ════════════════════════════════════════════════════════════════════════════
//  Medien-Engine: Einstellungen und Job-Protokoll (Auftragssammlung I/J).
//
//  Von drei Prozessen benutzt: API (Upload), kapbeni-media (Engine) und Admin
//  (Seite SİSTEM → Medya Motoru). Werte stehen in medya_ayarlari; was dort
//  fehlt, kommt aus STANDARD. Jeder Wert wird beim Lesen auf seinen erlaubten
//  Bereich begrenzt — ein Tippfehler im Admin kann so nie 20-Minuten-Videos
//  oder 5000-px-Bilder freischalten. Cache 10 s je Prozess.
// ════════════════════════════════════════════════════════════════════════════
const { query } = require('../db/pool');

const STANDARD = {
  lg_px: 1200, lg_q: 75, sm_px: 480, sm_q: 70,
  video_max_sn: 60, video_yukseklik: 720, video_crf: 28, video_ses_kbit: 96,
  paralel: 2,
};
// [min, max] — Video hoechstens 60 s und hoechstens 2 parallel sind harte Vorgaben.
const GRENZEN = {
  lg_px: [800, 2000], lg_q: [50, 95], sm_px: [240, 800], sm_q: [40, 95],
  video_max_sn: [5, 60], video_yukseklik: [360, 1080], video_crf: [18, 35], video_ses_kbit: [48, 192],
  paralel: [1, 2],
};

function begrenzen(k, v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return STANDARD[k];
  const [a, b] = GRENZEN[k];
  return Math.min(b, Math.max(a, n));
}

let cache = null; let cacheZeit = 0;
async function ayarlar({ frisch = false } = {}) {
  if (!frisch && cache && Date.now() - cacheZeit < 10000) return cache;
  const erg = { ...STANDARD };
  try {
    const { rows } = await query('SELECT anahtar, deger FROM medya_ayarlari');
    for (const r of rows) if (r.anahtar in STANDARD) erg[r.anahtar] = begrenzen(r.anahtar, r.deger);
  } catch (e) { console.error('[medya] Einstellungen nicht lesbar, Standard:', e.message); }
  cache = erg; cacheZeit = Date.now();
  return erg;
}

async function bildAyar() {
  const a = await ayarlar();
  return { lg_px: a.lg_px, lg_q: a.lg_q, sm_px: a.sm_px, sm_q: a.sm_q };
}

/** Werte speichern (Admin). Unbekannte Schluessel werden ignoriert. */
async function speichern(werte, adminId = null) {
  const geaendert = {};
  for (const [k, v] of Object.entries(werte || {})) {
    if (!(k in STANDARD)) continue;
    const b = begrenzen(k, v);
    await query(`INSERT INTO medya_ayarlari(anahtar, deger, updated_at, admin_id) VALUES($1,$2,now(),$3)
                 ON CONFLICT (anahtar) DO UPDATE SET deger=EXCLUDED.deger, updated_at=now(), admin_id=EXCLUDED.admin_id`,
      [k, JSON.stringify(b), adminId]);
    geaendert[k] = b;
  }
  cache = null;
  return geaendert;
}

/** Synchron verarbeitete Bilder protokollieren (eine Zeile je Bild, gleich 'tamam'). */
async function bildProtokoll(userId, ilan, varianten) {
  for (const v of varianten || []) {
    await query(`INSERT INTO medya_isleri(tip,durum,senkron,ilan_id,ilan_uuid,user_id,boyut_once,boyut_sonra,sure_ms,detay,deneme,basladi_at,bitti_at)
                 VALUES('bild','tamam',true,$1,$2,$3,$4,$5,$6,$7,1,now(),now())`,
      [ilan.id, ilan.uuid, userId, v.vorher, v.nachher, v.ms || null,
       JSON.stringify({ breite: v.breite, hoehe: v.hoehe, lg: v.lg.length, sm: v.sm.length })]);
  }
}

/** Ein Bild war nicht lesbar: fuer den Admin festhalten. Der Kunde bekommt die
 *  Meldung direkt als 400 — es entsteht kein Inserat. */
async function bildFehlerProtokoll(userId, dateien, fehler, ilan = null) {
  const namen = (dateien || []).map((d) => d.originalname).filter(Boolean).slice(0, 8);
  await query(`INSERT INTO medya_isleri(tip,durum,senkron,ilan_id,ilan_uuid,user_id,boyut_once,hata,hata_kullanici,detay,deneme,basladi_at,bitti_at)
               VALUES('bild','hata',true,$1,$2,$3,$4,$5,$6,$7,1,now(),now())`,
    [ilan ? ilan.id : null, ilan ? ilan.uuid : null, userId,
     (dateien || []).reduce((s, d) => s + (d.size || 0), 0) || null,
     String((fehler && fehler.message) || fehler).slice(0, 500),
     'Fotoğraf işlenemedi: dosya bozuk ya da desteklenmeyen bir biçimde.',
     JSON.stringify({ dosyalar: namen })]);
}

module.exports = { STANDARD, GRENZEN, ayarlar, bildAyar, speichern, bildProtokoll, bildFehlerProtokoll, begrenzen };
