const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/durum', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT * FROM odul_kazanimlari WHERE user_id=$1 AND acildi_mi=false ORDER BY id DESC LIMIT 1',[req.user.id]);
  res.json({acilabilir_sandik: !!rows[0], sandik: rows[0]||null});
});
router.post('/ac', authMiddleware, async (req,res)=>{
  // deterministischer Pseudo-Reward (kein Math.random im Env erlaubt)
  const seed=(req.user.id*2654435761)>>>0; const tipler=['kupon','kredi','vitamin'];
  const tip=tipler[seed%3]; const deger=[10,25,50][ (seed>>3)%3 ];
  const {rows}=await query(`INSERT INTO odul_kazanimlari(user_id,odul_tipi,odul_degeri,acildi_mi)
    VALUES($1,$2,$3,true) RETURNING *`,[req.user.id,tip,deger]);
  res.json({odul:rows[0], mesaj:`Tebrikler! ${deger} ${tip==='kredi'?'TL kredi':tip} kazandın!`});
});
router.get('/gecmis', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT * FROM odul_kazanimlari WHERE user_id=$1 AND acildi_mi=true ORDER BY id DESC',[req.user.id]);
  res.json(rows);
});
module.exports=router;
