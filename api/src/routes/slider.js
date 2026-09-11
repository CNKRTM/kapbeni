const router = require('express').Router();
const { query } = require('../db/pool');
router.get('/', async (req,res)=>{
  const {rows}=await query("SELECT * FROM hero_slider WHERE aktif=true ORDER BY sira");
  res.json(rows);
});
router.get('/trend', async (req,res)=>{
  const {rows}=await query("SELECT * FROM trend_kategoriler WHERE aktif=true ORDER BY sira");
  res.json(rows);
});
module.exports=router;
