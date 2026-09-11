const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/', authMiddleware, async (req,res)=>{
  const {rows}=await query(`SELECT i.*, k.ad as kategori_ad,
     (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto
     FROM favoriler f JOIN ilanlar i ON i.id=f.ilan_id LEFT JOIN kategoriler k ON k.id=i.kategori_id
     WHERE f.user_id=$1 ORDER BY f.id DESC`,[req.user.id]);
  res.json({ilanlar:rows});
});
router.post('/:uuid', authMiddleware, async (req,res)=>{
  const {rows:il}=await query('SELECT id FROM ilanlar WHERE uuid=$1',[req.params.uuid]);
  if(!il[0]) return res.status(404).json({hata:'İlan yok'});
  await query('INSERT INTO favoriler(user_id,ilan_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,il[0].id]);
  await query('UPDATE ilanlar SET favori_sayisi=(SELECT count(*) FROM favoriler WHERE ilan_id=$1) WHERE id=$1',[il[0].id]);
  res.json({ok:true, favori:true});
});
router.delete('/:uuid', authMiddleware, async (req,res)=>{
  const {rows:il}=await query('SELECT id FROM ilanlar WHERE uuid=$1',[req.params.uuid]);
  if(il[0]){ await query('DELETE FROM favoriler WHERE user_id=$1 AND ilan_id=$2',[req.user.id,il[0].id]);
    await query('UPDATE ilanlar SET favori_sayisi=(SELECT count(*) FROM favoriler WHERE ilan_id=$1) WHERE id=$1',[il[0].id]); }
  res.json({ok:true, favori:false});
});
module.exports=router;
