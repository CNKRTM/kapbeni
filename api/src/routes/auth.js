const router = require('express').Router();
const { girisKaydet } = require('../services/geoService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, auditLog } = require('../db/pool');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const token = (user) => jwt.sign(
  { id: user.id, uuid: user.uuid, rol: user.rol, kaynak: 'api' },
  process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN }
);

// Kayıt
router.post('/kayit', async (req, res) => {
  try {
    const { email, phone, password, ad, soyad, sehir, ilce } = req.body;
    if (!email||!phone||!password) return res.status(400).json({ hata: 'Gerekli alanlar eksik' });
    const mevcut = await query('SELECT id FROM users WHERE email=$1 OR phone=$2', [email, phone]);
    if (mevcut.rows[0]) return res.status(409).json({ hata: 'Email veya telefon zaten kayıtlı' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users(email,phone,password_hash,ad,soyad,sehir,ilce)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [email, phone, hash, ad, soyad, sehir, ilce]
    );
    await auditLog('user.kayit', 'api', { userId: rows[0].id, ip: req.ip });
    await query("UPDATE users SET kullanici_no='SG-'||LPAD(id::TEXT,8,'0') WHERE id=$1",[rows[0].id]);
    girisKaydet(query, rows[0].id, req, true);
    res.status(201).json({ token: token(rows[0]), user: { id: rows[0].id, email, ad, soyad } });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Giriş
router.post('/giris', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows[0]) return res.status(401).json({ hata: 'Kullanıcı bulunamadı' });
    if (rows[0].durum !== 'aktif') return res.status(403).json({ hata: 'Hesabınız askıya alındı', sebep: rows[0].ban_sebebi });
    if (!await bcrypt.compare(password, rows[0].password_hash))
      return res.status(401).json({ hata: 'Şifre hatalı' });
    await auditLog('user.giris', 'api', { userId: rows[0].id, ip: req.ip });
    girisKaydet(query, rows[0].id, req, true);
    res.json({ token: token(rows[0]), user: { id: rows[0].id, email: rows[0].email, ad: rows[0].ad } });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Profil (token ile)
router.get('/ben', require('../middleware/auth').authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, k.durum as kyc_durum FROM users u
     LEFT JOIN kyc_results k ON k.user_id=u.id AND k.id=(SELECT MAX(id) FROM kyc_results WHERE user_id=u.id)
     WHERE u.id=$1`, [req.user.id]
  );
  const u = rows[0];
  delete u.password_hash;
  res.json(u);
});

// KYC webhook için /api/kyc/webhook kullanılır (routes/kyc.js)
// Tüm cihazlardan çıkış (basit: istemci token'ı siler; sunucu audit)
router.post('/logout-all', require('../middleware/auth').authMiddleware, async (req, res) => {
  await auditLog('user.logout_all','api',{userId:req.user.id});
  res.json({ ok:true });
});

module.exports = router;
