const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT * FROM kayitli_aramalar WHERE user_id=$1 ORDER BY id DESC',[req.user.id]);
  res.json(rows);
});
router.post('/', authMiddleware, async (req,res)=>{
  const {arama_terimi,kategori_id,fiyat_min,fiyat_max}=req.body;
  const {rows}=await query(`INSERT INTO kayitli_aramalar(user_id,arama_terimi,kategori_id,fiyat_min,fiyat_max)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.user.id,arama_terimi,kategori_id||null,fiyat_min||null,fiyat_max||null]);
  res.status(201).json(rows[0]);
});
router.delete('/:id', authMiddleware, async (req,res)=>{
  await query('DELETE FROM kayitli_aramalar WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]); res.json({ok:true});
});
router.put('/:id/bildirim', authMiddleware, async (req,res)=>{
  const {rows}=await query('UPDATE kayitli_aramalar SET bildirim_aktif=NOT bildirim_aktif WHERE id=$1 AND user_id=$2 RETURNING *',[req.params.id,req.user.id]);
  res.json(rows[0]||{});
});
module.exports=router;
