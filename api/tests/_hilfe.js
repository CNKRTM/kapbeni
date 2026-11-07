// ════════════════════════════════════════════════════════════════════════════
//  Hilfen fuer die API-Tests (node --test). Laufen NUR auf dem Server:
//    cd /opt/kapbeni/api && node --test tests/
//
//  Regeln (Kapbeni-Agentenregeln):
//  - Fuer users.id=1 (Betreiber) wird nie ein Token erzeugt.
//  - Geschrieben wird nur mit Testkonten (users.test_verisi=true).
//  - Was ein Test anlegt, raeumt er selbst wieder weg.
// ════════════════════════════════════════════════════════════════════════════
require('dotenv').config({ path: '/etc/kapbeni.env' });
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const BASIS = process.env.TEST_API || 'http://127.0.0.1:3001/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const TESTKONTO = 15;

async function tokenFuer(userId) {
  if (Number(userId) === 1) throw new Error('Fuer users.id=1 wird kein Token erzeugt.');
  const { rows } = await pool.query('SELECT id, uuid, rol, test_verisi FROM users WHERE id=$1', [userId]);
  if (!rows[0]) throw new Error(`users.id=${userId} fehlt`);
  if (!rows[0].test_verisi) throw new Error(`users.id=${userId} ist kein Testkonto (test_verisi=false)`);
  return jwt.sign({ id: rows[0].id, uuid: rows[0].uuid, rol: rows[0].rol, kaynak: 'api' },
    process.env.JWT_SECRET, { expiresIn: '15m' });
}

/** fetch gegen die lokale API; liefert { status, body }. */
async function api(methode, pfad, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let daten;
  if (form) daten = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; daten = JSON.stringify(body); }
  const r = await fetch(BASIS + pfad, { method: methode, headers, body: daten });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

const q = (sql, p) => pool.query(sql, p);

module.exports = { api, tokenFuer, q, pool, TESTKONTO, BASIS };
