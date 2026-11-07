// F – Telefon, TCKN, VKN: Einheitstests der gemeinsamen Funktionen + API gegen das Testkonto.
const test = require('node:test');
const assert = require('node:assert');
const d = require('../src/lib/dogrula');
const { api, tokenFuer, q, pool, TESTKONTO } = require('./_hilfe');

test('telefonNormalize: Beispiele aus Auftragssammlung F', () => {
  for (const roh of ['5319414803', '05319414803', '905319414803', '+90 531 941 48 03', '0090 531 941 48 03', '(0531) 941-48-03'])
    assert.strictEqual(d.telefonNormalize(roh), '+905319414803', roh);
  for (const roh of ['', null, '531941480', '0212 555 44 33', '4319414803', '05319414803999', 'abc'])
    assert.strictEqual(d.telefonNormalize(roh), null, String(roh));
  assert.strictEqual(d.telefonGoster('05319414803'), '+90 531 941 48 03');
});

test('TCKN-Pruefziffern', () => {
  assert.ok(d.tcknGecerli('10000000146'));
  assert.ok(!d.tcknGecerli('10000000147'));
  assert.ok(!d.tcknGecerli('01234567890'));   // erste Ziffer 0
  assert.ok(!d.tcknGecerli('1234567890'));    // 10 Stellen
});

test('VKN-Pruefziffer (GİB)', () => {
  // Oeffentlich bekannte VKN grosser Haendler (Hepsiburada, Trendyol) plus erzeugte Testwerte:
  for (const v of ['2650179910', '3130557669', '1111111114', '9000000009', '0123456789']) assert.ok(d.vknGecerli(v), v);
  assert.ok(!d.vknGecerli('1111111111'));
  assert.ok(!d.vknGecerli('123456789'));
  assert.ok(d.vergiNoGecerli('10000000146'));  // TCKN als Steuernummer
});

test('API: PATCH /ayarlar normalisiert Telefon und prueft VKN', async () => {
  const token = await tokenFuer(TESTKONTO);
  const vorher = (await q('SELECT phone, vkn, hesap_tipi, vergi_dairesi FROM users WHERE id=$1', [TESTKONTO])).rows[0];
  try {
    let r = await api('PATCH', '/ayarlar', { token, body: { phone: '0555 000 00 42' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual((await q('SELECT phone FROM users WHERE id=$1', [TESTKONTO])).rows[0].phone, '+905550000042');

    r = await api('PATCH', '/ayarlar', { token, body: { phone: '0212 555 44 33' } });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.hata, /cep telefonu/);

    r = await api('PATCH', '/ayarlar', { token, body: { vkn: '1111111111' } });
    assert.strictEqual(r.status, 400);
    assert.match(r.body.hata, /Vergi Kimlik/);

    r = await api('PATCH', '/ayarlar', { token, body: { vkn: '1111111114', vergi_dairesi: 'Test VD' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));

    r = await api('PUT', '/users/profil', { token, body: { phone: '12345' } });
    assert.strictEqual(r.status, 400);
  } finally {
    await q('UPDATE users SET phone=$1, vkn=$2, hesap_tipi=$3, vergi_dairesi=$4 WHERE id=$5',
      [vorher.phone, vorher.vkn, vorher.hesap_tipi, vorher.vergi_dairesi, TESTKONTO]);
  }
});

test('API: Registrierung (bireysel + kurumsal) speichert E.164, lehnt falsche VKN ab', async () => {
  const zeit = Date.now();
  const mail1 = `kayit-${zeit}@test.kapbeni.com`, mail2 = `kurumsal-${zeit}@test.kapbeni.com`;
  const tel1 = '0599' + String(zeit).slice(-7), tel2 = '0598' + String(zeit).slice(-7);
  try {
    let r = await api('POST', '/auth/kayit', { body: { email: mail1, phone: '12', password: 'Test-1234!', ad: 'Test' } });
    assert.strictEqual(r.status, 400);

    r = await api('POST', '/auth/kayit', { body: { email: mail1, phone: tel1, password: 'Test-1234!', ad: 'Test Kişi' } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    const u = (await q('SELECT phone FROM users WHERE email=$1', [mail1])).rows[0];
    assert.strictEqual(u.phone, '+90' + tel1.slice(1));

    r = await api('POST', '/auth/kurumsal-kayit', { body: { email: mail2, phone: tel2, password: 'Test-1234!',
      firma_adi: 'Test Ltd', vkn: '1111111111', yetkili_kisi: 'Ayşe Test' } });
    assert.strictEqual(r.status, 400);
    r = await api('POST', '/auth/kurumsal-kayit', { body: { email: mail2, phone: tel2, password: 'Test-1234!',
      firma_adi: 'Test Ltd', vkn: '1111111114', vergi_dairesi: 'Kadıköy', yetkili_kisi: 'Ayşe Test' } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    const k = (await q('SELECT hesap_tipi, vkn, vergi_dairesi, ad, soyad FROM users WHERE email=$1', [mail2])).rows[0];
    assert.deepStrictEqual([k.hesap_tipi, k.vkn, k.vergi_dairesi, k.soyad], ['kurumsal', '1111111114', 'Kadıköy', 'Test']);
  } finally {
    // Testkonten wieder entfernen (nur die eben angelegten, an der Testdomain erkennbar).
    const { rows } = await q("SELECT id FROM users WHERE email = ANY($1) AND email LIKE '%@test.kapbeni.com'", [[mail1, mail2]]);
    for (const { id } of rows) {
      await q('DELETE FROM kullanici_girisler WHERE user_id=$1', [id]);
      await q('DELETE FROM users WHERE id=$1', [id]);
    }
  }
});

test.after(() => pool.end());
