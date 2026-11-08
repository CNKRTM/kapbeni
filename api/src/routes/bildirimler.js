// Benachrichtigungen im Konto. Erzeugt werden sie in lib/bildirim.js (v1.35).
const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const sayilar = async (userId) => {
  const { rows } = await query(
    `SELECT (SELECT count(*)::int FROM bildirimler WHERE user_id=$1 AND okundu=false) AS bildirim,
            (SELECT count(*)::int FROM mesajlar m JOIN konusmalar k ON k.id=m.konusma_id
              WHERE (k.alici_id=$1 OR k.satici_id=$1) AND m.gonderen_id<>$1 AND m.okundu=false) AS mesaj`, [userId]);
  return rows[0];
};

// Liste (neueste zuerst) + ungelesen-Zaehler
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { rows } = await query(
      `SELECT id, tip, baslik, icerik, link, okundu, olusturma_tarihi FROM bildirimler
        WHERE user_id=$1 ORDER BY olusturma_tarihi DESC, id DESC LIMIT $2`, [req.user.id, limit]);
    const s = await sayilar(req.user.id);
    res.json({ bildirimler: rows, okunmamis: s.bildirim, mesaj_okunmamis: s.mesaj });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// Nur die Zaehler — fuer Glocke und Mesajlar-Abzeichen (alle 30 s)
router.get('/ozet', authMiddleware, async (req, res) => {
  try { res.json(await sayilar(req.user.id)); }
  catch (e) { res.status(500).json({ hata: e.message }); }
});

router.put('/tumu-oku', authMiddleware, async (req, res) => {
  await query('UPDATE bildirimler SET okundu=true WHERE user_id=$1 AND okundu=false', [req.user.id]);
  res.json({ ok: true });
});
const idGecerli = (req, res, next) => (/^\d+$/.test(req.params.id) ? next() : res.status(400).json({ hata: 'Geçersiz id' }));
router.put('/:id/oku', authMiddleware, idGecerli, async (req, res) => {
  await query('UPDATE bildirimler SET okundu=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});
router.delete('/:id', authMiddleware, idGecerli, async (req, res) => {
  await query('DELETE FROM bildirimler WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});
module.exports = router;
