// overnight5 Phase 2 — additive Ilan-Routen (eigene Datei, VOR ilanlar.js gemountet,
// damit /boosted etc. nicht vom /:uuid-Detailhandler geschluckt werden).
// An echtes Schema angepasst: kein i.fotolar/i.il/u.ad_soyad — Foto via ilan_fotograflar-Subquery,
// Ort via sehir/ilce, Name aus ad/soyad.
const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); // { query, pool, auditLog } → pool.query()
const { authMiddleware } = require('../middleware/auth');

// ── Boosted İlanlar für Homepage ──────────────────────────────────────────
router.get('/boosted', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.id, i.uuid, i.baslik, i.fiyat, i.sehir, i.ilce, i.boost_type, i.ilan_numarasi, i.views,
             (u.ad || ' ' || COALESCE(u.soyad,'')) AS satici_ad,
             (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) AS ana_foto
      FROM ilanlar i JOIN users u ON u.id = i.user_id
      WHERE i.parked = FALSE AND i.boost_type IS NOT NULL
      ORDER BY RANDOM() LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    console.error('[ilanlar/boosted]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ── İlan Takip Et / Bırak (toggle) ───────────────────────────────────────
router.post('/:id/takip', authMiddleware, async (req, res) => {
  const ilan_id = parseInt(req.params.id);
  const user_id = req.user.id;
  if (!ilan_id) return res.status(400).json({ error: 'Geçersiz ilan' });
  try {
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM ilan_takipciler WHERE ilan_id=$1 AND user_id=$2`, [ilan_id, user_id]);
    if (existing) {
      await pool.query(`DELETE FROM ilan_takipciler WHERE ilan_id=$1 AND user_id=$2`, [ilan_id, user_id]);
      res.json({ takip: false });
    } else {
      await pool.query(
        `INSERT INTO ilan_takipciler (ilan_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [ilan_id, user_id]);
      res.json({ takip: true });
    }
  } catch (err) {
    console.error('[ilanlar/takip]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ── Takip durumu + Sayı ───────────────────────────────────────────────────
router.get('/:id/takip', authMiddleware, async (req, res) => {
  const ilan_id = parseInt(req.params.id);
  const user_id = req.user.id;
  try {
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM ilan_takipciler WHERE ilan_id=$1 AND user_id=$2`, [ilan_id, user_id]);
    const { rows: [count] } = await pool.query(
      `SELECT COUNT(*) AS sayi FROM ilan_takipciler WHERE ilan_id=$1`, [ilan_id]);
    res.json({ takip: !!existing, sayi: parseInt(count.sayi) });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ── Fiyat Güncelle + Takipçilere Mail (Stub) ─────────────────────────────
router.patch('/:id/fiyat', authMiddleware, async (req, res) => {
  const ilan_id = parseInt(req.params.id);
  const { fiyat } = req.body;
  const user_id = req.user.id;
  try {
    const { rows: [ilan] } = await pool.query(
      `SELECT fiyat, baslik, user_id FROM ilanlar WHERE id=$1`, [ilan_id]);
    if (!ilan || ilan.user_id !== user_id) return res.status(403).json({ error: 'Yetkisiz' });
    const eskiFiyat = parseFloat(ilan.fiyat);
    const yeniFiyat = parseFloat(fiyat);
    if (!(yeniFiyat > 0)) return res.status(400).json({ error: 'Geçersiz fiyat' });
    await pool.query(`UPDATE ilanlar SET fiyat=$1 WHERE id=$2`, [yeniFiyat, ilan_id]);
    if (yeniFiyat < eskiFiyat) {
      const { rows: takipciler } = await pool.query(`
        SELECT u.email, (u.ad || ' ' || COALESCE(u.soyad,'')) AS ad_soyad
        FROM ilan_takipciler t JOIN users u ON u.id = t.user_id WHERE t.ilan_id = $1`, [ilan_id]);
      for (const t of takipciler) {
        console.log(`[MAIL] Fiyat düşüşü: ${t.email} | ${ilan.baslik} | ${eskiFiyat}→${yeniFiyat} TL`);
      }
    }
    res.json({ ok: true, fiyat: yeniFiyat });
  } catch (err) {
    console.error('[ilanlar/fiyat]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ── Views incrementieren ──────────────────────────────────────────────────
router.post('/:id/view', async (req, res) => {
  try {
    await pool.query(`UPDATE ilanlar SET views = COALESCE(views,0) + 1 WHERE id=$1`, [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
