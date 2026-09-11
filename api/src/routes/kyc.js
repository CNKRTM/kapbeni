const router = require('express').Router();
const multer = require('multer');
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 4 } });
const KYC_URL = process.env.KYC_INTERNAL_URL || 'http://localhost:8001';
const SECRET  = process.env.KYC_WEBHOOK_SECRET;

async function durumYaz(userId, durum, sebep) {
  await query(
    `UPDATE users SET kyc_durumu=$1, kyc_tamamlandi_at=NOW(), kyc_red_sebebi=$2 WHERE id=$3`,
    [durum, sebep || null, userId]
  );
}

// Mevcut KYC durumu
router.get('/durum', authMiddleware, async (req, res) => {
  try {
    const { rows: u } = await query('SELECT kyc_durumu, kyc_tamamlandi_at, kyc_red_sebebi FROM users WHERE id=$1', [req.user.id]);
    const { rows: k } = await query('SELECT durum, selfie_score, red_sebebi, created_at FROM kyc_results WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [req.user.id]);
    res.json({
      kyc_durumu: u[0]?.kyc_durumu || 'beklemede',
      durum: k[0]?.durum || u[0]?.kyc_durumu || 'beklemede',
      detay: k[0] || null,
      tamamlandi_at: u[0]?.kyc_tamamlandi_at || null,
    });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// Kimlik + selfie gönder → KYC servisine (8001) ilet
router.post('/submit', authMiddleware,
  upload.fields([
    { name: 'idPhoto', maxCount: 1 }, { name: 'kimlik_on', maxCount: 1 },
    { name: 'kimlik_arka', maxCount: 1 }, { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const f = req.files || {};
      const on   = f.idPhoto?.[0] || f.kimlik_on?.[0];
      const arka = f.kimlik_arka?.[0] || on;              // arka yüz opsiyonel → ön yüzü kullan
      const selfie = f.selfie?.[0];
      if (!on || !selfie) return res.status(400).json({ hata: 'Kimlik fotoğrafı ve selfie gerekli' });

      const fd = new FormData();
      fd.append('kimlik_on',   new Blob([on.buffer],   { type: on.mimetype }),   'kimlik_on.jpg');
      fd.append('kimlik_arka', new Blob([arka.buffer], { type: arka.mimetype }), 'kimlik_arka.jpg');
      fd.append('selfie',      new Blob([selfie.buffer],{ type: selfie.mimetype }),'selfie.jpg');

      const resp = await fetch(`${KYC_URL}/verify?user_id=${req.user.id}`, {
        method: 'POST', body: fd, headers: { 'x-kyc-secret': SECRET },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return res.status(502).json({ hata: 'KYC doğrulama başarısız: ' + (data.detail || resp.statusText) });

      // users tablosunu senkron tut (early-reject webhook göndermeyebilir)
      await durumYaz(req.user.id, data.durum, data.sebep);
      await auditLog('kyc.submit', 'api', { userId: req.user.id, detay: { durum: data.durum } });
      res.json(data);
    } catch (e) {
      res.status(502).json({ hata: 'KYC servisine ulaşılamadı: ' + e.message });
    }
  }
);

// KYC webhook — KYC servisi çağırır (secret korumalı). Payload: {user_id, durum} veya {user_id, onaylandi, skor}
router.post('/webhook', async (req, res) => {
  const secret = req.headers['x-kyc-secret'] || req.headers['x-webhook-secret'];
  if (secret !== SECRET) return res.status(403).json({ hata: 'Yetkisiz' });
  const { user_id } = req.body;
  let durum = req.body.durum;
  if (!durum && typeof req.body.onaylandi !== 'undefined') durum = req.body.onaylandi ? 'onaylandi' : 'reddedildi';
  await durumYaz(user_id, durum);
  await auditLog('kyc.webhook', 'kyc', { userId: user_id, detay: { durum } });
  res.json({ ok: true });
});

module.exports = router;
