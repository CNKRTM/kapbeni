const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const PAKETLER=[{tutar:500,fiyat:475},{tutar:1000,fiyat:900},{tutar:2500,fiyat:2125},{tutar:5000,fiyat:4000},{tutar:10000,fiyat:7500}];
router.get('/paketler',(req,res)=>res.json(PAKETLER));
router.get('/bakiye', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT kredi_bakiye FROM users WHERE id=$1',[req.user.id]);
  res.json({bakiye:Number(rows[0]?.kredi_bakiye||0)});
});
router.get('/hareketler', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT * FROM kredi_hareketler WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.user.id]);
  res.json(rows);
});
router.post('/satin-al', authMiddleware, async (req,res)=>{
  const {tutar}=req.body; const pk=PAKETLER.find(p=>p.tutar===Number(tutar));
  if(!pk) return res.status(400).json({hata:'Geçersiz paket'});
  await query('UPDATE users SET kredi_bakiye=COALESCE(kredi_bakiye,0)+$1 WHERE id=$2',[pk.tutar,req.user.id]);
  await query(`INSERT INTO kredi_hareketler(user_id,tutar,tip,aciklama) VALUES($1,$2,'satin-alma',$3)`,[req.user.id,pk.tutar,`${pk.tutar} TL kredi (${pk.fiyat} TL ödeme)`]);
  res.json({ok:true, odeme_gerekli:pk.fiyat});
});
module.exports=router;
