const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/paketler', async (req,res)=>{
  const {rows}=await query("SELECT id,ad,etiket,fiyat_3gun,fiyat_7gun,fiyat_15gun,fiyat_30gun FROM vitamin_paketler WHERE etiket IS NOT NULL AND aktif=true ORDER BY id");
  res.json(rows);
});
module.exports=router;
