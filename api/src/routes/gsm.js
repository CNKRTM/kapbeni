const router = require('express').Router();
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const OTP = '123456'; // MVP-Sim (SMS-Provider = OFFENER PUNKT)

router.get('/durum', authMiddleware, async (req,res)=>{
  const { rows } = await query('SELECT phone, phone_verified FROM users WHERE id=$1',[req.user.id]);
  res.json({ phone: rows[0]?.phone, phone_verified: !!rows[0]?.phone_verified });
});
router.post('/gonder', authMiddleware, async (req,res)=>{
  const { phone } = req.body||{};
  if(phone) await query('UPDATE users SET phone=$1 WHERE id=$2',[phone, req.user.id]);
  res.json({ ok:true, mesaj:'Doğrulama kodu telefonunuza gönderildi (MVP: 123456)' });
});
router.post('/dogrula', authMiddleware, async (req,res)=>{
  const { kod } = req.body||{};
  if(String(kod).trim() !== OTP) return res.status(400).json({ hata:'Kod hatalı' });
  await query('UPDATE users SET phone_verified=true WHERE id=$1',[req.user.id]);
  await auditLog('gsm.dogrulandi','api',{ userId:req.user.id });
  res.json({ ok:true, phone_verified:true });
});
module.exports = router;
