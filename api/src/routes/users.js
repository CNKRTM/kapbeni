const router = require('express').Router();
const multer = require('multer');
const sharp = require('sharp');
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8*1024*1024 } });

router.post('/avatar', authMiddleware, upload.single('avatar'), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ hata:'Görsel gerekli' });
    if(!/^image\//.test(req.file.mimetype||'')) return res.status(400).json({ hata:'Sadece görsel yüklenebilir' });
    const dir='/var/www/kapbeni/uploads/avatars';
    const fname=`u${req.user.id}.webp`;
    await sharp(req.file.buffer).resize(400,400,{fit:'cover'}).webp({quality:82}).toFile(`${dir}/${fname}`);
    const t=(await query('SELECT EXTRACT(EPOCH FROM NOW())::bigint as t')).rows[0].t;
    const url=`/uploads/avatars/${fname}?v=${t}`;
    await query('UPDATE users SET avatar_url=$1 WHERE id=$2',[url, req.user.id]);
    await auditLog('user.avatar','api',{ userId:req.user.id });
    res.json({ ok:true, avatar_url:url });
  }catch(e){ res.status(500).json({ hata:e.message }); }
});
router.get('/me', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT * FROM users WHERE id=$1',[req.user.id]);
  if(rows[0]) delete rows[0].password_hash;
  res.json(rows[0]||{});
});
function normPhone(p){
  if(p==null||p==='') return null;
  let d=String(p).replace(/\D/g,'');
  if(d.startsWith('90') && d.length>=12) d=d.slice(2);
  if(d.length===10 && d.startsWith('5')) d='0'+d;
  if(d.length>11) d=d.slice(0,11);
  return d;
}
router.put('/profil', authMiddleware, async (req,res)=>{
  try{
    const {ad,soyad,hakkinda,phone,sehir,ilce,takma_ad,takma_ad_aktif}=req.body;
    const np=normPhone(phone);
    const cur=(await query('SELECT phone FROM users WHERE id=$1',[req.user.id])).rows[0];
    const phoneChanged = !!(np && cur && np!==cur.phone);
    await query(`UPDATE users SET ad=COALESCE($1,ad), soyad=COALESCE($2,soyad), hakkinda=COALESCE($3,hakkinda),
       phone=COALESCE($4,phone), sehir=COALESCE($5,sehir), ilce=COALESCE($6,ilce),
       takma_ad=COALESCE($7,takma_ad), takma_ad_aktif=COALESCE($8,takma_ad_aktif),
       phone_verified = CASE WHEN $9 THEN false ELSE phone_verified END
       WHERE id=$10`,
       [ad, soyad, hakkinda, np, sehir, ilce, takma_ad,
        (typeof takma_ad_aktif==='boolean'?takma_ad_aktif:null), phoneChanged, req.user.id]);
    res.json({ok:true, phone: np||cur?.phone, phone_verified_reset: phoneChanged});
  }catch(e){
    if(String(e.message).includes('users_phone_key')) return res.status(409).json({hata:'Bu telefon numarası zaten kullanılıyor'});
    res.status(500).json({hata:e.message});
  }
});
router.put('/gizlilik', authMiddleware, async (req,res)=>{
  await query('UPDATE users SET gizlilik=$1 WHERE id=$2',[JSON.stringify(req.body),req.user.id]); res.json({ok:true});
});
router.put('/bildirimler', authMiddleware, async (req,res)=>{
  await query('UPDATE users SET bildirim_tercih=$1 WHERE id=$2',[JSON.stringify(req.body),req.user.id]); res.json({ok:true});
});
router.delete('/me', authMiddleware, async (req,res)=>{
  await query("UPDATE users SET durum='deleted' WHERE id=$1",[req.user.id]);
  await auditLog('user.silindi','api',{userId:req.user.id});
  res.json({ok:true, mesaj:'Hesabınız silindi'});
});
module.exports=router;
