// ════════════════════════════════════════════════════════════════════════════
//  Zustand und Kategorie-Merkmale (EAV) — Auftragssammlung M.
//
//  Tabellen: kategori_ozellik_tanimlari (Felder je Kategorie), …_secenekleri
//  (Auswahlwerte), ilan_ozellik_degerleri (Werte je Inserat).
//  Unterkategorien erben die Felder ihrer Elternkategorien. Hat eine tiefere
//  Ebene ein Feld mit demselben alan_adi, gewinnt die tiefere.
// ════════════════════════════════════════════════════════════════════════════
const { query } = require('../db/pool');

const DURUM_KODLARI = ['sifir', 'yeni_gibi', 'az_kullanilmis', 'kullanilmis'];
const DURUM_ETIKET = { sifir: 'Sıfır', yeni_gibi: 'Yeni gibi', az_kullanilmis: 'Az kullanılmış', kullanilmis: 'Kullanılmış' };

/** Felder fuer eine Kategorie samt Elternkette, ohne das entfallene "durum". */
async function tanimlarGetir(kategoriId, db = { query }) {
  const id = Number(kategoriId);
  if (!Number.isInteger(id) || id <= 0) return [];
  const { rows } = await db.query(`
    WITH RECURSIVE zincir AS (
      SELECT id, ust_id, 0 AS tiefe FROM kategoriler WHERE id=$1
      UNION ALL SELECT k.id, k.ust_id, z.tiefe + 1 FROM kategoriler k JOIN zincir z ON k.id=z.ust_id
    )
    SELECT t.id, t.kategori_id, t.alan_adi, t.etiket, t.zorunlu, t.tip, t.sira, z.tiefe,
           COALESCE((SELECT json_agg(s.deger ORDER BY s.sira, s.id) FROM kategori_ozellik_secenekleri s WHERE s.tanim_id=t.id), '[]') AS secenekler
      FROM kategori_ozellik_tanimlari t JOIN zincir z ON z.id=t.kategori_id
     WHERE t.alan_adi <> 'durum'
     ORDER BY z.tiefe, t.sira, t.id`, [id]);
  // Gleicher alan_adi auf mehreren Ebenen: die tiefste (kleinste tiefe) gewinnt.
  const gesehen = new Set(); const aus = [];
  for (const t of rows) { if (gesehen.has(t.alan_adi)) continue; gesehen.add(t.alan_adi); aus.push(t); }
  // Marke zuerst, danach die Reihenfolge der Definition (Elternfelder vor Kindfeldern).
  aus.sort((a, b) => (a.alan_adi === 'marka' ? -1 : b.alan_adi === 'marka' ? 1 : (b.tiefe - a.tiefe) || (a.sira - b.sira) || (a.id - b.id)));
  return aus.map(t => ({ ...t, serbest: t.alan_adi === 'marka' }));
}

class OzellikHatasi extends Error {}

/**
 * Eingabe pruefen. `roh` = { [tanim_id]: wert } als Objekt oder JSON-Text.
 * Liefert [{ tanim_id, deger }] oder wirft OzellikHatasi mit tuerkischem Text.
 */
async function ozellikleriPruefe(kategoriId, roh, { zorunluPruefen = true } = {}) {
  let girdi = roh;
  if (typeof roh === 'string') {
    try { girdi = roh.trim() ? JSON.parse(roh) : {}; } catch { throw new OzellikHatasi('Özellikler okunamadı.'); }
  }
  if (girdi == null) girdi = {};
  if (typeof girdi !== 'object' || Array.isArray(girdi)) throw new OzellikHatasi('Özellikler okunamadı.');
  const tanimlar = await tanimlarGetir(kategoriId);
  const nachId = new Map(tanimlar.map(t => [String(t.id), t]));
  const liste = [];
  for (const [schluessel, wertRoh] of Object.entries(girdi)) {
    const t = nachId.get(String(schluessel));
    if (!t) continue;                         // fremdes Feld (andere Kategorie) still verwerfen
    const wert = wertRoh == null ? '' : String(wertRoh).trim();
    if (!wert) continue;
    if (wert.length > 120) throw new OzellikHatasi(`${t.etiket} en fazla 120 karakter olabilir.`);
    if (t.tip === 'sayi') {
      if (!/^\d{1,9}$/.test(wert.replace(/[.\s]/g, ''))) throw new OzellikHatasi(`${t.etiket} için geçerli bir sayı girin.`);
      const n = Number(wert.replace(/[.\s]/g, ''));
      if (t.alan_adi === 'yil' && (n < 1900 || n > new Date().getFullYear() + 1))
        throw new OzellikHatasi(`${t.etiket} ${1900}–${new Date().getFullYear() + 1} arasında olmalıdır.`);
      liste.push({ tanim_id: t.id, deger: String(n) });
      continue;
    }
    if (t.tip === 'secim' && !t.serbest) {
      const treffer = t.secenekler.find(s => s.toLocaleLowerCase('tr') === wert.toLocaleLowerCase('tr'));
      if (!treffer) throw new OzellikHatasi(`${t.etiket} için listeden bir değer seçin.`);
      liste.push({ tanim_id: t.id, deger: treffer });
      continue;
    }
    if (t.serbest) {
      // Marke: Listenwert in der gepflegten Schreibweise, sonst freier Text.
      const treffer = t.secenekler.find(s => s.toLocaleLowerCase('tr') === wert.toLocaleLowerCase('tr'));
      liste.push({ tanim_id: t.id, deger: treffer || wert });
      continue;
    }
    liste.push({ tanim_id: t.id, deger: wert });
  }
  if (zorunluPruefen) {
    const da = new Set(liste.map(x => x.tanim_id));
    const fehlt = tanimlar.filter(t => t.zorunlu && !da.has(t.id));
    if (fehlt.length) throw new OzellikHatasi(`Zorunlu alan: ${fehlt.map(t => t.etiket).join(', ')}`);
  }
  return liste;
}

/** Werte eines Inserats komplett ersetzen (in einer laufenden Transaktion moeglich). */
async function ozellikleriYaz(db, ilanId, liste) {
  await db.query('DELETE FROM ilan_ozellik_degerleri WHERE ilan_id=$1', [ilanId]);
  for (const x of liste)
    await db.query('INSERT INTO ilan_ozellik_degerleri(ilan_id, tanim_id, deger) VALUES($1,$2,$3)', [ilanId, x.tanim_id, x.deger]);
}

/** Werte eines Inserats fuer Anzeige/Bearbeiten. */
async function ilanOzellikleri(ilanId, db = { query }) {
  const { rows } = await db.query(
    `SELECT v.tanim_id, t.alan_adi, t.etiket, t.tip, v.deger
       FROM ilan_ozellik_degerleri v JOIN kategori_ozellik_tanimlari t ON t.id=v.tanim_id
      WHERE v.ilan_id=$1 ORDER BY (t.alan_adi='marka') DESC, t.sira, t.id`, [ilanId]);
  return rows;
}

module.exports = { DURUM_KODLARI, DURUM_ETIKET, tanimlarGetir, ozellikleriPruefe, ozellikleriYaz, ilanOzellikleri, OzellikHatasi };
