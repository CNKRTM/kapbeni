const router = require('express').Router();
const { query } = require('../db/pool');
router.get('/', async (req,res)=>{ const {rows}=await query('SELECT kod,ad FROM iller ORDER BY ad'); res.json(rows); });
router.get('/:kod/ilceler', async (req,res)=>{ const {rows}=await query('SELECT i.ad FROM ilceler i JOIN iller l ON l.id=i.il_id WHERE l.kod=$1 ORDER BY i.ad',[req.params.kod]); res.json(rows); });
module.exports=router;
