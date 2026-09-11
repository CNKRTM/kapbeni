const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/', authMiddleware, async (req,res)=>{
  const {rows}=await query(`SELECT s.id as sepet_id, i.uuid,i.baslik,i.fiyat,
    (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto
    FROM sepet s JOIN ilanlar i ON i.id=s.ilan_id WHERE s.user_id=$1 ORDER BY s.id DESC`,[req.user.id]);
  res.json({ilanlar:rows, toplam: rows.reduce((a,r)=>a+Number(r.fiyat||0),0)});
});
router.post('/', authMiddleware, async (req,res)=>{
  const {ilan_uuid,ilan_id}=req.body;
  let iid=ilan_id;
  if(ilan_uuid){ const {rows}=await query('SELECT id FROM ilanlar WHERE uuid=$1',[ilan_uuid]); iid=rows[0]?.id; }
  if(!iid) return res.status(404).json({hata:'İlan yok'});
  await query('INSERT INTO sepet(user_id,ilan_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,iid]);
  const {rows:c}=await query('SELECT count(*)::int t FROM sepet WHERE user_id=$1',[req.user.id]);
  res.json({ok:true, adet:c[0].t});
});
router.delete('/:uuid', authMiddleware, async (req,res)=>{
  await query('DELETE FROM sepet WHERE user_id=$1 AND ilan_id=(SELECT id FROM ilanlar WHERE uuid=$2)',[req.user.id,req.params.uuid]);
  res.json({ok:true});
});
router.delete('/', authMiddleware, async (req,res)=>{ await query('DELETE FROM sepet WHERE user_id=$1',[req.user.id]); res.json({ok:true}); });
router.get('/adet', authMiddleware, async (req,res)=>{ const {rows}=await query('SELECT count(*)::int t FROM sepet WHERE user_id=$1',[req.user.id]); res.json({adet:rows[0].t}); });
module.exports=router;
