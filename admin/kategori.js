// ════════════════════════════════════════════════════════════════════════════
//  Express-Admin: Kategorien und Merkmalswerte (Auftragssammlung M, v1.27).
//  Kategoriler → Özellikler: Werte aus kategori_ozellik_secenekleri je Kategorie
//  pflegen (hinzufuegen, umbenennen, sortieren, entfernen). Vor allem Marken.
//  „Diğer“ bleibt immer am Ende (Konvention aus v1.12).
//  Ausserdem /admin/api/kategoriler aus der DB — die Seite rief bisher
//  /api/kategoriler relativ zur Domain auf, unter :3002 gab es das nicht
//  („0 ana kategori“, Backlog).
// ════════════════════════════════════════════════════════════════════════════
const ozellik = require('../api/src/lib/ozellik');
const DIGER = 'Diğer';
const trLower = (s) => String(s || '').toLocaleLowerCase('tr-TR').trim();

module.exports = function kategoriRouten(app, { db, adminAuth, auditAdmin }) {
  const q = (sql, p) => db.query(sql, p);
  const fehler = (res, e, wo) => { console.error(`[kategori/${wo}]`, e.message); res.status(500).json({ hata: 'İşlem yapılamadı' }); };

  app.get('/admin/api/kategoriler', adminAuth, async (req, res) => {
    try {
      const { rows } = await q(`SELECT k.id, k.ad, k.slug, COALESCE(k.parent_id, k.ust_id) AS ust_id, k.icon, k.ikon, k.aktif, k.sira, k.sort_order,
          (SELECT count(*) FROM ilanlar i WHERE i.kategori_id=k.id)::int AS ilan,
          (SELECT count(*) FROM kategori_ozellik_tanimlari t WHERE t.kategori_id=k.id)::int AS ozellik
        FROM kategoriler k ORDER BY COALESCE(k.sort_order, k.sira, 0), k.id`);
      res.json(rows);
    } catch (e) { fehler(res, e, 'liste'); }
  });

  // Merkmale einer Kategorie: eigene + geerbte (Elternkette), mit Werten und Verwendung
  app.get('/admin/api/kategoriler/:id(\\d+)/ozellikler', adminAuth, async (req, res) => {
    try {
      const tan = await ozellik.tanimlarGetir(req.params.id, { query: q });
      const ids = tan.map((t) => t.id);
      const { rows: sec } = await q(`SELECT s.id, s.tanim_id, s.deger, s.sira,
          (SELECT count(*) FROM ilan_ozellik_degerleri v WHERE v.tanim_id=s.tanim_id AND v.deger=s.deger)::int AS kullanim
        FROM kategori_ozellik_secenekleri s WHERE s.tanim_id = ANY($1::int[]) ORDER BY s.sira, s.id`, [ids]);
      const { rows: kat } = await q('SELECT id, ad FROM kategoriler WHERE id = ANY($1::int[])', [tan.map((t) => t.kategori_id)]);
      const katAd = new Map(kat.map((k) => [k.id, k.ad]));
      res.json(tan.map((t) => ({ id: t.id, alan_adi: t.alan_adi, etiket: t.etiket, tip: t.tip, zorunlu: t.zorunlu, serbest: t.serbest,
        kategori_id: t.kategori_id, kategori_ad: katAd.get(t.kategori_id), miras: String(t.kategori_id) !== String(req.params.id),
        secenekler: sec.filter((s) => s.tanim_id === t.id) })));
    } catch (e) { fehler(res, e, 'ozellikler'); }
  });

  async function tanim(id) { return (await q('SELECT * FROM kategori_ozellik_tanimlari WHERE id=$1', [id])).rows[0]; }
  // „Diğer“ ans Ende, die uebrigen 1..n durchnummerieren
  async function neuNummerieren(c, tanimId, reihenfolge = null) {
    const { rows } = await c.query('SELECT id, deger FROM kategori_ozellik_secenekleri WHERE tanim_id=$1 ORDER BY sira, id', [tanimId]);
    let liste = rows;
    if (reihenfolge) { const pos = new Map(reihenfolge.map((id, i) => [Number(id), i])); liste = [...rows].sort((a, b) => (pos.get(a.id) ?? 1e6) - (pos.get(b.id) ?? 1e6)); }
    const diger = liste.filter((r) => r.deger === DIGER), rest = liste.filter((r) => r.deger !== DIGER);
    let i = 1;
    for (const r of rest) await c.query('UPDATE kategori_ozellik_secenekleri SET sira=$1 WHERE id=$2', [i++, r.id]);
    for (const r of diger) await c.query('UPDATE kategori_ozellik_secenekleri SET sira=999 WHERE id=$1', [r.id]);
  }
  async function transaktion(fn) {
    const c = await db.connect();
    try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
    catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  const wertPruefen = (v) => { const s = String(v || '').replace(/\s+/g, ' ').trim(); return s && s.length <= 100 ? s : null; };

  app.post('/admin/api/ozellik/:tid(\\d+)/secenek', adminAuth, async (req, res) => {
    try {
      const t = await tanim(req.params.tid);
      if (!t || t.tip !== 'secim') return res.status(404).json({ hata: 'Seçimli özellik bulunamadı' });
      const deger = wertPruefen(req.body?.deger);
      if (!deger) return res.status(400).json({ hata: 'Değer 1–100 karakter olmalı' });
      const { rows: vor } = await q('SELECT deger FROM kategori_ozellik_secenekleri WHERE tanim_id=$1', [t.id]);
      if (vor.some((r) => trLower(r.deger) === trLower(deger))) return res.status(409).json({ hata: 'Bu değer zaten listede' });
      const r = await transaktion(async (c) => {
        const x = await c.query('INSERT INTO kategori_ozellik_secenekleri(tanim_id,deger,sira) VALUES($1,$2,998) RETURNING id', [t.id, deger]);
        await neuNummerieren(c, t.id); return x.rows[0];
      });
      await auditAdmin('ozellik.secenek_ekle', req.admin.id, { hedefTip: 'ozellik', hedefId: t.id, detay: { deger } });
      res.json({ ok: true, id: r.id });
    } catch (e) { fehler(res, e, 'ekle'); }
  });

  // Umbenennen; mevcut=true zieht vorhandene Inseratswerte mit (z. B. Tippfehler einer Marke)
  app.put('/admin/api/secenek/:id(\\d+)', adminAuth, async (req, res) => {
    try {
      const s = (await q('SELECT * FROM kategori_ozellik_secenekleri WHERE id=$1', [req.params.id])).rows[0];
      if (!s) return res.status(404).json({ hata: 'Değer bulunamadı' });
      const deger = wertPruefen(req.body?.deger);
      if (!deger) return res.status(400).json({ hata: 'Değer 1–100 karakter olmalı' });
      if (s.deger === DIGER) return res.status(400).json({ hata: '„Diğer“ değiştirilemez' });
      const { rows: vor } = await q('SELECT id, deger FROM kategori_ozellik_secenekleri WHERE tanim_id=$1 AND id<>$2', [s.tanim_id, s.id]);
      if (vor.some((r) => trLower(r.deger) === trLower(deger))) return res.status(409).json({ hata: 'Bu değer zaten listede' });
      const mevcut = req.body?.mevcut === true;
      const n = await transaktion(async (c) => {
        await c.query('UPDATE kategori_ozellik_secenekleri SET deger=$1 WHERE id=$2', [deger, s.id]);
        if (!mevcut) return 0;
        const r = await c.query('UPDATE ilan_ozellik_degerleri SET deger=$1 WHERE tanim_id=$2 AND deger=$3 RETURNING ilan_id', [deger, s.tanim_id, s.deger]);
        return r.rows.map((x) => x.ilan_id);
      });
      // Suchindex der betroffenen, aktiven Inserate nachziehen (Marke ist filterbar)
      if (Array.isArray(n) && n.length) {
        try {
          const { syncListing } = require('../api/src/lib/meiliSync');
          const { rows } = await q("SELECT uuid FROM ilanlar WHERE id = ANY($1::int[]) AND ilan_durum='aktif'", [n]);
          for (const r of rows) await syncListing(String(r.uuid));
        } catch (e) { console.error('[kategori/meili]', e.message); }
      }
      await auditAdmin('ozellik.secenek_degistir', req.admin.id, { hedefTip: 'ozellik', hedefId: s.tanim_id, detay: { eski: s.deger, yeni: deger, ilanlar: Array.isArray(n) ? n.length : 0 } });
      res.json({ ok: true, guncellenen_ilan: Array.isArray(n) ? n.length : 0 });
    } catch (e) { fehler(res, e, 'degistir'); }
  });

  app.post('/admin/api/ozellik/:tid(\\d+)/sirala', adminAuth, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
      if (!ids || !ids.length) return res.status(400).json({ hata: 'Sıra listesi eksik' });
      const { rows } = await q('SELECT id FROM kategori_ozellik_secenekleri WHERE tanim_id=$1', [req.params.tid]);
      const eigene = new Set(rows.map((r) => r.id));
      if (ids.some((id) => !eigene.has(id))) return res.status(400).json({ hata: 'Liste bu özelliğe ait değil' });
      await transaktion((c) => neuNummerieren(c, Number(req.params.tid), ids));
      await auditAdmin('ozellik.secenek_sirala', req.admin.id, { hedefTip: 'ozellik', hedefId: +req.params.tid });
      res.json({ ok: true });
    } catch (e) { fehler(res, e, 'sirala'); }
  });

  // Entfernen: vorhandene Inserate behalten ihren Wert (Marke ist frei eingebbar),
  // neue Inserate koennen ihn nicht mehr aus der Liste waehlen.
  app.delete('/admin/api/secenek/:id(\\d+)', adminAuth, async (req, res) => {
    try {
      const s = (await q('SELECT * FROM kategori_ozellik_secenekleri WHERE id=$1', [req.params.id])).rows[0];
      if (!s) return res.status(404).json({ hata: 'Değer bulunamadı' });
      if (s.deger === DIGER) return res.status(400).json({ hata: '„Diğer“ kaldırılamaz' });
      await transaktion(async (c) => { await c.query('DELETE FROM kategori_ozellik_secenekleri WHERE id=$1', [s.id]); await neuNummerieren(c, s.tanim_id); });
      await auditAdmin('ozellik.secenek_sil', req.admin.id, { hedefTip: 'ozellik', hedefId: s.tanim_id, detay: { deger: s.deger } });
      res.json({ ok: true });
    } catch (e) { fehler(res, e, 'sil'); }
  });
};
