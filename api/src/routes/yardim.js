const router = require('express').Router();
const { query } = require('../db/pool');
router.get('/kategoriler', async (req,res)=>{
  const {rows}=await query('SELECT DISTINCT kategori FROM yardim_makaleleri WHERE aktif=true ORDER BY kategori');
  res.json(rows.map(r=>r.kategori));
});
router.get('/ara', async (req,res)=>{
  const q=`%${req.query.q||''}%`;
  const {rows}=await query('SELECT slug,baslik,kategori FROM yardim_makaleleri WHERE aktif=true AND (baslik ILIKE $1 OR icerik ILIKE $1) LIMIT 20',[q]);
  res.json(rows);
});
router.get('/:slug', async (req,res)=>{
  const {rows}=await query('SELECT * FROM yardim_makaleleri WHERE slug=$1 AND aktif=true',[req.params.slug]);
  if(!rows[0]) return res.status(404).json({hata:'Makale bulunamadı'});
  res.json(rows[0]);
});
router.get('/', async (req,res)=>{
  const {rows}=await query('SELECT slug,baslik,kategori FROM yardim_makaleleri WHERE aktif=true ORDER BY kategori');
  res.json(rows);
});
module.exports=router;
