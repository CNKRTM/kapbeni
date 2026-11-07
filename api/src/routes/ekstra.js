const router = require('express').Router();
const { pool } = require('../db/pool');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// WhatsApp Ayar
router.get('/whatsapp-ayar', async (req, res) => {
  const r = await pool.query('SELECT aktif, telefon, durum FROM whatsapp_ayar LIMIT 1');
  res.json(r.rows[0] || {});
});
router.patch('/whatsapp-ayar', requireAdmin, async (req, res) => {
  const { aktif, telefon, api_key, durum } = req.body;
  const ex = await pool.query('SELECT id FROM whatsapp_ayar LIMIT 1');
  if (ex.rows.length) {
    await pool.query('UPDATE whatsapp_ayar SET aktif=COALESCE($1,aktif), telefon=COALESCE($2,telefon), api_key=COALESCE($3,api_key), durum=COALESCE($4,durum) WHERE id=$5',
      [aktif, telefon, api_key, durum, ex.rows[0].id]);
  } else {
    await pool.query('INSERT INTO whatsapp_ayar (aktif,telefon,api_key,durum) VALUES($1,$2,$3,$4)', [aktif, telefon, api_key, durum || 'offline']);
  }
  res.json({ ok: true });
});

// Kurumsal Onay (Admin)
router.get('/admin/kurumsal-bekleyenler', requireAdmin, async (req, res) => {
  const r = await pool.query(`SELECT id, ad, soyad, email, firma_adi, vkn, mersis_no, ticari_adres, yetkili_kisi, sektor, created_at
     FROM users WHERE hesap_tipi='kurumsal' AND kurumsal_onaylandi=false ORDER BY created_at DESC`);
  res.json(r.rows);
});
router.patch('/admin/kurumsal-onayla/:id', requireAdmin, async (req, res) => {
  await pool.query('UPDATE users SET kurumsal_onaylandi=$1 WHERE id=$2', [req.body.onay, req.params.id]);
  res.json({ ok: true });
});

// Anlaşma Notu
router.post('/anlasma-notu', authMiddleware, async (req, res) => {
  const { konusma_id, fiyat, urun_adi, teslimat_yontemi } = req.body;
  const r = await pool.query(`INSERT INTO anlasma_notlari (konusma_id,olusturan_id,fiyat,urun_adi,teslimat_yontemi,olusturulma)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`, [konusma_id || null, req.user.id, fiyat, urun_adi, teslimat_yontemi]);
  res.json({ ok: true, not: r.rows[0] });
});
router.get('/anlasma-notu/:konusmaId', authMiddleware, async (req, res) => {
  const r = await pool.query('SELECT * FROM anlasma_notlari WHERE konusma_id=$1 ORDER BY olusturulma DESC', [req.params.konusmaId]);
  res.json(r.rows);
});

// Hesap Silme — einziger Weg (lib/hesapSilme.js, Auftragssammlung H):
// Status silme_bekliyor, 30 Tage Frist, Anmeldung widerruft, danach Cron-Anonymisierung.
const hesapSilme = require('../lib/hesapSilme');
async function hesapSilRoute(req, res) {
  try {
    const { silinecek_tarih } = await hesapSilme.silmeTalebi(req.user.id, { ip: req.ip });
    res.json({ ok: true, silinecek_tarih,
      mesaj: `Hesabınız ${new Date(silinecek_tarih).toLocaleDateString('tr-TR')} tarihinde silinecek. Bu tarihe kadar giriş yaparak iptal edebilirsiniz.` });
  } catch (e) {
    console.error('[hesap/sil]', e.message);
    res.status(e.status || 500).json({ hata: e.status ? e.message : 'Hesap silme talebi alınamadı. Lütfen tekrar deneyin.' });
  }
}
router.delete('/hesap/sil', authMiddleware, hesapSilRoute);
router.hesapSilRoute = hesapSilRoute;
router.post('/auth/cikis-tumcihaz', authMiddleware, async (req, res) => {
  await pool.query('UPDATE users SET token_version=COALESCE(token_version,0)+1 WHERE id=$1', [req.user.id]);
  res.json({ ok: true });
});
module.exports = router;
