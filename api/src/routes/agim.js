const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/takip', authMiddleware, async (req,res)=>{
  const {rows}=await query(`SELECT u.id,u.ad,u.soyad,u.avatar_url,u.puan,u.toplam_satis
    FROM takipler t JOIN users u ON u.id=t.takip_edilen WHERE t.takip_eden=$1`,[req.user.id]);
  res.json(rows);
});
router.get('/takipci', authMiddleware, async (req,res)=>{
  const {rows}=await query(`SELECT u.id,u.ad,u.soyad,u.avatar_url,u.puan,u.toplam_satis
    FROM takipler t JOIN users u ON u.id=t.takip_eden WHERE t.takip_edilen=$1`,[req.user.id]);
  res.json(rows);
});
router.post('/takip/:userId', authMiddleware, async (req,res)=>{
  if(Number(req.params.userId)===req.user.id) return res.status(400).json({hata:'Kendinizi takip edemezsiniz'});
  await query(`INSERT INTO takipler(takip_eden,takip_edilen) VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.user.id,req.params.userId]);
  res.json({ok:true});
});
router.delete('/takip/:userId', authMiddleware, async (req,res)=>{
  await query('DELETE FROM takipler WHERE takip_eden=$1 AND takip_edilen=$2',[req.user.id,req.params.userId]);
  res.json({ok:true});
});
router.post('/davet', authMiddleware, (req,res)=>res.json({link:`https://sattimgitti.transas24.com/giris?ref=${req.user.id}`}));
module.exports=router;
