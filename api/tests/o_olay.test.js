// A – Ereignisprotokoll musteri_olaylari: Registrierung, Fehl-/Anmeldung, Inserat bearbeiten,
// Gebot, Beschwerde; IP hinter nginx (X-Real-IP nur von localhost), GeoIP offline, User-Agent.
// Eigene Testkonten (@test.kapbeni.com, test_verisi=true), am Ende vollstaendig entfernt.
const test = require('node:test');
const assert = require('node:assert');
const { q, BASIS } = require('./_hilfe');
const olay = require('../src/lib/olay');

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function rufe(methode, pfad, { token, body, ip = '85.105.44.21' } = {}) {
  const h = { 'Content-Type': 'application/json', 'User-Agent': UA_IPHONE, 'X-Real-IP': ip };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(BASIS + pfad, { method: methode, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

test('istemciIp: X-Real-IP nur ueber lokalen Proxy', () => {
  assert.strictEqual(olay.istemciIp({ socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: { 'x-real-ip': '85.105.44.21' } }), '85.105.44.21');
  assert.strictEqual(olay.istemciIp({ socket: { remoteAddress: '203.0.113.9' }, headers: { 'x-real-ip': '1.2.3.4' } }), '203.0.113.9');
});

test('geoBul/uaCoz offline', async () => {
  const g = await olay.geoBul('88.247.12.3');
  assert.strictEqual(g.ulke, 'Türkiye'); assert.ok(g.sehir && g.sehir !== '—', 'Il ermittelt');
  assert.deepStrictEqual(await olay.geoBul('192.168.50.7'), { sehir: '—', ulke: '—', isp: 'Yerel ağ' });
  const u = olay.uaCoz(UA_IPHONE);
  assert.match(u.cihaz, /iPhone/); assert.match(u.os, /iOS/); assert.match(u.tarayici, /Safari/);
});

test('Ereignisse aus den Routen', async () => {
  const z = Date.now();
  const ids = [];
  try {
    const kayit = async (n) => {
      const r = await rufe('POST', '/auth/kayit', { body: { email: `olay${n}-${z}@test.kapbeni.com`, phone: '0597' + String(z + n).slice(-7), password: 'Test-1234!', ad: 'Olay Test' } });
      assert.strictEqual(r.status, 201, JSON.stringify(r.body)); ids.push(r.body.user.id);
      await q('UPDATE users SET test_verisi=true WHERE id=$1', [r.body.user.id]);
      return r.body;
    };
    const a = await kayit(1);
    // zweites Konto direkt (Registrierungslimit je IP schonen)
    const bu = (await q(`INSERT INTO users(email,phone,password_hash,ad,test_verisi) VALUES($1,$2,'!','Olay Test',true) RETURNING id`,
      [`olay2-${z}@test.kapbeni.com`, '+90597' + String(z + 2).slice(-7)])).rows[0];
    ids.push(bu.id);
    const b = { user: { id: bu.id }, token: await require('./_hilfe').tokenFuer(bu.id) };
    let r = await rufe('POST', '/auth/giris', { body: { email: `olay1-${z}@test.kapbeni.com`, password: 'falsch' } });
    assert.strictEqual(r.status, 401);
    r = await rufe('POST', '/auth/giris', { body: { email: `olay1-${z}@test.kapbeni.com`, password: 'Test-1234!' }, ip: '176.33.10.8' });
    assert.strictEqual(r.status, 200);
    // Inserat von B (direkt, ohne KI-Moderation), A bietet und beschwert sich; B bearbeitet
    const ilan = (await q(`INSERT INTO ilanlar(user_id,baslik,fiyat,durum,ilan_durum) VALUES($1,'TEST olay',100,'sifir','aktif') RETURNING id, uuid`, [b.user.id])).rows[0];
    r = await rufe('POST', '/teklifler', { token: a.token, body: { ilan_uuid: ilan.uuid, teklif_fiyat: 90 } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    r = await rufe('POST', '/sikayet', { token: a.token, body: { ilan_uuid: ilan.uuid, sikayet_tipi: 'diger', aciklama: 'test' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    r = await rufe('PATCH', `/ilanlar/${ilan.id}/fiyat`, { token: b.token, body: { fiyat: 95 } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    await warte(500);   // kaydet() schreibt ohne auf die Antwort zu warten
    const A = (await q('SELECT olay, ip, sehir, ulke, cihaz, os FROM musteri_olaylari WHERE user_id=$1 ORDER BY id', [a.user.id])).rows;
    assert.deepStrictEqual(A.map((x) => x.olay), ['kayit', 'giris_basarisiz', 'giris', 'teklif', 'sikayet']);
    assert.strictEqual(A[0].ip, '85.105.44.21'); assert.strictEqual(A[0].ulke, 'Türkiye');
    assert.strictEqual(A[2].ip, '176.33.10.8');
    assert.match(A[0].cihaz, /iPhone/); assert.match(A[0].os, /iOS/);
    const B = (await q('SELECT olay, hedef_id FROM musteri_olaylari WHERE user_id=$1 ORDER BY id', [b.user.id])).rows;
    assert.deepStrictEqual(B.map((x) => x.olay), ['ilan_duzenle']);
    // Aufbewahrung: ein 3 Jahre alter Eintrag faellt dem Loeschlauf zum Opfer
    await q(`INSERT INTO musteri_olaylari(user_id,olay,created_at) VALUES($1,'giris',NOW()-interval '3 years')`, [a.user.id]);
    assert.ok(await olay.eskileriSil() >= 1);
    assert.strictEqual((await q('SELECT count(*)::int c FROM musteri_olaylari WHERE user_id=$1', [a.user.id])).rows[0].c, 5);
  } finally {
    for (const id of ids) {
      await q('DELETE FROM sikayet WHERE sikayet_eden=$1', [id]);
      await q('DELETE FROM teklifler WHERE alici_id=$1 OR satici_id=$1', [id]);
      await q('DELETE FROM ilanlar WHERE user_id=$1', [id]);
      await q('DELETE FROM musteri_olaylari WHERE user_id=$1', [id]);
      await q('DELETE FROM kullanici_girisler WHERE user_id=$1', [id]);
      await q('DELETE FROM audit_log WHERE user_id=$1', [id]);
      await q('DELETE FROM users WHERE id=$1 AND test_verisi=true', [id]);
    }
  }
});

test.after(async () => { await require('./_hilfe').pool.end().catch(() => {}); require('../src/db/pool').pool.end().catch(() => {}); });
