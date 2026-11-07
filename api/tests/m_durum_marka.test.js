// M – Einheitlicher Zustand + Marke/Merkmale (EAV). Schreibt NUR ein eigenes Testinserat
// des Testkontos und loescht es am Ende wieder.
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const { api, tokenFuer, q, pool, TESTKONTO } = require('./_hilfe');

const katId = async (slug) => (await q('SELECT id FROM kategoriler WHERE slug=$1', [slug])).rows[0].id;

test('Bestand: nur noch die 4 Zustands-Codes, kein EAV-Feld "durum"', async () => {
  const { rows } = await q("SELECT DISTINCT durum FROM ilanlar WHERE durum IS NOT NULL");
  for (const r of rows) assert.ok(['sifir', 'yeni_gibi', 'az_kullanilmis', 'kullanilmis'].includes(r.durum), r.durum);
  assert.strictEqual(Number((await q("SELECT count(*) FROM kategori_ozellik_tanimlari WHERE alan_adi='durum'")).rows[0].count), 0);
});

test('GET /ilanlar/ozellikler: Marke erbt auf Unterkategorien, Antika ohne Marke', async () => {
  const auto = (await api('GET', `/ilanlar/ozellikler/${await katId('araba-araba')}`)).body;
  assert.strictEqual(auto[0].alan_adi, 'marka');
  assert.ok(auto[0].serbest && auto[0].secenekler.includes('Togg') && auto[0].secenekler.at(-1) === 'Diğer');
  assert.deepStrictEqual(auto.filter((t) => t.zorunlu).map((t) => t.alan_adi).sort(), ['km', 'model', 'yil']);
  const teile = (await api('GET', `/ilanlar/ozellikler/${await katId('oto-yedek-parca')}`)).body;
  assert.ok(teile.some((t) => t.alan_adi === 'marka') && !teile.some((t) => t.alan_adi === 'km'), 'Ersatzteile erben KM');
  const beyaz = (await api('GET', `/ilanlar/ozellikler/${await katId('beyaz-esya')}`)).body;
  assert.ok(beyaz.find((t) => t.alan_adi === 'marka').secenekler.includes('Arçelik'));
  const antika = (await api('GET', `/ilanlar/ozellikler/${await katId('antika')}`)).body;
  assert.ok(!antika.some((t) => t.alan_adi === 'marka'));
});

test('POST/PUT Inserat: Zustand geprueft, Merkmale gespeichert und angezeigt', async () => {
  const token = await tokenFuer(TESTKONTO);
  const kat = await katId('araba-araba');
  const tan = (await api('GET', `/ilanlar/ozellikler/${kat}`)).body;
  const id = (a) => String(tan.find((t) => t.alan_adi === a).id);
  const bild = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#b61722' } }).png().toBuffer();
  const form = (felder) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(felder)) f.append(k, v);
    f.append('fotograflar', new Blob([bild], { type: 'image/png' }), 'test.png');
    return f;
  };
  const basis = { baslik: 'TEST-INSERAT Agent bitte ignorieren', aciklama: 'Automatischer Test, wird sofort gelöscht.', fiyat: '1000',
    kategori_id: String(kat), sehir: 'Aksaray', ilce: 'Merkez' };
  let uuid = null;
  try {
    let r = await api('POST', '/ilanlar', { token, form: form({ ...basis, durum: 'ikinci_el' }) });
    assert.strictEqual(r.status, 400, 'alter Code ikinci_el muss abgelehnt werden');
    r = await api('POST', '/ilanlar', { token, form: form({ ...basis, durum: 'yeni_gibi', ozellikler: JSON.stringify({ [id('marka')]: 'togg' }) }) });
    assert.strictEqual(r.status, 400, 'Pflichtfelder Modell/Yıl/KM fehlen');
    assert.match(r.body.hata, /Zorunlu alan/);
    r = await api('POST', '/ilanlar', { token, form: form({ ...basis, durum: 'yeni_gibi',
      ozellikler: JSON.stringify({ [id('marka')]: 'togg', [id('model')]: 'T10X', [id('yil')]: '2024', [id('km')]: '12.000' }) }) });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    uuid = r.body.ilan.uuid;
    assert.strictEqual(r.body.ilan.durum, 'yeni_gibi');

    let d = (await api('GET', `/ilanlar/${uuid}`, { token })).body;
    const o = Object.fromEntries(d.ozellikler.map((x) => [x.alan_adi, x.deger]));
    assert.deepStrictEqual(o, { marka: 'Togg', model: 'T10X', yil: '2024', km: '12000' });
    assert.strictEqual(d.durum_etiket, 'Yeni gibi');
    assert.match(d.satici_musteri_no, /^KP-/);

    // PUT: freie Marke, Zustand aendern
    const f = new FormData();
    f.append('durum', 'az_kullanilmis');
    f.append('ozellikler', JSON.stringify({ [id('marka')]: 'Eigenbau', [id('model')]: 'X', [id('yil')]: '2020', [id('km')]: '5' }));
    r = await api('PUT', `/ilanlar/${uuid}`, { token, form: f });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    d = (await api('GET', `/ilanlar/${uuid}`, { token })).body;
    assert.strictEqual(d.durum, 'az_kullanilmis');
    assert.strictEqual(d.ozellikler.find((x) => x.alan_adi === 'marka').deger, 'Eigenbau');

    // Filter nach Marke in der Liste (nur aktive Inserate sichtbar)
    if (d.ilan_durum === 'aktif') {
      const l = (await api('GET', '/ilanlar?marka=eigenbau')).body;
      assert.ok(l.ilanlar.some((x) => x.uuid === uuid));
    }
  } finally {
    if (uuid) {
      const r = await api('DELETE', `/ilanlar/${uuid}`, { token });
      assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    }
  }
});

test.after(() => pool.end());
