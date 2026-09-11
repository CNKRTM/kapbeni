const express = require('express')
const router = express.Router()
const pool = require('../db/pool')

// GET /api/satici/:id/profil — öffentliches Verkäuferprofil (id = uuid oder numerische id)
router.get('/:id/profil', async (req, res) => {
  try {
    const { id } = req.params
    let r = await pool.query('SELECT * FROM users WHERE uuid::text = $1', [id]).catch(() => ({ rows: [] }))
    if (!r.rows[0] && /^\d+$/.test(id)) {
      r = await pool.query('SELECT * FROM users WHERE id = $1', [Number(id)]).catch(() => ({ rows: [] }))
    }
    const u = r.rows[0]
    if (!u) return res.status(404).json({ message: 'Bulunamadı' })

    const ilanRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ilanlar WHERE user_id = $1 AND ilan_durum = 'aktif'`, [u.id]
    ).catch(() => ({ rows: [{ c: 0 }] }))
    const degRes = await pool.query(
      `SELECT ROUND(AVG(puan)::numeric, 1) AS ort, COUNT(*)::int AS say FROM degerlendirmeler WHERE degerlendirilen = $1`, [u.id]
    ).catch(() => ({ rows: [{ ort: 0, say: 0 }] }))
    const sonDeg = await pool.query(
      `SELECT d.puan, d.yorum, d.created_at, uy.ad AS yorum_sahibi_ad
       FROM degerlendirmeler d LEFT JOIN users uy ON uy.id = d.degerlendiren
       WHERE d.degerlendirilen = $1 ORDER BY d.created_at DESC LIMIT 5`, [u.id]
    ).catch(() => ({ rows: [] }))

    const ad = u.takma_ad_aktif && u.takma_ad ? u.takma_ad : [u.ad, u.soyad].filter(Boolean).join(' ') || (u.email ? u.email.split('@')[0] : 'Kullanıcı')

    res.json({
      id: u.uuid || u.id,
      ad,
      avatar_url: u.avatar_url,
      hesap_tipi: u.hesap_tipi,
      firma_adi: u.firma_adi,
      sehir: u.sehir,
      hakkinda: u.hakkinda,
      kyc_onaylandi: u.kyc_durumu === 'onaylandi',
      gsm_onaylandi: !!u.phone_verified,
      ilan_sayisi: Number(ilanRes.rows[0]?.c) || 0,
      degerlendirme_ortalama: parseFloat(degRes.rows[0]?.ort) || 0,
      degerlendirme_sayisi: Number(degRes.rows[0]?.say) || 0,
      son_degerlendirmeler: sonDeg.rows,
    })
  } catch (err) {
    console.error('[satici/profil]', err.message)
    res.status(500).json({ message: 'Hata' })
  }
})

// GET /api/satici/:id/ilanlar — aktive Ilanlar des Verkäufers (inkl. Foto + Kategorie)
router.get('/:id/ilanlar', async (req, res) => {
  try {
    const { id } = req.params
    let u = await pool.query('SELECT id FROM users WHERE uuid::text = $1', [id]).catch(() => ({ rows: [] }))
    if (!u.rows[0] && /^\d+$/.test(id)) {
      u = await pool.query('SELECT id FROM users WHERE id = $1', [Number(id)]).catch(() => ({ rows: [] }))
    }
    if (!u.rows[0]) return res.json({ ilanlar: [] })
    const r = await pool.query(
      `SELECT i.uuid, i.baslik, i.fiyat, i.sehir, i.ilce, i.durum, k.ad AS kategori_ad,
              (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) AS ana_foto
       FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id
       WHERE i.user_id = $1 AND i.ilan_durum='aktif' ORDER BY i.created_at DESC LIMIT 60`, [u.rows[0].id])
    res.json({ ilanlar: r.rows })
  } catch (err) {
    console.error('[satici/ilanlar]', err.message)
    res.status(500).json({ message: 'Hata' })
  }
})

module.exports = router
