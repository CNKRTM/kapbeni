const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ hata: 'Token gerekli' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.kaynak !== 'api') return res.status(403).json({ hata: 'Geçersiz token' });
    const { rows } = await query('SELECT * FROM users WHERE id=$1 AND durum=$2', [decoded.id, 'aktif']);
    if (!rows[0]) return res.status(401).json({ hata: 'Kullanıcı bulunamadı' });
    req.user = rows[0];
    next();
  } catch(e) { res.status(401).json({ hata: 'Geçersiz token' }); }
};

// KYC opsiyonel: sadece /etc/kapbeni.env içinde KYC_ENABLED=true ise zorunlu.
// Aksi halde (KYC offline / devre dışı) doğrulama atlanır, kullanıcı KYC olmadan ilan verebilir.
const kycGerekli = async (req, res, next) => {
  if (process.env.KYC_ENABLED !== 'true') return next();
  const { rows } = await query(
    'SELECT durum FROM kyc_results WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [req.user.id]
  );
  if (!rows[0] || rows[0].durum !== 'onaylandi')
    return res.status(403).json({ hata: 'KYC doğrulaması gerekli', kyc_gerekli: true });
  next();
};

const requireAdmin = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user && req.user.rol === 'admin') return next();
    return res.status(403).json({ hata: 'Yetkisiz erişim' });
  });
};

module.exports = { authMiddleware, kycGerekli, requireAdmin };
