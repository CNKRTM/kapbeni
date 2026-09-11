const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.post('/', async (req,res)=>{
  const {kategori,konu,metin,email}=req.body;
  let uid=null; try{ const jwt=require('jsonwebtoken'); const t=req.headers.authorization?.split(' ')[1]; if(t){uid=jwt.verify(t,process.env.JWT_SECRET).id;} }catch{}
  const {rows}=await query(`INSERT INTO geri_bildirimler(user_id,kategori,konu,metin,email) VALUES($1,$2,$3,$4,$5) RETURNING id`,[uid,kategori,konu,metin,email]);
  res.status(201).json({ok:true,id:rows[0].id});
});
module.exports=router;
