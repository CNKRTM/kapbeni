const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken } = require('../middleware/auth');

const ALLOWED = ['ad','soyad','phone','hakkinda','sehir','ilce','hesap_tipi','firma_adi','vkn',
  'mersis_no','ticari_adres','yetkili_kisi','sektor','takma_ad','takma_ad_aktif',
  'bildirim_mesaj','bildirim_teklif','bildirim_ilan','bildirim_email','bildirim_sms'];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (r.rows[0]) delete r.rows[0].password_hash;
    res.json(r.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/', authenticateToken, async (req, res) => {
  const fields = Object.keys(req.body).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return res.json({ ok: true });
  const sets = fields.map((f, i) => `${f}=$${i + 1}`).join(', ');
  const vals = fields.map(f => req.body[f]);
  try {
    await pool.query(`UPDATE users SET ${sets} WHERE id=$${fields.length + 1}`, [...vals, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;
