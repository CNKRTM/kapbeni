const { Pool } = require('pg');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => console.error('DB Pool Error:', err));

const query = (text, params) => pool.query(text, params);

const auditLog = async (olay, kaynak, opts = {}) => {
  try {
    await query(
      `INSERT INTO audit_log(olay,kaynak,user_id,admin_id,hedef_tip,hedef_id,detay,ip_adresi)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [olay, kaynak, opts.userId||null, opts.adminId||null,
       opts.hedefTip||null, opts.hedefId||null,
       opts.detay ? JSON.stringify(opts.detay) : null, opts.ip||null]
    );
  } catch(e) { console.error('AuditLog error:', e.message); }
};

module.exports = { query, pool, auditLog };
