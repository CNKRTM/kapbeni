const router = require('express').Router();
const crypto = require('crypto');
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const OTP='123456'; // MVP-Sim (SMS-Provider = OFFENER PUNKT #7)
const SALT = process.env.JWT_SECRET || 'sg_salt';

// TR TC Kimlik No Prüfziffer-Validierung
function tcGecerli(tc){
  if(!/^[1-9][0-9]{10}$/.test(tc)) return false;
  const d=tc.split('').map(Number);
  const t1=d[0]+d[2]+d[4]+d[6]+d[8], t2=d[1]+d[3]+d[5]+d[7];
  if(((t1*7 - t2)%10+10)%10 !== d[9]) return false;
  if((d.slice(0,10).reduce((a,b)=>a+b,0))%10 !== d[10]) return false;
  return true;
}

router.get('/durum', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT satici_dogrulama, e_devlet_dogrulandi, kimlik_dogrulama_tipi FROM users WHERE id=$1',[req.user.id]);
  res.json({ durum: rows[0]?.satici_dogrulama||'dogrulanmadi', e_devlet: !!rows[0]?.e_devlet_dogrulandi, tip: rows[0]?.kimlik_dogrulama_tipi });
});
// e-Devlet MVP: Ad, Soyad, İl (+ optional TC-No)
router.post('/edevlet', authMiddleware, async (req,res)=>{
  const {ad,soyad,il,tc_no}=req.body;
  if(!ad||!soyad||!il) return res.status(400).json({hata:'Ad, soyad ve il gerekli'});
  if(tc_no && !tcGecerli(tc_no)) return res.status(400).json({hata:'Geçersiz T.C. Kimlik No'});
  await query("UPDATE users SET satici_dogrulama='bekliyor' WHERE id=$1",[req.user.id]);
  // TC-No temporär (gehasht erst nach OTP); hier nur Format geprüft
  res.json({ ok:true, mesaj:'Doğrulama kodu telefonunuza gönderildi (MVP: 123456)' });
});
router.post('/otp', authMiddleware, async (req,res)=>{
  const {kod,tc_no}=req.body;
  if(kod!==OTP) return res.status(400).json({hata:'Kod hatalı'});
  let hash=null;
  if(tc_no && tcGecerli(tc_no)) hash=crypto.createHash('sha256').update(tc_no+SALT).digest('hex');
  await query(`UPDATE users SET satici_dogrulama='dogrulandi', e_devlet_dogrulandi=true,
     e_devlet_dogrulama_tarihi=NOW(), kimlik_dogrulama_tipi='otp_simule',
     tc_no_hash=COALESCE($2,tc_no_hash) WHERE id=$1`,[req.user.id, hash]);
  await auditLog('satici.dogrulandi','api',{userId:req.user.id});
  res.json({ ok:true, durum:'dogrulandi' });
});
module.exports=router;
