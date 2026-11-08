// ════════════════════════════════════════════════════════════════════════════
//  Benachrichtigungen im Konto (v1.35, Tabelle bildirimler).
//
//  gonder() wird von API und Admin aufgerufen (Nachricht, Angebot, Angebot
//  angenommen/abgelehnt, Inserat freigegeben/abgelehnt, Medienfehler).
//  - Beachtet die Einstellungen des Kunden (Ayarlar → Bildirimler):
//    bildirim_mesaj / bildirim_teklif / bildirim_ilan. Aus = keine Meldung.
//  - Chat: je Konversation hoechstens EINE ungelesene Meldung; eine weitere
//    Nachricht aktualisiert sie (Text, Zeit) statt die Liste zu fluten.
//  - Wirft nie: eine Meldung darf keine Nachricht und kein Angebot kosten.
//  - Geloeschte Konten (silindi_at) bekommen nichts.
// ════════════════════════════════════════════════════════════════════════════
const { query } = require('../db/pool');

const TERCIH = {
  mesaj: 'bildirim_mesaj',
  teklif_yeni: 'bildirim_teklif', teklif_kabul: 'bildirim_teklif', teklif_red: 'bildirim_teklif',
  ilan_onay: 'bildirim_ilan', ilan_red: 'bildirim_ilan', medya: 'bildirim_ilan',
};

const kisalt = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

async function gonder({ userId, tip, baslik, icerik = null, link = null, kaynakTip = null, kaynakId = null }) {
  try {
    if (!userId || !tip) return null;
    const kol = TERCIH[tip];
    const { rows: u } = await query(
      `SELECT ${kol ? kol : 'true'} AS an FROM users WHERE id=$1 AND silindi_at IS NULL`, [userId]);
    if (!u[0] || u[0].an === false) return null;
    const b = kisalt(baslik, 250), ic = icerik == null ? null : kisalt(icerik, 400);
    if (tip === 'mesaj' && kaynakTip && kaynakId) {
      const { rows } = await query(
        `UPDATE bildirimler SET baslik=$1, icerik=$2, link=$3, olusturma_tarihi=now()
          WHERE user_id=$4 AND tip='mesaj' AND kaynak_tip=$5 AND kaynak_id=$6 AND okundu=false RETURNING id`,
        [b, ic, link, userId, kaynakTip, kaynakId]);
      if (rows[0]) return rows[0].id;
    }
    const { rows } = await query(
      `INSERT INTO bildirimler(user_id, tip, baslik, icerik, link, kaynak_tip, kaynak_id)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [userId, tip, b, ic, link, kaynakTip, kaynakId]);
    return rows[0].id;
  } catch (e) {
    console.warn('[bildirim] nicht gespeichert:', e.message);
    return null;
  }
}

/** Meldungen zu einer Quelle als gelesen markieren (z.B. Konversation geoeffnet). Wirft nie. */
async function okunduYap(userId, kaynakTip, kaynakId) {
  try {
    await query('UPDATE bildirimler SET okundu=true WHERE user_id=$1 AND kaynak_tip=$2 AND kaynak_id=$3 AND okundu=false',
      [userId, kaynakTip, kaynakId]);
  } catch (e) { console.warn('[bildirim] okundu:', e.message); }
}

const fiyatTL = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL' : String(n ?? '');
};

module.exports = { gonder, okunduYap, kisalt, fiyatTL, TERCIH };
