const express = require('express')
const router = express.Router()
const pool = require('../db/pool') // { query, pool, auditLog }
const { authMiddleware } = require('../middleware/auth')

// GET /api/dashboard/stats — eigene Statistiken (echtes Schema: user_id, degerlendirilen, ilan_durum)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id
    const ilanRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ilanlar WHERE user_id = $1 AND ilan_durum = 'aktif'`, [uid]
    ).catch(() => ({ rows: [{ c: 0 }] }))
    const favRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM favoriler WHERE user_id = $1`, [uid]
    ).catch(() => ({ rows: [{ c: 0 }] }))
    const degRes = await pool.query(
      `SELECT ROUND(AVG(puan)::numeric, 1) AS ort, COUNT(*)::int AS say FROM degerlendirmeler WHERE degerlendirilen = $1`, [uid]
    ).catch(() => ({ rows: [{ ort: null, say: 0 }] }))

    res.json({
      aktif_ilan: Number(ilanRes.rows[0]?.c) || 0,
      favori: Number(favRes.rows[0]?.c) || 0,
      degerlendirme_ortalama: parseFloat(degRes.rows[0]?.ort) || 0,
      degerlendirme_sayisi: Number(degRes.rows[0]?.say) || 0,
    })
  } catch (err) {
    console.error('[dashboard/stats]', err.message)
    res.status(500).json({ message: 'Hata' })
  }
})

module.exports = router
