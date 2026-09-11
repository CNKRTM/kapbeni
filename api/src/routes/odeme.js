const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const param = require('../services/paramService');
require('dotenv').config({ path: '/etc/kapbeni.env' });

// Vitamin-Zahlung starten
router.post('/vitamin-baslat', authMiddleware, async (req,res)=>{
  try{
    const { ilan_uuid, paket_id, gun_sayisi=3 } = req.body;
    const { rows:il } = await query('SELECT id,user_id FROM ilanlar WHERE uuid=$1',[ilan_uuid]);
    if(!il[0]||il[0].user_id!==req.user.id) return res.status(403).json({hata:'İlan size ait değil'});
    const { rows:pk } = await query('SELECT * FROM vitamin_paketler WHERE id=$1',[paket_id]);
    if(!pk[0]) return res.status(404).json({hata:'Paket yok'});
    // Bireysel kullanıcı → ücretsiz
    const { rows:u } = await query('SELECT hesap_tipi FROM users WHERE id=$1',[req.user.id]);
    const tutar = (u[0]?.hesap_tipi==='bireysel') ? 0 : Number(pk[0][`fiyat_${gun_sayisi}gun`]||pk[0].fiyat||0);
    const siparis_id = 'SG'+Date.now().toString(36).toUpperCase()+req.user.id;
    const { rows:od } = await query(`INSERT INTO odemeler(user_id,ilan_id,tip,tutar,param_siparis_id,durum)
       VALUES($1,$2,'vitamin',$3,$4,$5) RETURNING id`,[req.user.id,il[0].id,tutar,siparis_id, tutar===0?'tamamlandi':'beklemede']);
    if(tutar===0){
      // Ücretsiz → direkt aktive
      await vitaminAktifle(il[0].id, paket_id, gun_sayisi, od.rows?.[0]?.id);
      return res.json({ ucretsiz:true, durum:'tamamlandi', mesaj:'Vitamin ücretsiz uygulandı (bireysel hesap)' });
    }
    const base = process.env.APP_DOMAIN ? `https://sattimgitti.transas24.com` : 'http://localhost:3000';
    const sess = await param.odemeBaslat({ tutar, siparis_id, basarili_url:`${base}/odeme-sonuc`, basarisiz_url:`${base}/odeme-sonuc` });
    res.json({ test_mode: param.TEST && !param.HAS_CREDS, redirect_url: sess.redirect_url||sess.UCD_URL, siparis_id, tutar });
  }catch(e){ res.status(500).json({hata:e.message}); }
});

async function vitaminAktifle(ilanId, paketId, gun, odemeId){
  await query(`INSERT INTO ilan_vitaminler(ilan_id,paket_id,gun_sayisi,bitis,odeme_id) VALUES($1,$2,$3,NOW()+($3||' days')::interval,$4)`,[ilanId,paketId,gun,odemeId||null]);
  const { rows:pk }=await query('SELECT tip FROM vitamin_paketler WHERE id=$1',[paketId]);
  const tier = (pk[0]?.tip==='zirve')?'zirve':'plus';
  await query('UPDATE ilanlar SET vitamin_tier=$1, one_cikarildi=true, is_one_cikar=true WHERE id=$2',[tier,ilanId]);
}

// Param Webhook
router.post('/param-webhook', async (req,res)=>{
  const r = param.webhookDogrula(req);
  if(r.basarili && r.siparis_id){
    const { rows:od }=await query("UPDATE odemeler SET durum='tamamlandi', param_dekont_id=$1, tamamlanma_tarihi=NOW() WHERE param_siparis_id=$2 RETURNING *",[r.dekont_id||null,r.siparis_id]);
    if(od[0]){ await vitaminAktifle(od[0].ilan_id, null, 7, od[0].id).catch(()=>{}); }
  }
  res.json({ ok:true });
});

router.get('/siparis/:siparis_id', authMiddleware, async (req,res)=>{
  const { rows }=await query('SELECT durum,tutar,tip FROM odemeler WHERE param_siparis_id=$1 AND user_id=$2',[req.params.siparis_id,req.user.id]);
  res.json(rows[0]||{durum:'bulunamadi'});
});
module.exports=router;
