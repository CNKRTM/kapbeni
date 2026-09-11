const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { konu, mesaj, kategori, ilan_id, islem_id } = req.body;
    const { rows } = await query(
      'INSERT INTO support_tickets(user_id,konu,mesaj,kategori,ilan_id,islem_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, konu, mesaj, kategori||'genel', ilan_id||null, islem_id||null]
    );
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

router.get('/benim', authMiddleware, async (req, res) => {
  const { rows } = await query('SELECT * FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
});

router.get('/:uuid', authMiddleware, async (req, res) => {
  const { rows } = await query('SELECT * FROM support_tickets WHERE uuid=$1 AND user_id=$2', [req.params.uuid, req.user.id]);
  if (!rows[0]) return res.status(404).json({ hata: 'Ticket bulunamadı' });
  const { rows: yanitlar } = await query('SELECT * FROM ticket_yanıtlar WHERE ticket_id=$1 ORDER BY id', [rows[0].id]);
  res.json({ ...rows[0], yanitlar });
});

module.exports = router;
