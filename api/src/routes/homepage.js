const router = require('express').Router();
const { query } = require('../db/pool');
const FOTO = `(SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto`;
const BASE = `SELECT i.uuid,i.baslik,i.fiyat,i.sehir,i.ilce,i.durum,i.one_cikarildi,i.vitamin_tier,${FOTO} FROM ilanlar i WHERE i.ilan_durum='aktif'`;
router.get('/', async (req,res)=>{
  try{
    const trend=(await query('SELECT * FROM trend_kategoriler WHERE aktif=true ORDER BY sira')).rows;
    const one_cikan=(await query(`${BASE} AND (i.vitamin_tier='zirve' OR i.one_cikarildi=true) ORDER BY i.created_at DESC LIMIT 10`)).rows;
    const son=(await query(`${BASE} ORDER BY i.created_at DESC LIMIT 24`)).rows;
    const kargo=(await query(`${BASE} AND i.ucretsiz_kargo=true ORDER BY i.created_at DESC LIMIT 10`)).rows;
    res.json({ trend_kategoriler:trend, one_cikan_ilanlar:one_cikan, son_ilanlar:son, ucretsiz_kargo:kargo });
  }catch(e){ res.status(500).json({hata:e.message}); }
});
module.exports=router;
