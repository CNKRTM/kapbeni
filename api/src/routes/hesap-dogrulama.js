// overnight5 Phase 3 — Hesap-Doğrulama (E-Mail neu; GSM/KYC redundant zu /api/gsm + /api/kyc,
// hier additiv als vereinheitlichtes /api/dogrulama). Spalten aus overnight4-Migration.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// POST /api/dogrulama/email/gonder
router.post('/email/gonder', authMiddleware, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(`UPDATE users SET email_dogrulama_token=$1 WHERE id=$2`, [token, req.user.id]);
    const verifyUrl = `https://kapbeni.com/dogrula?token=${token}`;
    console.log(`[EMAIL-DOGR] ${req.user.email} → ${verifyUrl}`);
    res.json({ ok: true, message: 'Doğrulama linki e-postanıza gönderildi.' });
  } catch (err) {
    console.error('[dogrulama/email]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /api/dogrulama/email/dogrula?token=xxx
router.get('/email/dogrula', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token eksik' });
  try {
    const { rows: [u] } = await pool.query(
      `UPDATE users SET email_dogrulandi=TRUE, email_dogrulama_token=NULL
       WHERE email_dogrulama_token=$1 RETURNING id, email`, [token]);
    if (!u) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
    res.json({ ok: true, message: 'E-posta adresiniz doğrulandı!' });
  } catch (err) {
    console.error('[dogrulama/email/dogrula]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/dogrulama/gsm/gonder
router.post('/gsm/gonder', authMiddleware, async (req, res) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(`UPDATE users SET telefon_otp=$1, otp_expires_at=$2 WHERE id=$3`, [otp, expires, req.user.id]);
    console.log(`[SMS-OTP] ${req.user.phone || 'no-phone'} → ${otp}`);
    res.json({ ok: true, message: 'OTP gönderildi (10 dakika geçerli)' });
  } catch (err) {
    console.error('[dogrulama/gsm]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/dogrulama/gsm/dogrula
router.post('/gsm/dogrula', authMiddleware, async (req, res) => {
  const { otp } = req.body;
  try {
    const { rows: [u] } = await pool.query(`SELECT telefon_otp, otp_expires_at FROM users WHERE id=$1`, [req.user.id]);
    if (!u || u.telefon_otp !== otp) return res.status(400).json({ error: 'Hatalı OTP kodu' });
    if (new Date() > new Date(u.otp_expires_at)) return res.status(400).json({ error: 'OTP süresi dolmuş' });
    await pool.query(`UPDATE users SET telefon_dogrulandi=TRUE, telefon_otp=NULL, otp_expires_at=NULL WHERE id=$1`, [req.user.id]);
    res.json({ ok: true, message: 'Telefon numaranız doğrulandı!' });
  } catch (err) {
    console.error('[dogrulama/gsm/dogrula]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/dogrulama/kyc
router.post('/kyc', authMiddleware, async (req, res) => {
  const { kimlik_foto_url, selfie_foto_url } = req.body;
  try {
    const { rows: [k] } = await pool.query(
      `INSERT INTO kyc_dogrulama (user_id, kimlik_foto_url, selfie_foto_url, status)
       VALUES ($1,$2,$3,'bekliyor')
       ON CONFLICT (user_id) DO UPDATE SET kimlik_foto_url=$2, selfie_foto_url=$3, status='bekliyor', updated_at=NOW()
       RETURNING *`, [req.user.id, kimlik_foto_url, selfie_foto_url]);
    res.json(k);
  } catch (err) {
    console.error('[dogrulama/kyc]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /api/dogrulama/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { rows: [u] } = await pool.query(
      `SELECT email_dogrulandi, telefon_dogrulandi, kyc_dogrulandi FROM users WHERE id=$1`, [req.user.id]);
    const { rows: [kyc] } = await pool.query(
      `SELECT status, admin_notu FROM kyc_dogrulama WHERE user_id=$1`, [req.user.id]);
    res.json({ ...u, kyc_basvuru: kyc || null });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
