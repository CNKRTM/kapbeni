const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { sendWhatsApp } = require('../utils/whatsapp');

// Şikayet oluştur
router.post('/', authenticateToken, async (req, res) => {
  const { ilan_uuid, sikayet_tipi, aciklama } = req.body;
  try {
    const dup = await pool.query('SELECT id FROM sikayet WHERE ilan_uuid=$1 AND sikayet_eden=$2', [ilan_uuid, req.user.id]);
    if (dup.rows.length > 0) return res.json({ ok: true, mesaj: 'Zaten şikayet edilmiş.' });
    await pool.query('INSERT INTO sikayet (ilan_uuid,sikayet_eden,sikayet_tipi,aciklama) VALUES ($1,$2,$3,$4)',
      [ilan_uuid, req.user.id, sikayet_tipi, aciklama]);
    const result = await pool.query(
      'UPDATE ilanlar SET sikayet_sayisi=COALESCE(sikayet_sayisi,0)+1 WHERE uuid=$1 RETURNING sikayet_sayisi, user_id, baslik',
      [ilan_uuid]);
    const ilan = result.rows[0];
    if (ilan && ilan.sikayet_sayisi >= 3) {
      await pool.query("UPDATE ilanlar SET yayin_durum='askida' WHERE uuid=$1", [ilan_uuid]);
      const satici = await pool.query('SELECT email, ad FROM users WHERE id=$1', [ilan.user_id]);
      if (satici.rows[0]) {
        await sendMail({ to: satici.rows[0].email, subject: 'İlanınız Askıya Alındı – Kap Beni',
          html: `<p>Merhaba ${satici.rows[0].ad},</p><p>"${ilan.baslik}" başlıklı ilanınız birden fazla kullanıcı tarafından şikayet edildiği için geçici olarak askıya alınmıştır.</p><p>Kap Beni Ekibi</p>` });
        await sendWhatsApp(`Ilan askiya alindi: "${ilan.baslik}" (${ilan.sikayet_sayisi} sikayet)`);
      }
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`SELECT s.*, k.ad as sikayet_eden_ad, i.baslik as ilan_baslik, i.ilan_no
      FROM sikayet s LEFT JOIN users k ON k.id=s.sikayet_eden
      LEFT JOIN ilanlar i ON i.uuid=s.ilan_uuid ORDER BY s.created_at DESC`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try { await pool.query('UPDATE sikayet SET durum=$1 WHERE id=$2', [req.body.durum, req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sikayet/benim — eigene Beschwerden des eingeloggten Nutzers
// (an echtes Schema angepasst: Tabelle `sikayet`, Spalten sikayet_eden/sikayet_tipi/ilan_uuid/created_at)
router.get('/benim', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const { rows } = await pool.query(
      `SELECT s.id, s.sikayet_tipi AS sikayet_turu, s.aciklama, s.durum, s.created_at,
              i.baslik AS ilan_baslik
       FROM sikayet s
       LEFT JOIN ilanlar i ON i.uuid = s.ilan_uuid
       WHERE s.sikayet_eden = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error('[sikayet/benim]', err.message);
    res.status(500).json({ message: 'Hata' });
  }
});

module.exports = router;
