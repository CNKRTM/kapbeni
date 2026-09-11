const router = require('express').Router();
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// Satın al — emanet başlat
router.post('/satin-al', authMiddleware, async (req, res) => {
  try {
    const { ilan_uuid } = req.body;
    const { rows: ilan } = await query(`SELECT * FROM ilanlar WHERE uuid=$1 AND ilan_durum='aktif'`, [ilan_uuid]);
    if (!ilan[0]) return res.status(404).json({ hata: 'İlan bulunamadı veya aktif değil' });
    if (ilan[0].user_id === req.user.id) return res.status(400).json({ hata: 'Kendi ilanınızı alamazsınız' });
    const komisyon = +(ilan[0].fiyat * 0.025).toFixed(2);
    const satici_alacak = +(ilan[0].fiyat - komisyon).toFixed(2);
    const kargo_son = new Date(Date.now() + 48*60*60*1000); // 48 saat
    const { rows } = await query(
      `INSERT INTO islemler(ilan_id,alici_id,satici_id,tutar,komisyon,satici_alacak,kargo_son_tarih)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ilan[0].id, req.user.id, ilan[0].user_id, ilan[0].fiyat, komisyon, satici_alacak, kargo_son]
    );
    await query("UPDATE ilanlar SET ilan_durum='askida' WHERE id=$1", [ilan[0].id]);
    await auditLog('islem.baslat', 'api', { userId: req.user.id, hedefTip:'islem', hedefId: rows[0].id });
    res.status(201).json({ islem: rows[0], mesaj: 'Ödeme bekleniyor. İyzico ödeme linki burada olacak.' });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Kargo takip kodu gir (satıcı)
router.post('/:uuid/kargo', authMiddleware, async (req, res) => {
  try {
    const { kargo_firma, kargo_takip_no } = req.body;
    const { rows } = await query('SELECT * FROM islemler WHERE uuid=$1', [req.params.uuid]);
    if (!rows[0]) return res.status(404).json({ hata: 'İşlem bulunamadı' });
    if (rows[0].satici_id !== req.user.id) return res.status(403).json({ hata: 'Yetkisiz' });
    const onay_son = new Date(Date.now() + 48*60*60*1000);
    await query(
      `UPDATE islemler SET durum='kargoya_verildi',kargo_firma=$1,kargo_takip_no=$2,onay_son_tarih=$3 WHERE uuid=$4`,
      [kargo_firma, kargo_takip_no, onay_son, req.params.uuid]
    );
    await auditLog('islem.kargo', 'api', { userId: req.user.id, hedefTip:'islem', hedefId: rows[0].id });
    res.json({ mesaj: 'Kargo bilgisi kaydedildi. Alıcı 48 saat içinde onaylamalı.' });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Teslim onayla (alıcı) → para satıcıya
router.post('/:uuid/onayla', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM islemler WHERE uuid=$1', [req.params.uuid]);
    if (!rows[0]) return res.status(404).json({ hata: 'İşlem bulunamadı' });
    if (rows[0].alici_id !== req.user.id) return res.status(403).json({ hata: 'Yetkisiz' });
    await query(
      `UPDATE islemler SET durum='tamamlandi',teslim_tarihi=NOW() WHERE uuid=$1`, [req.params.uuid]
    );
    await query(`UPDATE ilanlar SET ilan_durum='satildi', toplam_satis=toplam_satis+1 WHERE id=(SELECT ilan_id FROM islemler WHERE uuid=$1)`, [req.params.uuid]);
    await query('UPDATE users SET toplam_satis=toplam_satis+1 WHERE id=$1', [rows[0].satici_id]);
    await auditLog('islem.tamamlandi', 'api', { userId: req.user.id, hedefTip:'islem', hedefId: rows[0].id });
    res.json({ mesaj: 'Teslim onaylandı. Para satıcıya aktarılıyor.' });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// İtiraz aç (alıcı)
router.post('/:uuid/itiraz', authMiddleware, async (req, res) => {
  try {
    const { sebep } = req.body;
    const { rows } = await query('SELECT * FROM islemler WHERE uuid=$1', [req.params.uuid]);
    if (!rows[0]) return res.status(404).json({ hata: 'İşlem bulunamadı' });
    if (rows[0].alici_id !== req.user.id) return res.status(403).json({ hata: 'Yetkisiz' });
    await query("UPDATE islemler SET durum='itiraz_acildi' WHERE uuid=$1", [req.params.uuid]);
    await query(
      `INSERT INTO support_tickets(user_id,islem_id,konu,mesaj,kategori,oncelik)
       VALUES($1,$2,$3,$4,'odeme','yuksek')`,
      [req.user.id, rows[0].id, 'İşlem İtirazı', sebep]
    );
    await auditLog('islem.itiraz', 'api', { userId: req.user.id, hedefTip:'islem', hedefId: rows[0].id, detay:{sebep} });
    res.json({ mesaj: 'İtirazınız alındı. Ekibimiz 24 saat içinde inceleyecek.' });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Kullanıcının işlemleri
router.get('/benim', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.*, il.baslik, il.uuid as ilan_uuid,
              ua.ad as alici_ad, us.ad as satici_ad
       FROM islemler i
       JOIN ilanlar il ON il.id=i.ilan_id
       JOIN users ua ON ua.id=i.alici_id
       JOIN users us ON us.id=i.satici_id
       WHERE i.alici_id=$1 OR i.satici_id=$1
       ORDER BY i.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

module.exports = router;
