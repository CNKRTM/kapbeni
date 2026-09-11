const express = require('express')
const router = express.Router()
const pool = require('../db/pool')
const { requireAdmin } = require('../middleware/auth')

router.use(requireAdmin)

// Fehler werden bewusst abgefangen (eine kaputte Teilabfrage soll das Dashboard
// nicht mit 500 abschiessen) — aber sie muessen im Log sichtbar sein, sonst
// sieht ein Schema-Fehler wie ein leerer Datenbestand aus.
const logSqlError = (e, sql) =>
  console.error('[admin] SQL-Fehler:', e.message, '|', String(sql).replace(/\s+/g, ' ').slice(0, 140))

const one = async (sql, params = []) => {
  try { return (await pool.query(sql, params)).rows[0] } catch (e) { logSqlError(e, sql); return null }
}
const many = async (sql, params = []) => {
  try { return (await pool.query(sql, params)).rows } catch (e) { logSqlError(e, sql); return [] }
}

router.get('/istatistik', async (req, res) => {
  const kullanici = await one(`SELECT COUNT(*)::int AS c FROM users`)
  const ilan = await one(`SELECT COUNT(*)::int AS c FROM ilanlar WHERE ilan_durum='aktif'`)
  const bugun = await one(`SELECT COUNT(*)::int AS c FROM users WHERE created_at::date = CURRENT_DATE`)
  const sikayet = await one(`SELECT COUNT(*)::int AS c FROM sikayet WHERE durum='beklemede'`)
  const kyc = await one(`SELECT COUNT(*)::int AS c FROM kyc_results WHERE durum='beklemede'`)
    || await one(`SELECT COUNT(*)::int AS c FROM users WHERE kyc_durumu='beklemede'`)
  res.json({
    kullanici_sayisi: Number(kullanici?.c) || 0,
    aktif_ilan: Number(ilan?.c) || 0,
    bugun_uye: Number(bugun?.c) || 0,
    bekleyen_sikayet: Number(sikayet?.c) || 0,
    bekleyen_kyc: Number(kyc?.c) || 0,
  })
})

router.get('/ilanlar', async (req, res) => {
  const { sayfa = 1, limit = 30, durum } = req.query
  const offset = (parseInt(sayfa) - 1) * parseInt(limit)
  const where = durum ? `WHERE i.ilan_durum = $3` : ''
  const params = durum ? [parseInt(limit), offset, durum] : [parseInt(limit), offset]
  const ilanlar = await many(
    `SELECT i.uuid, i.baslik, k.ad AS kategori_ad, i.sehir, i.fiyat, i.ilan_durum, i.created_at
     FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id ${where}
     ORDER BY i.created_at DESC LIMIT $1 OFFSET $2`, params)
  res.json({ ilanlar })
})

router.patch('/ilanlar/:uuid/durum', async (req, res) => {
  try {
    await pool.query(`UPDATE ilanlar SET ilan_durum = $1 WHERE uuid::text = $2`, [req.body.ilan_durum, req.params.uuid])
    res.json({ basarili: true })
  } catch (err) { res.status(500).json({ message: 'Hata' }) }
})

router.get('/kullanicilar', async (req, res) => {
  const { sayfa = 1, limit = 30 } = req.query
  const offset = (parseInt(sayfa) - 1) * parseInt(limit)
  const kullanicilar = await many(
    // Spalte heisst kyc_durumu; das Feld heisst im JSON weiterhin kyc_durum,
    // weil AdminPanel.tsx darauf zugreift (gleiches Muster wie auth.js).
    `SELECT id, uuid, ad, soyad, email, hesap_tipi, kyc_durumu AS kyc_durum, phone_verified, created_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [parseInt(limit), offset])
  res.json({ kullanicilar })
})

router.get('/sikayetler', async (req, res) => {
  const { durum } = req.query
  const where = durum ? `WHERE durum = $1` : ''
  const params = durum ? [durum] : []
  const sikayetler = await many(`SELECT * FROM sikayet ${where} ORDER BY created_at DESC LIMIT 50`, params)
  res.json({ sikayetler })
})

router.patch('/sikayetler/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE sikayet SET durum = $1 WHERE id = $2`, [req.body.durum, req.params.id])
    res.json({ basarili: true })
  } catch (err) { res.status(500).json({ message: 'Hata' }) }
})

router.get('/kyc', async (req, res) => {
  const { durum = 'beklemede' } = req.query
  let list = await many(
    `SELECT k.*, u.ad, u.soyad, u.email FROM kyc_results k LEFT JOIN users u ON u.id = k.user_id
     WHERE k.durum = $1 ORDER BY k.created_at DESC LIMIT 50`, [durum])
  if (!list.length) {
    list = await many(`SELECT id, ad, soyad, email, kyc_durumu AS kyc_durum FROM users WHERE kyc_durumu = $1 LIMIT 50`, [durum])
  }
  res.json({ list })
})

router.patch('/kyc/:id', async (req, res) => {
  const { durum } = req.body
  try {
    try { await pool.query(`UPDATE kyc_results SET durum = $1 WHERE id = $2`, [durum, req.params.id]) }
    catch (_) { await pool.query(`UPDATE users SET kyc_durumu = $1 WHERE id = $2`, [durum, req.params.id]) }
    res.json({ basarili: true })
  } catch (err) { res.status(500).json({ message: 'Hata' }) }
})

module.exports = router
