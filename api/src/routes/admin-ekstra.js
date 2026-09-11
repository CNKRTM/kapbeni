// overnight5 Phase 4b — additive Admin-Routen (nach admin.js gemountet; keine Kollision).
// Angepasst: u.ad_soyad existiert nicht → aus ad/soyad. Übersprungen: degerlendirmeler
// (Plan nutzt reviewer_id/reviewee_id; real degerlendiren/degerlendirilen) und kyc (schon in admin.js).
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

const AD = "(u.ad || ' ' || COALESCE(u.soyad,''))";

// GET /api/admin/payments
router.get('/payments', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.email, ${AD} AS ad_soyad, i.baslik AS ilan_baslik, i.ilan_numarasi
      FROM payments p LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN ilanlar i ON i.id = p.ilan_id
      ORDER BY p.created_at DESC LIMIT 500`);
    res.json(rows);
  } catch (err) { console.error('[admin/payments]', err.message); res.status(500).json({ error: 'Sunucu hatası' }); }
});

// Coupons CRUD
router.get('/coupons', async (req, res) => {
  try { res.json((await pool.query(`SELECT * FROM coupons ORDER BY created_at DESC`)).rows); }
  catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});
router.post('/coupons', async (req, res) => {
  const { code, name, discount_type, discount_value, applicable_to, valid_from, valid_to, max_uses } = req.body;
  try {
    const { rows: [c] } = await pool.query(
      `INSERT INTO coupons (code,name,discount_type,discount_value,applicable_to,valid_from,valid_to,max_uses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [code, name, discount_type, discount_value, applicable_to || 'all', valid_from || null, valid_to || null, max_uses || null]);
    res.json(c);
  } catch (err) { console.error('[admin/coupons]', err.message); res.status(500).json({ error: 'Sunucu hatası' }); }
});
router.patch('/coupons/:id', async (req, res) => {
  const { name, valid_to, max_uses, applicable_to } = req.body;
  try {
    const { rows: [c] } = await pool.query(
      `UPDATE coupons SET name=$1, valid_to=$2, max_uses=$3, applicable_to=$4 WHERE id=$5 RETURNING *`,
      [name, valid_to, max_uses, applicable_to, req.params.id]);
    res.json(c);
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});
router.delete('/coupons/:id', async (req, res) => {
  try { await pool.query(`DELETE FROM coupons WHERE id=$1`, [req.params.id]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

// GET /api/admin/ilan-takip
router.get('/ilan-takip', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.id, i.baslik, i.ilan_numarasi, COUNT(t.id)::int AS takipci_sayisi
      FROM ilanlar i LEFT JOIN ilan_takipciler t ON t.ilan_id = i.id
      GROUP BY i.id ORDER BY takipci_sayisi DESC LIMIT 100`);
    res.json(rows);
  } catch (err) { console.error('[admin/ilan-takip]', err.message); res.status(500).json({ error: 'Sunucu hatası' }); }
});

// GET /api/admin/geri-bildirimler
router.get('/geri-bildirimler', async (req, res) => {
  try { res.json((await pool.query(`SELECT * FROM geri_bildirimler ORDER BY created_at DESC LIMIT 500`)).rows); }
  catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
