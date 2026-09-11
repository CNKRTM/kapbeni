const router = require('express').Router();
const { query } = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
router.get('/', authMiddleware, async (req,res)=>{
  const {rows}=await query('SELECT * FROM bildirimler WHERE user_id=$1 ORDER BY id DESC LIMIT 20',[req.user.id]);
  const {rows:c}=await query('SELECT count(*)::int t FROM bildirimler WHERE user_id=$1 AND okundu=false',[req.user.id]);
  res.json({bildirimler:rows, okunmamis:c[0].t});
});
router.put('/tumu-oku', authMiddleware, async (req,res)=>{ await query('UPDATE bildirimler SET okundu=true WHERE user_id=$1',[req.user.id]); res.json({ok:true}); });
router.put('/:id/oku', authMiddleware, async (req,res)=>{ await query('UPDATE bildirimler SET okundu=true WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]); res.json({ok:true}); });
router.delete('/:id', authMiddleware, async (req,res)=>{ await query('DELETE FROM bildirimler WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]); res.json({ok:true}); });
module.exports=router;
