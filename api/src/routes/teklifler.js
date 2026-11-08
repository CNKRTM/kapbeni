const router = require('express').Router();
const { query, auditLog } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const bildirim = require('../lib/bildirim');
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
  const {rows:il}=await query('SELECT id,user_id,baslik FROM ilanlar WHERE uuid=$1',[ilan_uuid]);
  if(!il[0]) return res.status(404).json({hata:'İlan bulunamadı'});
  if(il[0].user_id===req.user.id) return res.status(400).json({hata:'Kendi ilanınıza teklif veremezsiniz'});
  const {rows}=await query(`INSERT INTO teklifler(ilan_id,alici_id,satici_id,teklif_fiyat,mesaj)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[il[0].id,req.user.id,il[0].user_id,teklif_fiyat,mesaj||null]);
  await auditLog('teklif.olustur','api',{userId:req.user.id,detay:{ilan:ilan_uuid,fiyat:teklif_fiyat}});
  require('../lib/olay').kaydet(req,{userId:req.user.id,olay:'teklif',hedefTip:'teklif',hedefId:rows[0].id,detay:{ilan:ilan_uuid,fiyat:teklif_fiyat}});
  const {rows:ben}=await query('SELECT ad FROM users WHERE id=$1',[req.user.id]);
  await bildirim.gonder({ userId: il[0].user_id, tip: 'teklif_yeni', kaynakTip: 'teklif', kaynakId: rows[0].id,
    baslik: `Yeni teklif: ${bildirim.fiyatTL(teklif_fiyat)}`,
    icerik: `${(ben[0]&&ben[0].ad)||'Bir kullanıcı'}, "${bildirim.kisalt(il[0].baslik,60)}" ilanınıza teklif verdi.`,
    link: '/#/panel/gelen-teklifler' });
  res.status(201).json(rows[0]);
});
router.put('/:id', authMiddleware, async (req,res)=>{
  const {status}=req.body; // kabul|reddedildi
  if(!['kabul','reddedildi'].includes(status)) return res.status(400).json({hata:'Geçersiz durum'});
  const {rows}=await query(`UPDATE teklifler SET status=$1,guncellendi_at=NOW()
     WHERE id=$2 AND satici_id=$3 RETURNING *`,[status,req.params.id,req.user.id]);
  if(!rows[0]) return res.status(404).json({hata:'Teklif bulunamadı'});
  const {rows:il}=await query('SELECT baslik, uuid FROM ilanlar WHERE id=$1',[rows[0].ilan_id]);
  const ad = il[0] ? bildirim.kisalt(il[0].baslik,60) : 'ilan';
  await bildirim.gonder({ userId: rows[0].alici_id, tip: status==='kabul' ? 'teklif_kabul' : 'teklif_red',
    kaynakTip: 'teklif', kaynakId: rows[0].id,
    baslik: status==='kabul' ? `Teklifiniz kabul edildi: ${bildirim.fiyatTL(rows[0].teklif_fiyat)}` : 'Teklifiniz reddedildi',
    icerik: status==='kabul'
      ? `"${ad}" için teklifiniz kabul edildi. Teslimatı satıcıyla mesajlaşarak ayarlayın.`
      : `"${ad}" için ${bildirim.fiyatTL(rows[0].teklif_fiyat)} teklifiniz satıcı tarafından reddedildi.`,
    link: '/#/panel/tekliflerim' });
  res.json(rows[0]);
});
module.exports=router;
