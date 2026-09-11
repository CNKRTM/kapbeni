const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken, requireAdmin } = require('../middleware/auth');

router.get('/paketler', async (req, res) => {
  const r = await pool.query('SELECT * FROM paketler WHERE aktif=true ORDER BY hesap_tipi, fiyat');
  res.json(r.rows);
});
router.get('/benim', authenticateToken, async (req, res) => {
  const r = await pool.query(`SELECT a.*, p.isim as paket_isim FROM abonelikler a JOIN paketler p ON p.id=a.paket_id
     WHERE a.kullanici_id=$1 AND a.durum='aktif' ORDER BY a.created_at DESC LIMIT 1`, [req.user.id]);
  res.json(r.rows[0] || null);
});
router.get('/kupon-kontrol', authenticateToken, async (req, res) => {
  const { kod } = req.query;
  try {
    const r = await pool.query(`SELECT * FROM paket_kuponlari WHERE kod=$1 AND aktif=true AND (gecerlilik_bitis IS NULL OR gecerlilik_bitis > NOW())`, [kod]);
    if (!r.rows.length) return res.json({ gecerli: false });
    const k = r.rows[0];
    if (k.kullanim_limiti && k.kullanim_sayisi >= k.kullanim_limiti) return res.json({ gecerli: false, mesaj: 'Kullanım limiti dolmuş.' });
    res.json({ gecerli: true, indirim_tipi: k.indirim_tipi, indirim_degeri: k.indirim_degeri });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/satin-al', authenticateToken, async (req, res) => {
  const { paket_id, kupon_kodu } = req.body;
  try {
    const paket = await pool.query('SELECT * FROM paketler WHERE id=$1', [paket_id]);
    if (!paket.rows.length) return res.status(404).json({ error: 'Paket bulunamadı.' });
    const p = paket.rows[0];
    let fiyat = p.fiyat;
    if (kupon_kodu) {
      const k = await pool.query(`SELECT * FROM paket_kuponlari WHERE kod=$1 AND aktif=true`, [kupon_kodu]);
      if (k.rows.length) {
        const kp = k.rows[0];
        if (kp.indirim_tipi === 'yuzde') fiyat = Math.round(fiyat * (1 - kp.indirim_degeri / 100));
        else fiyat = Math.max(0, fiyat - kp.indirim_degeri);
        await pool.query('UPDATE paket_kuponlari SET kullanim_sayisi=kullanim_sayisi+1 WHERE kod=$1', [kupon_kodu]);
      }
    }
    const bitis = new Date(); bitis.setDate(bitis.getDate() + p.sure_gun);
    await pool.query(`INSERT INTO abonelikler (kullanici_id,paket_id,bitis,ilan_hakki,ilan_hakki_kalan,kupon_kodu,odeme_tutari)
       VALUES ($1,$2,$3,$4,$4,$5,$6)`, [req.user.id, paket_id, bitis, p.ilan_hakki, kupon_kodu, fiyat]);
    res.json({ ok: true, odeme_tutari: fiyat });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/admin', requireAdmin, async (req, res) => {
  const r = await pool.query(`SELECT a.*, k.ad as kullanici_ad, k.email, p.isim as paket_isim
     FROM abonelikler a JOIN users k ON k.id=a.kullanici_id JOIN paketler p ON p.id=a.paket_id ORDER BY a.created_at DESC`);
  res.json(r.rows);
});
module.exports = router;
