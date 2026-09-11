const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/paketler', async (req,res)=>{
  const {rows}=await query('SELECT * FROM vitamin_paketler WHERE aktif=true ORDER BY fiyat DESC');
  res.json(rows);
});
router.post('/satin-al', authMiddleware, async (req,res)=>{
  const {ilan_uuid,paket_id}=req.body;
  const {rows:il}=await query('SELECT id,user_id FROM ilanlar WHERE uuid=$1',[ilan_uuid]);
  if(!il[0]||il[0].user_id!==req.user.id) return res.status(403).json({hata:'İlan size ait değil'});
  const {rows:pk}=await query('SELECT * FROM vitamin_paketler WHERE id=$1',[paket_id]);
  if(!pk[0]) return res.status(404).json({hata:'Paket yok'});
  const {rows}=await query(`INSERT INTO ilan_vitaminler(ilan_id,paket_id,bitis)
    VALUES($1,$2,NOW()+ ($3||' days')::interval) RETURNING *`,[il[0].id,paket_id,pk[0].sure_gun]);
  if(pk[0].tip==='zirve'||pk[0].tip==='one-cikar') await query('UPDATE ilanlar SET one_cikarildi=true WHERE id=$1',[il[0].id]);
  res.status(201).json({ok:true, vitamin:rows[0], odeme_gerekli:pk[0].fiyat});
});
module.exports=router;
