const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/ozet', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT bekleyen_kazanc,toplam_kazanc,iban,ad,soyad FROM users WHERE id=$1',[req.user.id]);
  res.json(rows[0]||{});
});
router.get('/hareketler', authMiddleware, async (req,res)=>{
  const {rows}=await query(`SELECT * FROM islemler WHERE satici_id=$1 ORDER BY id DESC LIMIT 50`,[req.user.id]);
  res.json(rows);
});
router.put('/iban', authMiddleware, async (req,res)=>{
  const {iban}=req.body;
  if(!/^TR[0-9]{24}$/.test((iban||'').replace(/\s/g,''))) return res.status(400).json({hata:'Geçersiz IBAN'});
  await query('UPDATE users SET iban=$1 WHERE id=$2',[iban.replace(/\s/g,''),req.user.id]);
  res.json({ok:true});
});
router.post('/cek', authMiddleware, async (req,res)=>{ res.json({ok:true, mesaj:'Ödeme talebiniz alındı, 1-3 iş günü içinde IBAN’ınıza aktarılacak.'}); });
module.exports=router;
