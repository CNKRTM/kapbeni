const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/', authMiddleware, async (req,res)=>{
  const status=req.query.status;
  let cond='user_id=$1'; const p=[req.user.id];
  if(status==='aktif') cond+=' AND kullanildi_mi=false';
  if(status==='kullanildi') cond+=' AND kullanildi_mi=true';
  const {rows}=await query(`SELECT * FROM kuponlar WHERE ${cond} ORDER BY id DESC`,p);
  res.json(rows);
});
router.post('/', authMiddleware, async (req,res)=>{
  const {baslik,indirim_tutari,indirim_tipi,min_sepet,gecerlilik_tarihi}=req.body;
  const kod='SG'+Math.floor(100000+Math.abs(req.user.id*7919+Date.parse(gecerlilik_tarihi||'2026-01-01'))%900000);
  const {rows}=await query(`INSERT INTO kuponlar(user_id,kod,baslik,indirim_tutari,indirim_tipi,min_sepet,gecerlilik_tarihi)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[req.user.id,kod,baslik,indirim_tutari,indirim_tipi||'yuzde',min_sepet||0,gecerlilik_tarihi]);
  res.status(201).json(rows[0]);
});
module.exports=router;
