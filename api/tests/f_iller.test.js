// F – İl/İlçe: Datenquelle der Combobox (/api/iller) liefert 81 İl inkl. Aksaray und 973 İlçe.
const test = require('node:test');
const assert = require('node:assert');
const { api, pool } = require('./_hilfe');

test('/api/iller: 81 İl, Aksaray enthalten, kod numerisch', async () => {
  const r = await api('GET', '/iller');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.length, 81);
  const aksaray = r.body.find((x) => x.ad === 'Aksaray');
  assert.ok(aksaray, 'Aksaray fehlt');
  assert.strictEqual(typeof aksaray.kod, 'number');
});

test('/api/iller/:kod/ilceler: Bezirke je İl, Summe 973', async () => {
  const iller = (await api('GET', '/iller')).body;
  let summe = 0;
  for (const il of iller) {
    const r = await api('GET', `/iller/${il.kod}/ilceler`);
    assert.strictEqual(r.status, 200);
    summe += r.body.length;
  }
  assert.strictEqual(summe, 973);
  const ist = (await api('GET', '/iller/34/ilceler')).body.map((x) => x.ad);
  assert.ok(ist.includes('Kadıköy'));
});

test.after(() => pool.end());
