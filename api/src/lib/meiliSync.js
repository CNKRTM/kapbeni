const { ilanlarIndex } = require('./meili')
// Echter DB-Helper dieses Servers: src/db/pool.js exportiert { query, pool, auditLog }
const pool = require('../db/pool')

function toDoc(i) {
  return {
    uuid: String(i.uuid),
    baslik: i.baslik || '',
    aciklama: i.aciklama || '',
    fiyat: Number(i.fiyat) || 0,
    kategori_id: i.kategori_id != null ? String(i.kategori_id) : '',
    kategori_slug: i.kategori_slug || '',
    kategori_ad: i.kategori_ad || '',
    sehir: i.sehir || '',
    ilce: i.ilce || '',
    ana_foto: i.ana_foto || '',
    ilan_durum: i.ilan_durum || 'aktif',
    created_at: i.created_at ? new Date(i.created_at).getTime() : Date.now(),
  }
}

// Ein einzelnes Ilan (per uuid) neu holen inkl. Foto/Kategorie und indexieren
async function syncListing(uuidOrRow) {
  try {
    let row = uuidOrRow
    if (typeof uuidOrRow === 'string' || !uuidOrRow.kategori_slug) {
      const uuid = typeof uuidOrRow === 'string' ? uuidOrRow : uuidOrRow.uuid
      const r = await pool.query(
        `SELECT i.uuid, i.baslik, i.aciklama, i.fiyat, i.kategori_id, i.sehir, i.ilce, i.ilan_durum, i.created_at,
                k.ad AS kategori_ad, k.slug AS kategori_slug,
                (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) AS ana_foto
         FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id WHERE i.uuid=$1`, [uuid])
      row = r.rows[0]
      if (!row) return
    }
    await ilanlarIndex.addDocuments([toDoc(row)])
  } catch (err) {
    console.error('[Meili] syncListing:', err.message)
  }
}

async function deleteListing(uuid) {
  try { await ilanlarIndex.deleteDocument(String(uuid)) }
  catch (err) { console.error('[Meili] delete:', err.message) }
}

async function reindexAll() {
  try {
    const r = await pool.query(
      `SELECT i.uuid, i.baslik, i.aciklama, i.fiyat, i.kategori_id, i.sehir, i.ilce, i.ilan_durum, i.created_at,
              k.ad AS kategori_ad, k.slug AS kategori_slug,
              (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) AS ana_foto
       FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id
       WHERE i.ilan_durum='aktif' LIMIT 5000`)
    const rows = r.rows
    if (!rows || !rows.length) { console.log('[Meili] No rows to index'); return }
    await ilanlarIndex.addDocuments(rows.map(toDoc))
    console.log(`[Meili] Reindexed ${rows.length} listings`)
  } catch (err) {
    console.error('[Meili] reindexAll:', err.message)
  }
}

module.exports = { syncListing, deleteListing, reindexAll }
