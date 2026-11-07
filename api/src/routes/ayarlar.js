const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken } = require('../middleware/auth');
const { telefonNormalize, vergiNoGecerli, TELEFON_HATA, VKN_HATA } = require('../lib/dogrula');

const ALLOWED = ['ad','soyad','phone','hakkinda','sehir','ilce','hesap_tipi','firma_adi','vkn',
  'vergi_dairesi','mersis_no','ticari_adres','yetkili_kisi','sektor','takma_ad','takma_ad_aktif',
  'bildirim_mesaj','bildirim_teklif','bildirim_ilan','bildirim_email','bildirim_sms'];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    if (r.rows[0]) delete r.rows[0].password_hash;
    res.json(r.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/', authenticateToken, async (req, res) => {
  const body = { ...req.body };
  // ── Pruefungen (Auftragssammlung F) — Fehlertexte tuerkisch im Feld `hata` ──
  if (body.phone !== undefined) {
    if (body.phone === null || String(body.phone).trim() === '') delete body.phone;   // phone ist NOT NULL
    else {
      const np = telefonNormalize(body.phone);
      if (!np) return res.status(400).json({ hata: TELEFON_HATA, alan: 'phone' });
      body.phone = np;
    }
  }
  if (body.hesap_tipi !== undefined && !['bireysel', 'kurumsal'].includes(body.hesap_tipi))
    return res.status(400).json({ hata: 'Geçersiz hesap türü.', alan: 'hesap_tipi' });
  if (body.vkn !== undefined && body.vkn !== null && String(body.vkn).trim() !== '') {
    const v = String(body.vkn).replace(/\D/g, '');
    if (!vergiNoGecerli(v)) return res.status(400).json({ hata: VKN_HATA, alan: 'vkn' });
    body.vkn = v;
  }
  if (body.mersis_no !== undefined && body.mersis_no !== null && String(body.mersis_no).trim() !== '') {
    const m = String(body.mersis_no).replace(/\D/g, '');
    if (!/^\d{16}$/.test(m)) return res.status(400).json({ hata: 'MERSİS No 16 haneli olmalıdır.', alan: 'mersis_no' });
    body.mersis_no = m;
  }

  const fields = Object.keys(body).filter(k => ALLOWED.includes(k));
  if (fields.length === 0) return res.json({ ok: true });
  // Eine geaenderte Nummer ist nicht mehr bestaetigt.
  let telefonNeu = false;
  if (body.phone) {
    const { rows } = await pool.query('SELECT phone FROM users WHERE id=$1', [req.user.id]);
    telefonNeu = !!rows[0] && rows[0].phone !== body.phone;
  }
  const sets = fields.map((f, i) => `${f}=$${i + 1}`);
  if (telefonNeu) sets.push('phone_verified=false');
  const vals = fields.map(f => body[f]);
  try {
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=$${fields.length + 1}`, [...vals, req.user.id]);
    res.json({ ok: true, phone: body.phone, phone_verified_reset: telefonNeu });
  } catch (err) {
    if (String(err.message).includes('users_phone_key'))
      return res.status(409).json({ hata: 'Bu telefon numarası zaten kullanılıyor', alan: 'phone' });
    console.error('[ayarlar] PATCH:', err.message);
    res.status(500).json({ hata: 'Ayarlar kaydedilemedi.' });
  }
});
module.exports = router;
