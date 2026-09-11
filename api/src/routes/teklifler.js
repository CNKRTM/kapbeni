const router = require('express').Router();
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/', authMiddleware, async (req,res)=>{
  const {rol='alici',status='tumu'}=req.query;
  const col = rol==='satici' ? 'satici_id' : 'alici_id';
  let cond=`t.${col}=$1`; const p=[req.user.id];
  const map={kabul:'kabul',bekliyor:'bekliyor','suresi-doldu':'suresi-doldu',reddedildi:'reddedildi'};
  if(map[status]){cond+=` AND t.status=$${p.length+1}`; p.push(map[status]);}
  // Optionaler Filter auf ein einzelnes Inserat — die Detailseite zeigt damit
  // den Verlauf der eigenen Gebote, ohne alle Angebote laden zu muessen.
  if(req.query.ilan_uuid){ cond+=` AND i.uuid=$${p.length+1}`; p.push(req.query.ilan_uuid); }
  const {rows}=await query(`SELECT t.*, i.baslik, i.uuid as ilan_uuid,
     (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as foto
     FROM teklifler t JOIN ilanlar i ON i.id=t.ilan_id WHERE ${cond} ORDER BY t.id DESC`,p);
  res.json(rows);
});
router.post('/', authMiddleware, async (req,res)=>{
  const {ilan_uuid,teklif_fiyat,mesaj}=req.body;
  const {rows:il}=await query('SELECT id,user_id FROM ilanlar WHERE uuid=$1',[ilan_uuid]);
  if(!il[0]) return res.status(404).json({hata:'İlan bulunamadı'});
  if(il[0].user_id===req.user.id) return res.status(400).json({hata:'Kendi ilanınıza teklif veremezsiniz'});
  const {rows}=await query(`INSERT INTO teklifler(ilan_id,alici_id,satici_id,teklif_fiyat,mesaj)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[il[0].id,req.user.id,il[0].user_id,teklif_fiyat,mesaj||null]);
  await auditLog('teklif.olustur','api',{userId:req.user.id,detay:{ilan:ilan_uuid,fiyat:teklif_fiyat}});
  res.status(201).json(rows[0]);
});
router.put('/:id', authMiddleware, async (req,res)=>{
  const {status}=req.body; // kabul|reddedildi
  const {rows}=await query(`UPDATE teklifler SET status=$1,guncellendi_at=NOW()
     WHERE id=$2 AND satici_id=$3 RETURNING *`,[status,req.params.id,req.user.id]);
  if(!rows[0]) return res.status(404).json({hata:'Teklif bulunamadı'});
  res.json(rows[0]);
});
module.exports=router;
