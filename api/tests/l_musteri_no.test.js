// L – Kundennummer KP-JJJJ-NNNNNNN: Bestand vergeben, neue Registrierung bekommt die naechste Nummer,
// API-Antworten liefern musteri_no.
const test = require('node:test');
const assert = require('node:assert');
const { api, tokenFuer, q, pool, TESTKONTO } = require('./_hilfe');

const MUSTER = /^KP-\d{4}-\d{7,}$/;

test('Bestand: jede Zeile hat eine eindeutige Nummer im Muster, Reihenfolge nach created_at', async () => {
  const { rows } = await q('SELECT id, musteri_no, created_at FROM users ORDER BY created_at, id');
  assert.ok(rows.every((r) => MUSTER.test(r.musteri_no)), 'Muster verletzt');
  assert.strictEqual(new Set(rows.map((r) => r.musteri_no)).size, rows.length, 'doppelt');
  // Reihenfolge gilt fuer echte Konten; die Demo-Testkunden (seed-testkunden.js) tragen
  // ein zurueckdatiertes Registrierungsdatum, bekommen ihre Nummer aber beim Anlegen.
  const nr = (await q('SELECT musteri_no FROM users WHERE NOT test_verisi ORDER BY created_at, id')).rows.map((r) => Number(r.musteri_no.split('-')[2]));
  assert.deepStrictEqual(nr, [...nr].sort((a, b) => a - b), 'nicht nach Registrierung sortiert');
  for (const r of rows) assert.strictEqual(r.musteri_no.slice(3, 7), String(new Date(r.created_at).getFullYear()));
});

test('Neue Registrierung: Trigger vergibt die naechste Nummer, Antwort enthaelt sie', async () => {
  const zeit = Date.now();
  const mail = `kpno-${zeit}@test.kapbeni.com`;
  const max = (await q("SELECT max(split_part(musteri_no,'-',3)::bigint) AS m FROM users")).rows[0].m;
  try {
    const r = await api('POST', '/auth/kayit', { body: { email: mail, phone: '0597' + String(zeit).slice(-7), password: 'Test-1234!', ad: 'Kp Test' } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.user.musteri_no, MUSTER);
    assert.ok(Number(r.body.user.musteri_no.split('-')[2]) > Number(max));
    assert.strictEqual(r.body.user.musteri_no.slice(3, 7), String(new Date().getFullYear()));
  } finally {
    const { rows } = await q("SELECT id FROM users WHERE email=$1 AND email LIKE '%@test.kapbeni.com'", [mail]);
    for (const { id } of rows) { await q('DELETE FROM kullanici_girisler WHERE user_id=$1', [id]); await q('DELETE FROM users WHERE id=$1', [id]); }
  }
});

test('API: /auth/ben und Verkaeuferprofil liefern musteri_no', async () => {
  const token = await tokenFuer(TESTKONTO);
  const ben = await api('GET', '/auth/ben', { token });
  assert.match(ben.body.musteri_no, MUSTER);
  const u = (await q('SELECT uuid FROM users WHERE id=$1', [TESTKONTO])).rows[0];
  const p = await api('GET', `/satici/${u.uuid}/profil`);
  assert.strictEqual(p.body.musteri_no, ben.body.musteri_no);
  assert.ok(p.body.kayit_tarihi);
});

test.after(() => pool.end());
