// overnight7 — Kapbeni Kazancım (Dashboard-Tab)
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

// GET /api/kazanc
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows: [u] } = await pool.query(`SELECT kazanc_bakiye FROM users WHERE id=$1`, [req.user.id]);
    const { rows: hareketler } = await pool.query(
      `SELECT id, tip, miktar, aciklama, created_at FROM kazanc_hareketler
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
    res.json({ bakiye: parseFloat(u?.kazanc_bakiye || 0), bekleyen: 0, hareketler });
  } catch (err) {
    console.error('[kazanc]', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
