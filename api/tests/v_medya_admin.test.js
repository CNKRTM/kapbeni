// J – Admin SİSTEM → Medya Motoru (v1.29): Kennzahlen, Jobliste, Tekrar dene, Einstellungen.
// Nur Test-Admin (admin_users.test_verisi); legt einen eigenen Fehler-Job an und loescht ihn.
const test = require('node:test');
const assert = require('node:assert');
const { adminApi, adminGiris, q, pool, TESTKONTO } = require('./_hilfe');

test('Medya Motoru: ozet, isler, tekrar, ayarlar', async () => {
  const token = await adminGiris();
  const o = await adminApi('GET', '/medya/ozet', { token });
  assert.strictEqual(o.status, 200, JSON.stringify(o.body));
  for (const k of ['bekliyor', 'isleniyor', 'hata', 'tasarruf', 'sure', 'disk', 'motor']) assert.ok(k in o.body, k);
  assert.strictEqual(o.body.motor.cevrimici, true, 'Engine muss erreichbar sein');
  assert.ok(o.body.disk.toplam > 0 && o.body.disk.ilanlar.dosya > 0);

  const j = (await q(`INSERT INTO medya_isleri(tip,durum,user_id,kaynak,hata,hata_kullanici,deneme)
     VALUES('bild_sm','hata',$1,'/uploads/ilanlar/gibt-es-nicht_0.webp','Test','Test-Fehler',1) RETURNING id`, [TESTKONTO])).rows[0].id;
  try {
    const l = await adminApi('GET', '/medya/isler?durum=hata&tip=bild_sm', { token });
    assert.strictEqual(l.status, 200);
    const z = l.body.isler.find((x) => x.id === j);
    assert.ok(z && z.tekrar === true, 'fehlgeschlagener Engine-Job ist wiederholbar');
    const t = await adminApi('POST', `/medya/isler/${j}/tekrar`, { token });
    assert.strictEqual(t.status, 200, JSON.stringify(t.body));
    // Engine nimmt ihn auf und scheitert erneut (Quelle fehlt) → wieder hata
    let d;
    for (let i = 0; i < 20; i++) { d = (await q('SELECT durum, deneme FROM medya_isleri WHERE id=$1', [j])).rows[0]; if (d.durum === 'hata' && d.deneme >= 1) break; await new Promise((r) => setTimeout(r, 500)); }
    assert.strictEqual(d.durum, 'hata');
    const s = await adminApi('POST', `/medya/isler/${j}/tekrar`, { token });
    assert.strictEqual(s.status, 200);
    // Synchroner Bildfehler kann nicht wiederholt werden
    await q("UPDATE medya_isleri SET senkron=true, durum='hata' WHERE id=$1", [j]);
    const n = await adminApi('POST', `/medya/isler/${j}/tekrar`, { token });
    assert.strictEqual(n.status, 409);
  } finally { await q('DELETE FROM medya_isleri WHERE id=$1', [j]); }

  const a = await adminApi('GET', '/medya/ayarlar', { token });
  assert.strictEqual(a.status, 200);
  assert.strictEqual(a.body.ayarlar.video_max_sn, 60);
  assert.deepStrictEqual(a.body.sinirlar.paralel, [1, 2]);
  const w = await adminApi('POST', '/medya/ayarlar', { token, body: { video_max_sn: 600 } });
  if (a.body.duzenleyebilir) {
    assert.strictEqual(w.status, 200);
    assert.strictEqual(w.body.ayarlar.video_max_sn, 60, 'auf 60 s begrenzt');
  } else assert.strictEqual(w.status, 403);
});

test.after(() => pool.end());
