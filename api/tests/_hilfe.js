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

// ── Express-Admin (:3002) ────────────────────────────────────────────────
// Nur das Test-Admin-Konto (admin_users.test_verisi=true). Passwort aus
// /root/kp-admin-test.pw (0600), wird nie ausgegeben.
const ADMIN_BASIS = process.env.TEST_ADMIN || 'http://127.0.0.1:3002/admin/api';
const TEST_ADMIN_EMAIL = 'ui-test-admin@test.kapbeni.com';
const testAdminPw = () => require('fs').readFileSync('/root/kp-admin-test.pw', 'utf8').trim();
async function adminApi(methode, pfad, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(ADMIN_BASIS + pfad, { method: methode, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json, headers: r.headers };
}
async function adminGiris() {
  const { rows } = await pool.query('SELECT test_verisi FROM admin_users WHERE email=$1', [TEST_ADMIN_EMAIL]);
  if (!rows[0]?.test_verisi) throw new Error('Test-Admin fehlt oder ist nicht als Test markiert');
  const r = await adminApi('POST', '/giris', { body: { email: TEST_ADMIN_EMAIL, password: testAdminPw() } });
  if (r.status !== 200) throw new Error('Test-Admin-Anmeldung fehlgeschlagen: ' + r.status + ' ' + JSON.stringify(r.body));
  return r.body.token;
}

module.exports = { api, tokenFuer, q, pool, TESTKONTO, BASIS, adminApi, adminGiris, testAdminPw, TEST_ADMIN_EMAIL, ADMIN_BASIS };
