// L – Testkunden (api/scripts/seed-testkunden.js): Invarianten der Demo-Daten, nur lesend.
// Laeuft auch, wenn die Demo-Daten (noch) nicht angelegt sind — dann wird uebersprungen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { q, pool } = require('./_hilfe');
const { vknGecerli } = require('../src/lib/dogrula');

test('Testkunden: Markierung, Nummern, Daten, Dateien', async (t) => {
  const { rows: u } = await q(`SELECT id, email, phone, musteri_no, hesap_tipi, vkn, mersis_no, cinsiyet, durum, test_verisi
    FROM users WHERE email IN ('ayse.yilmaz@test.kapbeni.com','mehmet.demir@test.kapbeni.com','satis.kayaelektronik@test.kapbeni.com','zeynep.arslan@test.kapbeni.com',
      'emre.celik@test.kapbeni.com','info.denizoto@test.kapbeni.com','burak.sahin@test.kapbeni.com','elif.koc@test.kapbeni.com')`);
  if (!u.length) return t.skip('Demo-Daten nicht angelegt');
  assert.strictEqual(u.length, 8);
  for (const x of u) {
    assert.ok(x.test_verisi, x.email + ' test_verisi'); assert.notStrictEqual(x.id, 1);
    assert.match(x.musteri_no, /^KP-\d{4}-\d{7}$/); assert.match(x.phone, /^\+905\d{9}$/);
    if (x.hesap_tipi === 'kurumsal') { assert.ok(vknGecerli(x.vkn), 'VKN gueltig'); assert.strictEqual(x.mersis_no.length, 16); }
  }
  assert.deepStrictEqual([...new Set(u.map((x) => x.durum))].sort(), ['aktif', 'askida', 'silme_bekliyor']);
  assert.ok(u.some((x) => x.cinsiyet === 'k') && u.some((x) => x.cinsiyet === 'e') && u.filter((x) => x.hesap_tipi === 'kurumsal').length === 2);
  const ids = u.map((x) => x.id);
  const n = (await q(`SELECT user_id, count(*)::int c, max(created_at) son FROM ilanlar WHERE user_id = ANY($1::int[]) GROUP BY 1`, [ids])).rows;
  for (const r of n) assert.ok(r.c >= 1 && r.c <= 10);
  const tage = n.map((r) => (Date.now() - new Date(r.son)) / 864e5);
  assert.ok(tage.some((d) => d < 28) && tage.some((d) => d > 28), 'aktiv und nicht aktiv (28 Tage)');
  assert.ok((await q(`SELECT count(*)::int c FROM ilanlar WHERE user_id = ANY($1::int[]) AND ilan_durum='moderasyonda'`, [ids])).rows[0].c >= 1);
  assert.ok((await q(`SELECT count(*)::int c FROM ilan_arsiv WHERE user_id = ANY($1::int[])`, [ids])).rows[0].c >= 1);
  assert.ok((await q(`SELECT count(*)::int c FROM mesajlar WHERE gonderen_id = ANY($1::int[]) AND tehlikeli`, [ids])).rows[0].c >= 1);
  assert.ok((await q(`SELECT count(DISTINCT ip)::int c FROM musteri_olaylari WHERE user_id = ANY($1::int[]) AND olay='giris'`, [ids])).rows[0].c >= 5);
  // Bilder liegen wirklich auf der Platte
  const f = (await q(`SELECT url FROM ilan_fotograflar WHERE ilan_id IN (SELECT id FROM ilanlar WHERE user_id = ANY($1::int[])) LIMIT 5`, [ids])).rows;
  for (const r of f) assert.ok(fs.existsSync('/var/www/kapbeni' + r.url), r.url);
  const st = fs.statSync('/root/kp-testkunden.txt');
  assert.strictEqual(st.mode & 0o077, 0, 'Passwortdatei 0600');
});

test.after(() => pool.end());
