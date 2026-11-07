// H – Kontoloeschung: Antrag -> Widerruf per Anmeldung -> zweiter Weg -> Anonymisierung nach Frist.
// Arbeitet ausschliesslich mit einem eigens angelegten Testkonto (@test.kapbeni.com, test_verisi=true).
const test = require('node:test');
const assert = require('node:assert');
const { api, q, pool } = require('./_hilfe');

test('Kontoloeschung End-to-End', async () => {
  const zeit = Date.now();
  const mail = `silme-${zeit}@test.kapbeni.com`, pw = 'Test-1234!';
  let uid = null;
  try {
    const k = await api('POST', '/auth/kayit', { body: { email: mail, phone: '0596' + String(zeit).slice(-7), password: pw, ad: 'Silme Test' } });
    assert.strictEqual(k.status, 201, JSON.stringify(k.body));
    uid = k.body.user.id;
    await q('UPDATE users SET test_verisi=true WHERE id=$1', [uid]);
    const no = (await q('SELECT musteri_no FROM users WHERE id=$1', [uid])).rows[0].musteri_no;
    const ilan = (await q(`INSERT INTO ilanlar(user_id, baslik, fiyat, durum, ilan_durum) VALUES($1,'TEST silme',1,'sifir','aktif') RETURNING id`, [uid])).rows[0].id;
    let token = k.body.token;

    // 1) Antrag
    let r = await api('DELETE', '/hesap/sil', { token });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.mesaj, /iptal edebilirsiniz/);
    let u = (await q('SELECT durum, silinme_istegi FROM users WHERE id=$1', [uid])).rows[0];
    assert.strictEqual(u.durum, 'silme_bekliyor'); assert.ok(u.silinme_istegi);
    let i = (await q('SELECT ilan_durum, silme_oncesi_durum FROM ilanlar WHERE id=$1', [ilan])).rows[0];
    assert.deepStrictEqual([i.ilan_durum, i.silme_oncesi_durum], ['pasif', 'aktif']);
    assert.strictEqual((await api('GET', '/auth/ben', { token })).status, 401, 'alter Token muss ungueltig sein');

    // 2) Anmeldung widerruft, mit Hinweis
    r = await api('POST', '/auth/giris', { body: { email: mail.toUpperCase(), password: pw } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.bilgi || '', /iptal edildi/);
    token = r.body.token;
    assert.strictEqual((await q('SELECT durum FROM users WHERE id=$1', [uid])).rows[0].durum, 'aktif');
    assert.strictEqual((await q('SELECT ilan_durum FROM ilanlar WHERE id=$1', [ilan])).rows[0].ilan_durum, 'aktif');

    // 3) Zweiter Weg DELETE /users/me fuehrt in denselben Ablauf
    r = await api('DELETE', '/users/me', { token });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual((await q('SELECT durum FROM users WHERE id=$1', [uid])).rows[0].durum, 'silme_bekliyor');

    // 4) Frist abgelaufen -> Cron-Lauf anonymisiert
    await q("UPDATE users SET silinme_istegi = NOW() - interval '31 days' WHERE id=$1", [uid]);
    const lauf = await require('../src/lib/hesapSilme').fristAbgelaufenLauf();
    assert.ok(lauf.anonimlestirildi >= 1);
    u = (await q('SELECT * FROM users WHERE id=$1', [uid])).rows[0];
    assert.strictEqual(u.durum, 'silindi'); assert.ok(u.silindi_at);
    assert.strictEqual(u.email, `silindi+${uid}@silindi.kapbeni.invalid`);
    assert.strictEqual(u.phone, `silindi-${uid}`);
    assert.strictEqual(u.ad, 'Silinmiş'); assert.strictEqual(u.tc_no_hash, null);
    assert.strictEqual(u.musteri_no, no, 'Kundennummer muss bleiben');
    assert.strictEqual((await q('SELECT ilan_durum FROM ilanlar WHERE id=$1', [ilan])).rows[0].ilan_durum, 'pasif');
    r = await api('POST', '/auth/giris', { body: { email: mail, password: pw } });
    assert.strictEqual(r.status, 401);

    // 5) audit_log enthaelt alle Schritte
    const olaylar = (await q("SELECT olay FROM audit_log WHERE user_id=$1 AND olay LIKE 'hesap.%' ORDER BY id", [uid])).rows.map((x) => x.olay);
    assert.deepStrictEqual(olaylar, ['hesap.silme_talebi', 'hesap.silme_iptal', 'hesap.silme_talebi', 'hesap.anonimlestirildi']);
  } finally {
    if (uid) {
      await q('DELETE FROM ilanlar WHERE user_id=$1', [uid]);
      await q('DELETE FROM kullanici_girisler WHERE user_id=$1', [uid]);
      await q('DELETE FROM users WHERE id=$1 AND test_verisi=true', [uid]);
    }
  }
});

test.after(async () => { await pool.end(); await require('../src/db/pool').pool.end(); });
