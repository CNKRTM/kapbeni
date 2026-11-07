const express = require('express')
const router = express.Router()
const { ilanlarIndex } = require('../lib/meili')

// GET /api/arama
router.get('/', async (req, res) => {
  try {
    const { q = '', kategori, sehir, min, max, sayfa = 1, siralama = 'en-yeni' } = req.query
    const filters = ['ilan_durum = "aktif"']
    if (kategori) filters.push(`kategori_slug = "${kategori}"`)
    if (sehir) filters.push(`sehir = "${sehir}"`)
    if (min) filters.push(`fiyat >= ${parseFloat(min)}`)
    if (max) filters.push(`fiyat <= ${parseFloat(max)}`)
    // Marke und Zustand (Auftragssammlung M). Anfuehrungszeichen entschaerfen,
    // sonst liesse sich ueber den Parameter der Filterausdruck aufbrechen.
    const esc = (v) => String(v).replace(/["\\]/g, '')
    if (req.query.marka) filters.push(`marka = "${esc(req.query.marka)}"`)
    if (req.query.durum) filters.push(`durum = "${esc(req.query.durum)}"`)

    const sort =
      siralama === 'ucuz' ? ['fiyat:asc']
      : siralama === 'pahali' ? ['fiyat:desc']
      : ['created_at:desc']

    const result = await ilanlarIndex.search(q || '', {
      filter: filters.join(' AND '),
      sort,
      page: parseInt(sayfa) || 1,
      hitsPerPage: 24,
    })

    res.json({
      ilanlar: result.hits,
      toplam: result.totalHits,
      sayfa: result.page,
      toplamSayfa: result.totalPages,
    })
  } catch (err) {
    console.error('[Arama]', err.message)
    res.status(500).json({ message: 'Arama hatası' })
  }
})

module.exports = router
