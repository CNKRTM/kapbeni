const router = require('express').Router();
const { query } = require('../db/pool');

// Verschachtelte Kategorie-Struktur (3 Ebenen) — Letgo-Style Mega-Menu
//
// Jeder Knoten traegt zwei Zaehler aktiver Inserate:
//   adet         — inklusive aller Unterkategorien (das, was in der UI steht)
//   adet_direkt  — nur Inserate mit genau dieser kategori_id
// Beide werden bei jedem Aufruf frisch aus ilanlar gezaehlt; es gibt keine
// gepflegte Zaehlerspalte, die veralten koennte. Kategorien ohne Inserate
// liefern 0, neu angelegte Kategorien erscheinen automatisch.
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, ad, slug, COALESCE(icon, ikon) AS icon,
              COALESCE(parent_id, ust_id) AS parent_id,
              COALESCE(level, CASE WHEN ust_id IS NULL THEN 1 ELSE 2 END) AS level,
              COALESCE(sort_order, sira) AS sort_order
       FROM kategoriler WHERE aktif=true
       ORDER BY COALESCE(sort_order, sira), id`
    );
    // Direkte Zaehlung je kategori_id — ein Query, unabhaengig von der Baumtiefe.
    const { rows: cnt } = await query(
      `SELECT kategori_id, COUNT(*)::int AS n
       FROM ilanlar
       WHERE ilan_durum='aktif' AND kategori_id IS NOT NULL
       GROUP BY kategori_id`
    );
    const direkt = new Map(cnt.map(c => [c.kategori_id, c.n]));

    const byId = new Map();
    rows.forEach(r => { r.altKategoriler = []; r.detaylar = []; byId.set(r.id, r); });
    const ana = [];
    for (const r of rows) {
      if (r.level === 1 || r.parent_id == null) { if (r.level === 1) ana.push(r); }
    }
    // Ebenen zuordnen
    for (const r of rows) {
      if (r.level === 2 && byId.has(r.parent_id)) byId.get(r.parent_id).altKategoriler.push(r);
    }
    for (const r of rows) {
      if (r.level === 3 && byId.has(r.parent_id)) byId.get(r.parent_id).detaylar.push(r);
    }
    // Rekursive Summe: eigene Inserate + alle Kinder. Von unten nach oben, damit
    // ein Inserat unter "Fren & Debriyaj" auch bei "Araba" mitgezaehlt wird.
    const summe = (node) => {
      const eigen = direkt.get(node.id) || 0;
      const kinder = [...(node.altKategoriler || []), ...(node.detaylar || [])]
        .reduce((s, k) => s + summe(k), 0);
      node.adet_direkt = eigen;
      node.adet = eigen + kinder;
      return node.adet;
    };
    ana.forEach(summe);

    // Ausgabeform: ana -> {id,ad,slug,icon,adet, altKategoriler:[{...,adet, detaylar:[{...,adet}]}]}
    const out = ana
      .sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
      .map(a => ({
        id: a.id, ad: a.ad, slug: a.slug, icon: a.icon,
        adet: a.adet, adet_direkt: a.adet_direkt,
        altKategoriler: a.altKategoriler
          .sort((x,y)=>(x.sort_order||0)-(y.sort_order||0))
          .map(al => ({
            id: al.id, ad: al.ad, slug: al.slug,
            adet: al.adet, adet_direkt: al.adet_direkt,
            detaylar: al.detaylar
              .sort((x,y)=>(x.sort_order||0)-(y.sort_order||0))
              .map(d => ({ id: d.id, ad: d.ad, slug: d.slug, adet: d.adet, adet_direkt: d.adet_direkt })),
          })),
        // Rückwärtskompatibel
        alt_kategoriler: a.altKategoriler,
      }));
    res.json(out);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// Flache Liste (für Dropdowns/Wizard) — optional ?level=1|2|3, ?parent=<id>
router.get('/flat', async (req, res) => {
  try {
    const { level, parent } = req.query;
    const cond = ['aktif=true']; const params = []; let p = 1;
    if (level)  { cond.push(`COALESCE(level, CASE WHEN ust_id IS NULL THEN 1 ELSE 2 END)=$${p++}`); params.push(+level); }
    if (parent) { cond.push(`COALESCE(parent_id, ust_id)=$${p++}`); params.push(+parent); }
    const { rows } = await query(
      `SELECT id, ad, slug, COALESCE(icon,ikon) AS icon, COALESCE(parent_id,ust_id) AS parent_id,
              COALESCE(level, CASE WHEN ust_id IS NULL THEN 1 ELSE 2 END) AS level
       FROM kategoriler WHERE ${cond.join(' AND ')} ORDER BY COALESCE(sort_order,sira), id`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// e-Devlet Gate-Check
router.get('/:slug/e-devlet-gerekli', async (req,res)=>{
  const { query } = require('../db/pool');
  const jwt=require('jsonwebtoken');
  const { rows } = await query('SELECT e_devlet_gerekli FROM kategoriler WHERE slug=$1',[req.params.slug]);
  let dogrulandi=false;
  try{ const t=req.headers.authorization?.split(' ')[1]; if(t){ const id=jwt.verify(t,process.env.JWT_SECRET).id;
    const u=await query('SELECT e_devlet_dogrulandi FROM users WHERE id=$1',[id]); dogrulandi=!!u.rows[0]?.e_devlet_dogrulandi; } }catch{}
  res.json({ gerekli: !!rows[0]?.e_devlet_gerekli, user_dogrulandi: dogrulandi });
});

module.exports = router;
