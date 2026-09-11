const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  const r = await pool.query('SELECT * FROM adresler WHERE kullanici_id=$1 ORDER BY id', [req.user.id]);
  res.json(r.rows);
});
router.post('/', authenticateToken, async (req, res) => {
  const { baslik, adres_satiri, ilce, il, posta_kodu, ulke } = req.body;
  const r = await pool.query('INSERT INTO adresler (kullanici_id,baslik,adres_satiri,ilce,il,posta_kodu,ulke) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.user.id, baslik, adres_satiri, ilce, il, posta_kodu, ulke || 'Türkiye']);
  res.json(r.rows[0]);
});
router.put('/:id', authenticateToken, async (req, res) => {
  const { baslik, adres_satiri, ilce, il, posta_kodu } = req.body;
  await pool.query('UPDATE adresler SET baslik=$1,adres_satiri=$2,ilce=$3,il=$4,posta_kodu=$5 WHERE id=$6 AND kullanici_id=$7',
    [baslik, adres_satiri, ilce, il, posta_kodu, req.params.id, req.user.id]);
  res.json({ ok: true });
});
router.delete('/:id', authenticateToken, async (req, res) => {
  await pool.query('DELETE FROM adresler WHERE id=$1 AND kullanici_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});
module.exports = router;
