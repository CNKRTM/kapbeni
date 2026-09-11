const router = require('express').Router();
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const ai = require('../services/ai.service');

// Konuşma başlat / getir
router.post('/konusma', authMiddleware, async (req, res) => {
  try {
    const { ilan_uuid } = req.body;
    const { rows: ilan } = await query('SELECT * FROM ilanlar WHERE uuid=$1', [ilan_uuid]);
    if (!ilan[0]) return res.status(404).json({ hata: 'İlan bulunamadı' });
    if (ilan[0].user_id === req.user.id) return res.status(400).json({ hata: 'Kendi ilanınıza mesaj atamazsınız' });
    let { rows } = await query(
      'SELECT * FROM konusmalar WHERE ilan_id=$1 AND alici_id=$2', [ilan[0].id, req.user.id]
    );
    if (!rows[0]) {
      const ins = await query(
        'INSERT INTO konusmalar(ilan_id,alici_id,satici_id) VALUES($1,$2,$3) RETURNING *',
        [ilan[0].id, req.user.id, ilan[0].user_id]
      );
      rows = ins.rows;
    }
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Konuşmalarımı listele
router.get('/konusmalar', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT k.*, i.baslik, i.uuid as ilan_uuid,
              (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ilan_foto,
              ua.ad as alici_ad, us.ad as satici_ad,
              (SELECT metin FROM mesajlar WHERE konusma_id=k.id ORDER BY id DESC LIMIT 1) as son_mesaj,
              (SELECT created_at FROM mesajlar WHERE konusma_id=k.id ORDER BY id DESC LIMIT 1) as son_mesaj_zaman
       FROM konusmalar k
       JOIN ilanlar i ON i.id=k.ilan_id
       JOIN users ua ON ua.id=k.alici_id
       JOIN users us ON us.id=k.satici_id
       WHERE k.alici_id=$1 OR k.satici_id=$1
       ORDER BY son_mesaj_zaman DESC`, [req.user.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Mesajları getir
router.get('/konusma/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: k } = await query('SELECT * FROM konusmalar WHERE id=$1', [req.params.id]);
    if (!k[0] || (k[0].alici_id !== req.user.id && k[0].satici_id !== req.user.id))
      return res.status(403).json({ hata: 'Yetkisiz' });
    await query('UPDATE mesajlar SET okundu=true WHERE konusma_id=$1 AND gonderen_id!=$2', [req.params.id, req.user.id]);
    const { rows } = await query('SELECT * FROM mesajlar WHERE konusma_id=$1 ORDER BY id', [req.params.id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Mesaj gönder — AI dolandırıcı kontrolü
router.post('/konusma/:id/mesaj', authMiddleware, async (req, res) => {
  try {
    const { metin } = req.body;
    const { rows: k } = await query('SELECT * FROM konusmalar WHERE id=$1', [req.params.id]);
    if (!k[0] || (k[0].alici_id !== req.user.id && k[0].satici_id !== req.user.id))
      return res.status(403).json({ hata: 'Yetkisiz' });
    // AI mesaj kontrolü — Claude Haiku (hızlı)
    const kontrol = await ai.mesajKontrol(metin);
    const { rows } = await query(
      'INSERT INTO mesajlar(konusma_id,gonderen_id,metin,tehlikeli,tehlike_turu) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, req.user.id, metin, kontrol.tehlikeli, kontrol.tur]
    );
    if (kontrol.tehlikeli) {
      await auditLog('mesaj.tehlikeli', 'api', { userId: req.user.id, hedefTip:'mesaj', hedefId: rows[0].id, detay: kontrol });
    }
    res.json({ mesaj: rows[0], uyari: kontrol.tehlikeli ? { var: true, tur: kontrol.tur } : null });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

module.exports = router;
