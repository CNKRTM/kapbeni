// ════════════════════════════════════════════════════════════════════════════
//  Fehler aus dem E2E-Test Staging (08.11.2026), je Fix ein Test.
//  Nur Testkonten (test_verisi=true); was angelegt wird, wird wieder entfernt.
// ════════════════════════════════════════════════════════════════════════════
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { api, tokenFuer, q, pool } = require('./_hilfe');

const FRONT = '/opt/kapbeni/Kapbeni_Prod/src/src';
const KAEUFER = 71;   // Ayşe Yılmaz (Seed-Testkunde)

/** Aktives Inserat eines anderen Testkontos (nie users.id=1). */
async function fremdesTestinserat(nicht) {
  const { rows } = await q(`SELECT i.id, i.uuid, i.user_id FROM ilanlar i JOIN users u ON u.id=i.user_id
    WHERE u.test_verisi AND u.id<>$1 AND u.id<>1 AND i.ilan_durum='aktif' ORDER BY i.id LIMIT 1`, [nicht]);
  if (!rows[0]) throw new Error('kein aktives Testinserat');
  return rows[0];
}

test.after(() => pool.end());

test('v1.33.1 Chat: Website-Pfad = API-Route, Nachricht wird gespeichert', async () => {
  const quelle = fs.readFileSync(`${FRONT}/api/index.ts`, 'utf8');
  assert.match(quelle, /ve\.post\(`\/mesajlar\/konusma\/\$\{id\}\/mesaj`/, 'Frontend sendet an /konusma/:id/mesaj');
  const il = await fremdesTestinserat(KAEUFER);
  const t = await tokenFuer(KAEUFER);
  const vorher = (await q('SELECT id FROM konusmalar WHERE ilan_id=$1 AND alici_id=$2', [il.id, KAEUFER])).rows[0];
  const k = await api('POST', '/mesajlar/konusma', { token: t, body: { ilan_uuid: il.uuid } });
  assert.strictEqual(k.status, 200);
  try {
    // alter Pfad existiert nicht (Gegenprobe), neuer speichert
    assert.strictEqual((await api('POST', `/mesajlar/konusma/${k.body.id}`, { token: t, body: { metin: 'x' } })).status, 404);
    const m = await api('POST', `/mesajlar/konusma/${k.body.id}/mesaj`, { token: t, body: { metin: 'Merhaba, ürün duruyor mu? (Test)' } });
    assert.strictEqual(m.status, 200);
    assert.ok(m.body.mesaj && m.body.mesaj.id);
    const g = await api('GET', `/mesajlar/konusma/${k.body.id}`, { token: t });
    assert.ok(g.body.some((x) => x.id === m.body.mesaj.id));
  } finally {
    await q('DELETE FROM mesajlar WHERE konusma_id=$1 AND gonderen_id=$2', [k.body.id, KAEUFER]);
    await q("DELETE FROM musteri_olaylari WHERE user_id=$1 AND olay='mesaj' AND (detay->>'konusma_id')::int=$2", [KAEUFER, k.body.id]);
    if (!vorher) await q('DELETE FROM konusmalar WHERE id=$1', [k.body.id]);
  }
});

module.exports = { fremdesTestinserat, KAEUFER, FRONT };
