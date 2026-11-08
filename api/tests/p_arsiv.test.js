// G – Archiv beendeter Inserate: Loeschen verschiebt Bilder ins Archiv (nicht oeffentlich),
// 409 bei laufender Transaktion, fremdes Inserat 404, Ablehnen kopiert, Admin-Entfernen mit
// Grund, signierte Admin-Bildadresse, Aufbewahrung 2 Jahre. Nur eigene Testkonten.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { api, q, adminApi, adminGiris, tokenFuer } = require('./_hilfe');
const arsiv = require('../src/lib/ilanArsiv');

const UP = process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

async function testIlan(uid, titel) {
  const i = (await q(`INSERT INTO ilanlar(user_id,baslik,fiyat,durum,ilan_durum,aciklama) VALUES($1,$2,250,'yeni_gibi','aktif','Test açıklama') RETURNING id, uuid`, [uid, titel])).rows[0];
  const name = `${i.uuid}_0.webp`;
  fs.writeFileSync(path.join(UP, 'ilanlar', name), PNG);
  await q('INSERT INTO ilan_fotograflar(ilan_id,url,sira,ana_foto) VALUES($1,$2,0,true),($1,$3,1,false)',
    [i.id, `/uploads/ilanlar/${name}`, 'https://images.example.invalid/x.jpg']);
  return { ...i, name };
}

test('Archiv: Loeschen, Ablehnen, Admin-Entfernen, Aufbewahrung', async () => {
  const z = Date.now(); const ids = [];
  // Konten direkt anlegen (nicht ueber /auth/kayit — das Registrierungslimit 20/15 min gilt je IP)
  const neu = async (n) => {
    const u = (await q(`INSERT INTO users(email,phone,password_hash,ad,test_verisi) VALUES($1,$2,'!','Arşiv Test',true) RETURNING id`,
      [`arsiv${n}-${z}@test.kapbeni.com`, '+90598' + String(z + n).slice(-7)])).rows[0];
    ids.push(u.id);
    return { user: { id: u.id }, token: await tokenFuer(u.id) };
  };
  try {
    const a = await neu(1), b = await neu(2);
    const no = (await q('SELECT musteri_no FROM users WHERE id=$1', [a.user.id])).rows[0].musteri_no;

    // 1) Eigentuemer loescht -> Datei verschoben, Snapshot da, Archiv nicht oeffentlich
    const i1 = await testIlan(a.user.id, 'TEST arşiv sil');
    assert.strictEqual((await api('DELETE', `/ilanlar/${i1.uuid}`, { token: b.token })).status, 404, 'fremdes Inserat');
    let r = await api('DELETE', `/ilanlar/${i1.uuid}`, { token: a.token });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!fs.existsSync(path.join(UP, 'ilanlar', i1.name)), 'Original weg');
    const ziel = path.join(UP, 'archiv', no, i1.uuid, i1.name);
    assert.ok(fs.existsSync(ziel), 'im Archiv');
    const s = (await q('SELECT * FROM ilan_arsiv WHERE ilan_uuid=$1', [i1.uuid])).rows;
    assert.strictEqual(s.length, 1); assert.strictEqual(s[0].grund, 'silindi'); assert.strictEqual(s[0].kaynak, 'kullanici');
    assert.strictEqual(s[0].baslik, 'TEST arşiv sil'); assert.strictEqual(s[0].durum, 'yeni_gibi'); assert.strictEqual(s[0].musteri_no, no);
    assert.deepStrictEqual(s[0].bilder.map((x) => !!x.arsiv), [true, false]);
    assert.strictEqual((await q('SELECT count(*)::int c FROM ilanlar WHERE uuid=$1', [i1.uuid])).rows[0].c, 0);
    const pub = await fetch(`http://127.0.0.1:3001/uploads/archiv/${no}/${i1.uuid}/${i1.name}`);
    assert.strictEqual(pub.status, 404, 'Archiv ueber /uploads nicht erreichbar');
    const ng = await fetch(`https://kapbeni.com/uploads/archiv/${no}/${i1.uuid}/${i1.name}`).catch(() => null);
    if (ng) assert.strictEqual(ng.status, 404, 'Archiv ueber nginx nicht erreichbar');

    // 2) Laufende Transaktion -> 409, nichts archiviert
    const i2 = await testIlan(a.user.id, 'TEST arşiv işlem');
    await q(`INSERT INTO islemler(ilan_id,alici_id,satici_id,tutar,durum) VALUES($1,$2,$3,250,'aktif')`, [i2.id, b.user.id, a.user.id]);
    r = await api('DELETE', `/ilanlar/${i2.uuid}`, { token: a.token });
    assert.strictEqual(r.status, 409);
    assert.ok(fs.existsSync(path.join(UP, 'ilanlar', i2.name)));
    assert.strictEqual((await q('SELECT count(*)::int c FROM ilan_arsiv WHERE ilan_uuid=$1', [i2.uuid])).rows[0].c, 0);
    await q('DELETE FROM islemler WHERE ilan_id=$1', [i2.id]);

    // 3) Admin lehnt ab -> Kopie, Inserat bleibt; signierte Bildadresse
    const tok = await adminGiris();
    r = await adminApi('POST', `/ilanlar/${i2.id}/reddet`, { token: tok, body: { sebep: 'Test red' } });
    assert.strictEqual(r.status, 200);
    assert.ok(fs.existsSync(path.join(UP, 'ilanlar', i2.name)), 'Original bleibt beim Ablehnen');
    assert.ok(fs.existsSync(path.join(UP, 'archiv', no, i2.uuid, i2.name)), 'Kopie im Archiv');
    const red = (await q("SELECT id FROM ilan_arsiv WHERE ilan_uuid=$1 AND grund='reddedildi'", [i2.uuid])).rows[0];
    r = await adminApi('GET', `/arsiv/${red.id}`, { token: tok });
    assert.strictEqual(r.status, 200); assert.match(r.body.bilder[0].url, /^arsiv\/dosya\//);
    let bild = await fetch('http://127.0.0.1:3002/admin/api/' + r.body.bilder[0].url);
    assert.strictEqual(bild.status, 200); assert.ok((await bild.arrayBuffer()).byteLength === PNG.length);
    bild = await fetch('http://127.0.0.1:3002/admin/api/' + r.body.bilder[0].url.replace(/t=.{5}/, 't=xxxxx'));
    assert.strictEqual(bild.status, 403, 'manipuliertes Token');
    assert.strictEqual(r.body.bilder[1].url, 'https://images.example.invalid/x.jpg', 'externes Bild bleibt Verweis');

    // 4) Admin entfernt -> Grund Pflicht, dann Archiv (verschoben)
    assert.strictEqual((await adminApi('DELETE', `/ilanlar/${i2.uuid}`, { token: tok, body: {} })).status, 400);
    r = await adminApi('DELETE', `/ilanlar/${i2.uuid}`, { token: tok, body: { sebep: 'Kural ihlali (test)' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.ok(!fs.existsSync(path.join(UP, 'ilanlar', i2.name)));
    const ak = (await q("SELECT grund_detay, admin_id FROM ilan_arsiv WHERE ilan_uuid=$1 AND grund='admin_kaldirdi'", [i2.uuid])).rows[0];
    assert.strictEqual(ak.grund_detay, 'Kural ihlali (test)'); assert.ok(ak.admin_id);
    const ev = (await q("SELECT olay FROM musteri_olaylari WHERE user_id=$1 ORDER BY id", [a.user.id])).rows.map((x) => x.olay);
    assert.ok(ev.includes('ilan_sil') && ev.includes('ilan_reddedildi') && ev.includes('ilan_kaldirildi'), ev.join(','));
    await adminApi('POST', '/cikis', { token: tok });

    // 5) Aufbewahrung: alte Snapshots samt Dateien weg
    await q("UPDATE ilan_arsiv SET created_at=NOW()-interval '3 years' WHERE user_id=$1", [a.user.id]);
    assert.ok(await arsiv.eskileriSil() >= 3);
    assert.ok(!fs.existsSync(ziel), 'Archivdatei nach Frist geloescht');
    assert.strictEqual((await q('SELECT count(*)::int c FROM ilan_arsiv WHERE user_id=$1', [a.user.id])).rows[0].c, 0);
  } finally {
    for (const id of ids) {
      const no = (await q('SELECT musteri_no FROM users WHERE id=$1', [id])).rows[0]?.musteri_no;
      for (const f of (await q('SELECT uuid FROM ilanlar WHERE user_id=$1', [id])).rows) {
        try { fs.unlinkSync(path.join(UP, 'ilanlar', `${f.uuid}_0.webp`)); } catch {}
      }
      if (no) fs.rmSync(path.join(UP, 'archiv', no), { recursive: true, force: true });
      await q('DELETE FROM islemler WHERE alici_id=$1 OR satici_id=$1', [id]);
      await q('DELETE FROM ilanlar WHERE user_id=$1', [id]);
      await q('DELETE FROM kullanici_girisler WHERE user_id=$1', [id]);
      await q('DELETE FROM users WHERE id=$1 AND test_verisi=true', [id]);
    }
  }
});

test.after(async () => { await require('./_hilfe').pool.end().catch(() => {}); await require('../src/db/pool').pool.end().catch(() => {}); });
