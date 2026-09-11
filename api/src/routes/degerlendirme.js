const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/istatistik', async (req, res) => {
  try {
    const r = await pool.query(`SELECT ROUND(AVG(puan)::numeric,1) as ortalama, COUNT(*) as toplam FROM degerlendirmeler WHERE durum='onaylandi'`);
    const dg = await pool.query(`SELECT puan, COUNT(*) as cnt FROM degerlendirmeler WHERE durum='onaylandi' GROUP BY puan`);
    const dagilim = {}; dg.rows.forEach(x => { dagilim[x.puan] = parseInt(x.cnt); });
    res.json({ ortalama: r.rows[0]?.ortalama || 0, toplam: parseInt(r.rows[0]?.toplam || 0), dagilim });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/son', async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;
  const r = await pool.query(`SELECT d.id, d.puan, d.yorum, d.created_at, k.ad as degerlendiren_ad
     FROM degerlendirmeler d JOIN users k ON k.id=d.degerlendiren
     WHERE d.durum='onaylandi' AND d.yorum IS NOT NULL AND length(d.yorum)>10
     ORDER BY d.created_at DESC LIMIT $1`, [limit]);
  res.json(r.rows);
});
router.get('/kullanici/:userId', async (req, res) => {
  const r = await pool.query(`SELECT d.*, k.ad as degerlendiren_ad FROM degerlendirmeler d
     JOIN users k ON k.id=d.degerlendiren
     WHERE d.degerlendirilen=$1 AND d.durum='onaylandi' ORDER BY d.created_at DESC`, [req.params.userId]);
  res.json(r.rows);
});
router.post('/', authenticateToken, async (req, res) => {
  const { degerlendirilen_id, ilan_uuid, puan, teslimat_puan, iletisim_puan, urun_puan, yorum } = req.body;
  if (req.user.id == degerlendirilen_id) return res.status(400).json({ error: 'Kendinizi değerlendiremezsiniz.' });
  try {
    await pool.query(`INSERT INTO degerlendirmeler (degerlendiren,degerlendirilen,ilan_uuid,puan,teslimat_puan,iletisim_puan,urun_puan,yorum,durum)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'beklemede')`,
      [req.user.id, degerlendirilen_id, ilan_uuid, puan, teslimat_puan, iletisim_puan, urun_puan, yorum]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/admin', requireAdmin, async (req, res) => {
  const r = await pool.query(`SELECT d.*, k1.ad as degerlendiren_ad, k2.ad as degerlendirilen_ad
     FROM degerlendirmeler d JOIN users k1 ON k1.id=d.degerlendiren JOIN users k2 ON k2.id=d.degerlendirilen
     ORDER BY d.created_at DESC`);
  res.json(r.rows);
});
router.patch('/:id', requireAdmin, async (req, res) => {
  await pool.query('UPDATE degerlendirmeler SET durum=$1 WHERE id=$2', [req.body.durum, req.params.id]);
  res.json({ ok: true });
});
module.exports = router;
