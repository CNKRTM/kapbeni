const router = require('express').Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { query, pool, auditLog } = require('../db/pool');
const { authMiddleware, kycGerekli } = require('../middleware/auth');
const ai = require('../services/ai.service');
const jwt = require('jsonwebtoken');
const meiliSync = require('../lib/meiliSync');
require('dotenv').config({ path: '/etc/kapbeni.env' });

// Bilder und Video kommen im selben Formular, brauchen aber verschiedene
// Grenzen. multer kennt nur eine gemeinsame fileSize-Schranke, deshalb steht
// sie hier auf dem groesseren Wert (Video) und die engere Bildgrenze wird
// weiter unten je Datei geprueft.
const FOTO_MAX = 8;
const FOTO_BYTE = 10 * 1024 * 1024;   // 10 MB je Bild
const VIDEO_BYTE = 20 * 1024 * 1024;  // 20 MB, ein Video je Inserat
const VIDEO_TYPEN = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mp4' };
// Bilder brauchen dieselbe Schranke wie Video. Ohne sie kommt z.B. ein
// iPhone-HEIC durch (der accept-Dialog laesst sich per Dateien-App umgehen)
// und sharp bricht ab — das installierte libvips hat keinen HEVC-Decoder.
// Weil der INSERT vor der Bildschleife laeuft, stuende dann ein Inserat ohne
// jedes Foto in der DB, waehrend der Verkaeufer einen 500er sieht.
const FOTO_TYPEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: VIDEO_BYTE, files: FOTO_MAX + 1 } });
const ilanFelder = upload.fields([
  { name: 'fotograflar', maxCount: FOTO_MAX },
  { name: 'video', maxCount: 1 },
]);
// multer bricht schon vor dem Handler ab, wenn eine Datei zu gross ist oder zu
// viele kommen. Ohne diesen Mantel landet der Fehler in der allgemeinen
// Fehlerbehandlung und der Verkaeufer sieht einen 500er ohne Grund.
const MULTER_TEXT = {
  LIMIT_FILE_SIZE: 'Dosya çok büyük. Fotoğraf en fazla 10MB, video en fazla 20MB olabilir.',
  LIMIT_FILE_COUNT: `En fazla ${FOTO_MAX} fotoğraf ve 1 video yükleyebilirsiniz.`,
  LIMIT_UNEXPECTED_FILE: `En fazla ${FOTO_MAX} fotoğraf ve 1 video yükleyebilirsiniz.`,
};
/** Nutzer-ID aus einem mitgeschickten Bearer-Token lesen, ohne die Route
 *  auth-pflichtig zu machen. Kein Token oder ein ungueltiges: null.
 *  Gebraucht fuer Routen, die oeffentlich sind, dem Eigentuemer aber mehr
 *  zeigen duerfen als allen anderen. */
function optionalerNutzer(req) {
  try {
    const t = (req.headers.authorization || '').split(' ')[1];
    if (!t) return null;
    const d = jwt.verify(t, process.env.JWT_SECRET);
    return d && d.kaynak === 'api' && d.id != null ? Number(d.id) : null;
  } catch { return null; }
}

/** Groesse und Format der hochgeladenen Dateien pruefen — VOR jedem Schreiben.
 *  Rueckgabe: Fehlertext (tuerkisch) oder null, wenn alles in Ordnung ist. */
function medienPruefen(fotos, video) {
  const zuGross = fotos.find(f => f.size > FOTO_BYTE);
  if (zuGross) return `Fotoğraf çok büyük: ${zuGross.originalname} (maks 10MB)`;
  const falsch = fotos.find(f => !FOTO_TYPEN.includes(f.mimetype));
  if (falsch) return `Fotoğraf biçimi desteklenmiyor: ${falsch.originalname}. JPEG, PNG veya WebP yükleyin.`;
  if (video && !VIDEO_TYPEN[video.mimetype])
    return 'Video biçimi desteklenmiyor. MP4, WebM veya MOV yükleyin.';
  return null;
}

/**
 * Bilddateien eines Inserats von der Platte raeumen.
 *
 * Zwei Schranken, beide notwendig:
 *
 * 1. Der Dateiname MUSS mit der uuid des Inserats beginnen. Die Route POST /
 *    uebernimmt das Feld `foto_url` unveraendert als Fotozeile — dort kann
 *    also jede Zeichenkette stehen, auch der Pfad einer Datei, die einem
 *    fremden Inserat gehoert. Ohne diese Pruefung liesse sich mit einem
 *    eigenen Wegwerf-Inserat die Bilddatei eines fremden Inserats loeschen.
 *
 * 2. Kein anderer Datensatz darf dieselbe URL noch fuehren.
 *
 * `path.basename` faltet zusaetzlich jeden Pfadanteil weg, ein Ausbruch aus
 * dem Upload-Verzeichnis ist damit ausgeschlossen.
 */
async function dateienEntfernen(urls, uuid) {
  const dir = `${process.env.UPLOAD_DIR}/ilanlar`;
  let weg = 0;
  for (const u of urls) {
    if (!u || typeof u !== 'string') continue;
    const name = path.basename(u);
    if (uuid && !name.startsWith(`${uuid}_`)) continue;     // fremde Datei
    const { rows } = await query('SELECT 1 FROM ilan_fotograflar WHERE url=$1 LIMIT 1', [u]);
    if (rows.length) continue;                               // noch in Benutzung
    const ziel = path.join(dir, name);
    if (path.dirname(ziel) !== dir) continue;
    try { if (fs.existsSync(ziel)) { fs.unlinkSync(ziel); weg++; } } catch { /* schon weg */ }
  }
  return weg;
}

const ilanUpload = (req, res, next) => ilanFelder(req, res, (err) => {
  if (!err) return next();
  const text = MULTER_TEXT[err.code];
  if (text) return res.status(400).json({ hata: text });
  return res.status(400).json({ hata: 'Dosya yüklenemedi.' });
});

// Tüm aktif ilanlar (filtreli) + kategori sayfası
router.get('/', async (req, res) => {
  try {
    const { kategori, kategori_slug, alt_kategori, il, ilce, fiyat_min, fiyat_max, min_fiyat, max_fiyat,
      q, kelime, ilan_tarihi, satici_puani, plus_ilan, videolu, cuzdan_guvende, ucretsiz_kargo,
      elden_al, kuponlu, durum, siralama='varsayilan', sayfa=1, sehir } = req.query;
    const limit = Math.min(+(req.query.limit||24), 48);
    const offset = (Math.max(1,+sayfa)-1)*limit;
    const slug = kategori_slug || kategori;
    const where = ["i.ilan_durum='aktif'"]; const params=[]; let p=1;
    if (slug) { where.push(`(k.slug=$${p} OR k.ust_id=(SELECT id FROM kategoriler WHERE slug=$${p}) OR k.ust_id IN (SELECT id FROM kategoriler WHERE ust_id=(SELECT id FROM kategoriler WHERE slug=$${p})))`); params.push(slug); p++; }
    if (alt_kategori){ where.push(`(k.slug=$${p} OR k.ust_id=(SELECT id FROM kategoriler WHERE slug=$${p}))`); params.push(alt_kategori); p++; }
    if (il){ where.push(`i.sehir ILIKE $${p}`); params.push('%'+(await ilAd(il))+'%'); p++; }
    else if (sehir){ where.push(`i.sehir ILIKE $${p}`); params.push('%'+sehir+'%'); p++; }
    if (ilce){ where.push(`i.ilce ILIKE $${p}`); params.push('%'+ilce+'%'); p++; }
    const fmin=fiyat_min||min_fiyat, fmax=fiyat_max||max_fiyat;
    if (fmin){ where.push(`i.fiyat>=$${p}`); params.push(fmin); p++; }
    if (fmax){ where.push(`i.fiyat<=$${p}`); params.push(fmax); p++; }
    const kw=kelime||q;
    if (kw){ where.push(`(i.baslik ILIKE $${p} OR i.aciklama ILIKE $${p})`); params.push('%'+kw+'%'); p++; }
    const tarihMap={'24saat':'1 day','3gun':'3 days','7gun':'7 days','15gun':'15 days'};
    if (tarihMap[ilan_tarihi]){ where.push(`i.created_at >= NOW() - INTERVAL '${tarihMap[ilan_tarihi]}'`); }
    if (satici_puani){ where.push(`u.puan >= $${p}`); params.push(satici_puani); p++; }
    if (plus_ilan==='true') where.push("i.vitamin_tier IN ('plus','zirve')");
    if (videolu==='true') where.push("i.has_video=true");
    if (cuzdan_guvende==='true') where.push("i.cuzdan_guvende=true");
    if (ucretsiz_kargo==='true') where.push("i.ucretsiz_kargo=true");
    if (elden_al==='true') where.push("i.elden_al_kartla_ode=true");
    if (kuponlu==='true') where.push("i.kuponlu=true");
    if (durum){ where.push(`i.durum=$${p}`); params.push(durum); p++; }
    const order = {
      'en-yeni':'i.created_at DESC', 'en-dusuk':'i.fiyat ASC', 'en-yuksek':'i.fiyat DESC',
      'en-cok-goruntulenen':'i.goruntulenme DESC',
    }[siralama] || "CASE i.vitamin_tier WHEN 'zirve' THEN 2 WHEN 'plus' THEN 1 ELSE 0 END DESC, i.one_cikarildi DESC, i.created_at DESC";
    const baseFrom = `FROM ilanlar i JOIN users u ON u.id=i.user_id LEFT JOIN kategoriler k ON k.id=i.kategori_id WHERE ${where.join(' AND ')}`;
    const sel = `SELECT i.*, k.ad as kategori_ad, k.slug as kategori_slug, u.ad, u.soyad, u.puan as satici_puan, u.toplam_satis,
      (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto ${baseFrom}`;
    const { rows } = await query(`${sel} ORDER BY ${order} LIMIT $${p} OFFSET $${p+1}`, [...params, limit, offset]);
    const { rows: cnt } = await query(`SELECT COUNT(*)::int as t ${baseFrom}`, params);
    // Zirve + Plus Strips (nur bei Kategorieseite)
    let zirve=[], plus=[];
    if (slug) {
      const stripFrom = `FROM ilanlar i JOIN users u ON u.id=i.user_id LEFT JOIN kategoriler k ON k.id=i.kategori_id
        WHERE i.ilan_durum='aktif' AND (k.slug=$1 OR k.ust_id=(SELECT id FROM kategoriler WHERE slug=$1) OR k.ust_id IN (SELECT id FROM kategoriler WHERE ust_id=(SELECT id FROM kategoriler WHERE slug=$1)))`;
      const stripSel = `SELECT i.uuid,i.baslik,i.fiyat,i.sehir,i.durum,i.vitamin_tier,(SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto`;
      zirve = (await query(`${stripSel} ${stripFrom} AND i.vitamin_tier='zirve' ORDER BY i.created_at DESC LIMIT 20`,[slug])).rows;
      plus  = (await query(`${stripSel} ${stripFrom} AND i.vitamin_tier IN ('plus','zirve') ORDER BY i.created_at DESC LIMIT 10`,[slug])).rows;
    }
    res.json({ toplam: cnt[0].t, sayfa:+sayfa, limit, ilanlar: rows, zirve_ilanlar: zirve, plus_ilanlar: plus });
  } catch(e){ res.status(500).json({ hata: e.message }); }
});

async function ilAd(kodOrAd){
  if(/^\d+$/.test(kodOrAd)){ const {rows}=await query('SELECT ad FROM iller WHERE kod=$1',[+kodOrAd]); return rows[0]?.ad||''; }
  return kodOrAd;
}

// Kategori sidebar sayıları (alt kategoriler + ilan sayısı)
router.get('/kategori-sayilar', async (req,res)=>{
  try{
    const slug=req.query.slug;
    const { rows } = await query(`
      SELECT alt.id, alt.ad, alt.slug, COUNT(i.id)::int as ilan_sayisi
      FROM kategoriler alt
      LEFT JOIN kategoriler d ON d.ust_id=alt.id
      LEFT JOIN ilanlar i ON (i.kategori_id=alt.id OR i.kategori_id=d.id) AND i.ilan_durum='aktif'
      WHERE alt.ust_id=(SELECT id FROM kategoriler WHERE slug=$1)
      GROUP BY alt.id, alt.ad, alt.slug ORDER BY alt.sira`,[slug]);
    res.json(rows);
  }catch(e){ res.status(500).json({hata:e.message}); }
});

// Kendi ilanlarım
router.get('/benim', authMiddleware, async (req, res) => {
  try {
    const filtre = req.query.filtre; // aktif | suresi-dolmus
    let cond = 'i.user_id=$1'; const p=[req.user.id];
    if (filtre==='suresi-dolmus') cond += " AND (i.ilan_durum='pasif' OR i.bitis_tarihi < NOW())";
    else if (filtre==='aktif') cond += " AND i.ilan_durum='aktif' AND (i.bitis_tarihi IS NULL OR i.bitis_tarihi >= NOW())";
    const { rows } = await query(`SELECT i.*, k.ad as kategori_ad,
      (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto
      FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id WHERE ${cond} ORDER BY i.created_at DESC`, p);
    res.json({ ilanlar: rows });
  } catch(e){ res.status(500).json({ hata: e.message }); }
});

// Tek ilan detay
router.get('/:uuid', async (req, res) => {
  try {
    // Ungueltige Kennung (kein UUID, kein numerischer Wert) fuehrt in Postgres
    // sonst zu 22P02 -> 500 mit roher Fehlermeldung. Geteilte kaputte Links
    // sollen ein sauberes 404 bekommen.
    {
      const k = String(req.params.uuid || '');
      const istUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k);
      if (!istUuid && !/^\d+$/.test(k)) return res.status(404).json({ hata: 'İlan bulunamadı' });
    }
    const { rows } = await query(
      `SELECT i.*, k.ad as kategori_ad, k.slug as kategori_slug,
              u.id as satici_id, u.ad, u.soyad, u.puan as satici_puan,
              u.toplam_satis, u.avatar_url, u.hesap_tipi, u.firma_adi, u.vkn,
              kc.durum as satici_kyc
       FROM ilanlar i
       JOIN users u ON u.id=i.user_id
       LEFT JOIN kategoriler k ON k.id=i.kategori_id
       LEFT JOIN kyc_results kc ON kc.user_id=u.id
       WHERE i.uuid=$1`, [req.params.uuid]
    );
    if (!rows[0]) return res.status(404).json({ hata: 'İlan bulunamadı' });

    // Ein zurueckgezogenes Inserat darf nicht weiter oeffentlich abrufbar sein.
    // Der Eigentuemer muss es aber laden koennen — die Bearbeiten-Maske holt
    // sich ihre Anfangswerte genau hier. Deshalb Token optional auswerten:
    // ohne Token bleibt es bei 404, statt die Route auth-pflichtig zu machen.
    //
    // WICHTIG: nur ausdruecklich zurueckgezogene Zustaende sperren, NICHT
    // "alles ausser aktif". 'askida' setzt POST /api/islemler/satin-al beim
    // Kauf, 'satildi' der Abschluss — der Kaeufer muss das gekaufte Objekt
    // aus Chat, Link und Favoriten weiter ansehen koennen. 'moderasyonda'
    // betrifft frisch angelegte Inserate. Eine Sperre auf !== 'aktif' nahm
    // genau diesen Leuten die Seite weg.
    const VERBORGEN = ['pasif'];
    const betrachter = optionalerNutzer(req);
    const istEigentuemer = betrachter != null && betrachter === rows[0].user_id;
    if (VERBORGEN.includes(rows[0].ilan_durum) && !istEigentuemer)
      return res.status(404).json({ hata: 'İlan bulunamadı' });

    const { rows: foto } = await query('SELECT * FROM ilan_fotograflar WHERE ilan_id=$1 ORDER BY sira', [rows[0].id]);
    // Eigene Aufrufe nicht mitzaehlen — sonst faelscht schon das Oeffnen der
    // eigenen Bearbeiten-Maske die Aufrufzahl des eigenen Inserats.
    if (!istEigentuemer) await query('UPDATE ilanlar SET goruntulenme=goruntulenme+1 WHERE id=$1', [rows[0].id]);
    res.json({ ...rows[0], fotograflar: foto });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Benzer ilanlar — "Related Items" der Detailseite.
//
// Die Auswahl passiert hier und nicht im Browser: das Frontend haelt nur die
// gerade sichtbare Seite an Inseraten, eine clientseitige Auswahl waere also
// auf genau diese Teilmenge beschraenkt und damit je nach Einstiegspunkt
// unterschiedlich. Zwei getrennte Listen, damit die Oberflaeche ehrlich
// bleibt und "aus derselben Kategorie" nicht mit Auffuellern vermischt wird:
//   ilanlar       — dieselbe Kategorie samt Unterkategorien
//   diger_ilanlar — Auffueller aus anderen Kategorien, nur wenn oben zu wenig
router.get('/:uuid/benzer', async (req, res) => {
  try {
    const k = String(req.params.uuid || '');
    const istUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k);
    if (!istUuid && !/^\d+$/.test(k)) return res.status(404).json({ hata: 'İlan bulunamadı' });
    const limit = Math.min(Math.max(+(req.query.limit || 12), 1), 24);

    const { rows: ziel } = await query(
      `SELECT i.id, i.kategori_id, k.ad AS kategori_ad, k.slug AS kategori_slug, k.ust_id
       FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id WHERE i.uuid=$1`, [k]);
    if (!ziel[0]) return res.status(404).json({ hata: 'İlan bulunamadı' });
    const z = ziel[0];

    // Reihenfolge wie in der Kategorieliste: bezahlte Platzierung zuerst, dann neu.
    const SEL = `SELECT i.uuid, i.baslik, i.fiyat, i.sehir, i.ilce, i.durum, i.vitamin_tier,
        k.ad AS kategori_ad, k.slug AS kategori_slug,
        (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) AS ana_foto,
        (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id ORDER BY sira LIMIT 1) AS ilk_foto
      FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id
      WHERE i.ilan_durum='aktif' AND i.id <> $1`;
    const ORD = `ORDER BY CASE i.vitamin_tier WHEN 'zirve' THEN 2 WHEN 'plus' THEN 1 ELSE 0 END DESC,
        i.created_at DESC LIMIT $%L%`;

    let gleich = [];
    if (z.kategori_id) {
      // Kategorie selbst + alle Unterkategorien (zwei Ebenen, wie in GET /).
      gleich = (await query(
        `${SEL} AND (i.kategori_id=$2
             OR i.kategori_id IN (SELECT id FROM kategoriler WHERE ust_id=$2)
             OR i.kategori_id IN (SELECT id FROM kategoriler WHERE ust_id IN (SELECT id FROM kategoriler WHERE ust_id=$2)))
         ${ORD.replace('$%L%', '$3')}`, [z.id, z.kategori_id, limit])).rows;
    }

    // Auffueller nur, wenn die Kategorie zu duenn besetzt ist.
    let diger = [];
    const fehlt = limit - gleich.length;
    if (fehlt > 0) {
      // COALESCE, weil `NOT IN` bei kategori_id IS NULL zu NULL ausgewertet wird
      // und ein Inserat ohne Kategorie sonst still aus dem Auffueller fiele.
      diger = (await query(
        `${SEL} AND ($2::int IS NULL OR COALESCE(i.kategori_id, -1) NOT IN (
             SELECT $2::int
             UNION ALL SELECT id FROM kategoriler WHERE ust_id=$2
             UNION ALL SELECT id FROM kategoriler WHERE ust_id IN (SELECT id FROM kategoriler WHERE ust_id=$2)))
         ${ORD.replace('$%L%', '$3')}`, [z.id, z.kategori_id, fehlt])).rows;
    }

    const norm = r => ({ ...r, ana_foto: r.ana_foto || r.ilk_foto || null, ilk_foto: undefined });
    res.json({
      kategori: z.kategori_id ? { id: z.kategori_id, ad: z.kategori_ad, slug: z.kategori_slug } : null,
      ilanlar: gleich.map(norm),
      diger_ilanlar: diger.map(norm),
    });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Yeni ilan — AI moderasyon entegre
router.post('/', authMiddleware, kycGerekli, ilanUpload, async (req, res) => {
  try {
    const { baslik, aciklama, fiyat, durum, kategori_id, sehir, ilce, kargo_var, elden_teslim, kargo_ucreti, foto_url } = req.body;
    const fotoDateien = (req.files && req.files.fotograflar) || [];
    const videoDatei = ((req.files && req.files.video) || [])[0] || null;

    // Vor dem Anlegen pruefen, sonst stuende ein Inserat ohne Bilder in der DB.
    const medienFehler = medienPruefen(fotoDateien, videoDatei);
    if (medienFehler) return res.status(400).json({ hata: medienFehler });
    // AI Moderasyon — NVIDIA. Varsayilan: yayinla. Sadece net spam/dolandiricilik (cok dusuk skor) incelemeye alinir.
    const ai_sonuc = await ai.moderasyonYap(baslik, aciklama||'', fiyat);
    const ilan_durum = Number(ai_sonuc.skor) < 40 ? 'moderasyonda' : 'aktif';
    const { rows } = await query(
      `INSERT INTO ilanlar(user_id,kategori_id,baslik,aciklama,fiyat,durum,ilan_durum,
        sehir,ilce,kargo_var,elden_teslim,kargo_ucreti,ai_score,ai_karar,ai_not)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.user.id, kategori_id, baslik, aciklama, fiyat, durum||'ikinci_el', ilan_durum,
       sehir, ilce, kargo_var!==false, elden_teslim!==false, kargo_ucreti||0,
       ai_sonuc.skor, ai_sonuc.onaylandi?'onaylandi':'reddedildi', ai_sonuc.sebep]
    );
    const ilan = rows[0];
    const uploadDir = `${process.env.UPLOAD_DIR}/ilanlar`;
    // Fotoğrafları sıkıştır ve kaydet — die Reihenfolge im Formular ist die
    // Reihenfolge in der Galerie, das erste Bild ist das Titelbild.
    if (fotoDateien.length) {
      for (let i = 0; i < fotoDateien.length; i++) {
        const fname = `${ilan.uuid}_${i}.webp`;
        await sharp(fotoDateien[i].buffer).resize(1200,1200,{fit:'inside'}).webp({quality:80}).toFile(`${uploadDir}/${fname}`);
        await query('INSERT INTO ilan_fotograflar(ilan_id,url,sira,ana_foto) VALUES($1,$2,$3,$4)',
          [ilan.id, `/uploads/ilanlar/${fname}`, i, i===0]);
      }
    } else if (foto_url) {
      await query('INSERT INTO ilan_fotograflar(ilan_id,url,sira,ana_foto) VALUES($1,$2,0,true)', [ilan.id, foto_url]);
    }
    // Video roh ablegen — es gibt keine Transkodierung, deshalb die enge Grenze.
    // has_video wird mitgefuehrt, damit der bestehende Filter "videolu=true"
    // aus GET /api/ilanlar endlich echte Treffer liefert.
    if (videoDatei) {
      const vname = `${ilan.uuid}_video.${VIDEO_TYPEN[videoDatei.mimetype]}`;
      fs.writeFileSync(`${uploadDir}/${vname}`, videoDatei.buffer);
      const vurl = `/uploads/ilanlar/${vname}`;
      await query('UPDATE ilanlar SET video_url=$1, has_video=true WHERE id=$2', [vurl, ilan.id]);
      ilan.video_url = vurl; ilan.has_video = true;
    }
    await auditLog('ilan.olustur', 'api', { userId: req.user.id, hedefTip:'ilan', hedefId: ilan.id, detay: { ai_sonuc } });
    res.status(201).json({ ilan, ai_sonuc, mesaj: ilan_durum==='aktif' ? 'İlanınız yayında!' : 'İlanınız incelemeye alındı' });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// İlanı güncelle (sahip) — Titel, Beschreibung, Preis, Kategorie, Zustand,
// Ort sowie Fotos und Video.
//
// Fotos werden als ZIELZUSTAND uebergeben, nicht als Einzelbefehle: das Feld
// `behalten` enthaelt die URLs der Bestandsbilder, die bleiben sollen, in der
// gewuenschten Reihenfolge; alles andere wird entfernt. Neue Dateien kommen
// wie beim Anlegen als `fotograflar` und werden hinten angehaengt. So kann die
// Maske einfach ihre Liste schicken, ohne Reihenfolge und Loeschungen einzeln
// nachzuhalten — und ein abgebrochener Aufruf hinterlaesst keinen Halbzustand.
//
// Die KI-Moderation laeuft hier bewusst NICHT erneut: sie ist ausgefallen
// (410) und wuerde ueber ihren freundlichen Rueckfallwert ohnehin nur alles
// durchwinken. Siehe Backlog in CLAUDE.md.
router.put('/:uuid', authMiddleware, ilanUpload, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM ilanlar WHERE uuid=$1 AND user_id=$2', [req.params.uuid, req.user.id]);
    if (!rows[0]) return res.status(404).json({ hata: 'İlan bulunamadı' });
    const ilan = rows[0];

    const neueFotos = (req.files && req.files.fotograflar) || [];
    const videoDatei = ((req.files && req.files.video) || [])[0] || null;
    const medienFehler = medienPruefen(neueFotos, videoDatei);
    if (medienFehler) return res.status(400).json({ hata: medienFehler });

    // Zielzustand der Galerie. `sirala` ist die vollstaendige Wunschreihenfolge:
    // je Eintrag entweder die URL eines Bestandsbildes oder "#yeni:N" als
    // Platzhalter fuer die N-te Datei aus `fotograflar`. So kann die Maske ein
    // neues Foto auch VOR ein bestehendes schieben — mit einer reinen
    // Behalten-Liste landeten neue Bilder immer am Ende und die Anzeige waere
    // eine andere als das Ergebnis.
    const { rows: bestand } = await query('SELECT * FROM ilan_fotograflar WHERE ilan_id=$1 ORDER BY sira', [ilan.id]);
    const nachUrl = new Map(bestand.map(f => [f.url, f]));

    let wunsch;
    const roh = req.body.sirala;
    if (roh == null) {
      // Kein Wunsch mitgeschickt: Bestand behalten, Neue hinten anhaengen.
      wunsch = [...bestand.map(f => f.url), ...neueFotos.map((_, n) => `#yeni:${n}`)];
    } else {
      try { wunsch = typeof roh === 'string' ? JSON.parse(roh) : roh; }
      catch { return res.status(400).json({ hata: 'Fotoğraf listesi okunamadı.' }); }
      if (!Array.isArray(wunsch)) return res.status(400).json({ hata: 'Fotoğraf listesi okunamadı.' });
    }

    // Auf gueltige Eintraege eindampfen. Eine fremde URL wird verworfen, sonst
    // liesse sich ueber das Feld ein Bild eines anderen Inserats einhaengen.
    const ziel = [];
    const gesehen = new Set();
    for (const e of wunsch) {
      if (typeof e !== 'string') continue;
      const m = /^#yeni:(\d+)$/.exec(e);
      if (m) {
        // Ueber die ZAHL entdoppeln, nicht ueber die Zeichenkette: "#yeni:0"
        // und "#yeni:00" meinen dieselbe Datei und haetten sonst zwei
        // Fotozeilen auf denselben Pfad erzeugt.
        const n = Number(m[1]);
        const schluessel = `#yeni:${n}`;
        if (n >= 0 && n < neueFotos.length && !gesehen.has(schluessel)) { gesehen.add(schluessel); ziel.push({ neu: n }); }
      } else if (nachUrl.has(e) && !gesehen.has(e)) {
        gesehen.add(e); ziel.push({ vorhanden: nachUrl.get(e) });
      }
    }
    // Mitgeschickte Dateien, die in der Liste fehlen, hinten anhaengen —
    // besser als sie stillschweigend zu verwerfen.
    for (let n = 0; n < neueFotos.length; n++)
      if (!gesehen.has(`#yeni:${n}`)) ziel.push({ neu: n });

    if (ziel.length > FOTO_MAX)
      return res.status(400).json({ hata: `En fazla ${FOTO_MAX} fotoğraf yükleyebilirsiniz.` });
    if (ziel.length === 0)
      return res.status(400).json({ hata: 'En az 1 fotoğraf gerekli.' });

    // ── Textfelder: nur uebernehmen, was mitgeschickt wurde ──
    // Leere oder fehlende Felder werden nicht uebernommen — so kann die Maske
    // Teilaenderungen schicken, ohne unbeteiligte Spalten zu leeren.
    const feld = (wert) => (wert === undefined || wert === null || wert === '' ? null : wert);
    const b = req.body;
    const setzen = []; const werte = []; let p = 1;
    const dazu = (spalte, wert) => { if (wert !== null) { setzen.push(`${spalte}=$${p++}`); werte.push(wert); } };
    dazu('baslik', feld(b.baslik));
    dazu('aciklama', feld(b.aciklama));
    // Grenzen hier pruefen statt Postgres in einen 500er mit rohem Fehlertext
    // laufen zu lassen. baslik ist varchar(200), durum varchar(20).
    if (b.baslik !== undefined && String(b.baslik).length > 200)
      return res.status(400).json({ hata: 'Başlık en fazla 200 karakter olabilir.' });
    if (b.durum !== undefined && b.durum !== '' && !['sifir', 'az_kullanilmis', 'ikinci_el'].includes(String(b.durum)))
      return res.status(400).json({ hata: 'Geçersiz ürün durumu.' });
    if (b.fiyat !== undefined && b.fiyat !== '') {
      const f = Number(b.fiyat);
      if (isNaN(f) || f <= 0) return res.status(400).json({ hata: 'Lütfen geçerli bir fiyat girin.' });
      if (f > 99999999.99) return res.status(400).json({ hata: 'Fiyat çok yüksek.' });
      dazu('fiyat', f);
    }
    if (b.kategori_id !== undefined && b.kategori_id !== '' && !isNaN(Number(b.kategori_id))) dazu('kategori_id', Number(b.kategori_id));
    dazu('durum', feld(b.durum));
    dazu('sehir', feld(b.sehir));
    // ilce darf ausdruecklich geleert werden, deshalb nicht ueber dazu()
    if (b.ilce !== undefined) { setzen.push(`ilce=$${p++}`); werte.push(b.ilce || null); }

    // ── Bilder ZUERST umwandeln, bevor irgendetwas geloescht wird ──
    //
    // Ein frueherer Entwurf loeschte die Bestandsfotos samt Dateien und liess
    // sharp erst danach laufen. Brach sharp ab (etwa bei einer Datei, die nur
    // vorgibt ein Bild zu sein — der MIME-Typ kommt aus dem Multipart-Header
    // des Clients und ist frei setzbar), waren die alten Bilder unwiederbringlich
    // weg, die neuen nie entstanden, und das Inserat stand ohne jedes Bild
    // weiter oeffentlich da. Deshalb: erst in den Speicher umwandeln, und nur
    // wenn das fuer ALLE neuen Bilder geklappt hat, wird geschrieben.
    const stempel = Date.now();
    const fertige = new Map();   // Index der neuen Datei -> { fname, daten }
    try {
      for (const z of ziel) {
        if (z.vorhanden) continue;
        const daten = await sharp(neueFotos[z.neu].buffer)
          .resize(1200, 1200, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
        fertige.set(z.neu, { fname: `${ilan.uuid}_${stempel}_${z.neu}.webp`, daten });
      }
    } catch {
      return res.status(400).json({ hata: 'Fotoğraf işlenemedi. Lütfen başka bir dosya deneyin.' });
    }

    // ── Video: ersetzen, entfernen oder unveraendert lassen ──
    const videoEntfernen = String(b.video_kaldir || '') === '1';
    const alteVideoUrl = ilan.video_url;
    const uploadDir = `${process.env.UPLOAD_DIR}/ilanlar`;
    let neueVideoUrl = alteVideoUrl;
    let videoName = null;
    if (videoDatei) {
      videoName = `${ilan.uuid}_video.${VIDEO_TYPEN[videoDatei.mimetype]}`;
      neueVideoUrl = `/uploads/ilanlar/${videoName}`;
    } else if (videoEntfernen) {
      neueVideoUrl = null;
    }
    if (neueVideoUrl !== alteVideoUrl) {
      setzen.push(`video_url=$${p++}`); werte.push(neueVideoUrl);
      setzen.push(`has_video=$${p++}`); werte.push(!!neueVideoUrl);
    }
    // updated_at ist immer dabei, das UPDATE laeuft also in jedem Fall.
    setzen.push('updated_at=NOW()');
    werte.push(ilan.id);

    // ── Datenbank in EINER Transaktion ──
    // Ohne sie konnten zwei gleichzeitige Aenderungen ein Inserat ohne
    // Titelbild und mit Luecken in der Reihenfolge hinterlassen.
    const behaltenIds = new Set(ziel.filter(z => z.vorhanden).map(z => z.vorhanden.id));
    const entfallen = bestand.filter(f => !behaltenIds.has(f.id));
    const verbindung = await pool.connect();
    try {
      await verbindung.query('BEGIN');
      // Zeile sperren, damit ein paralleler PUT wartet statt dazwischenzugehen.
      await verbindung.query('SELECT id FROM ilanlar WHERE id=$1 FOR UPDATE', [ilan.id]);
      await verbindung.query(`UPDATE ilanlar SET ${setzen.join(', ')} WHERE id=$${p}`, werte);
      if (entfallen.length)
        await verbindung.query('DELETE FROM ilan_fotograflar WHERE id = ANY($1::int[])', [entfallen.map(f => f.id)]);
      for (let i = 0; i < ziel.length; i++) {
        if (ziel[i].vorhanden) {
          await verbindung.query('UPDATE ilan_fotograflar SET sira=$1, ana_foto=$2 WHERE id=$3',
            [i, i === 0, ziel[i].vorhanden.id]);
        } else {
          const f = fertige.get(ziel[i].neu);
          await verbindung.query('INSERT INTO ilan_fotograflar(ilan_id,url,sira,ana_foto) VALUES($1,$2,$3,$4)',
            [ilan.id, `/uploads/ilanlar/${f.fname}`, i, i === 0]);
        }
      }
      await verbindung.query('COMMIT');
    } catch (e) {
      await verbindung.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      verbindung.release();
    }

    // ── Dateien erst nach dem COMMIT anfassen ──
    for (const f of fertige.values()) fs.writeFileSync(`${uploadDir}/${f.fname}`, f.daten);
    if (videoDatei && videoName) fs.writeFileSync(`${uploadDir}/${videoName}`, videoDatei.buffer);
    if (entfallen.length) await dateienEntfernen(entfallen.map(f => f.url), ilan.uuid);
    if (alteVideoUrl && alteVideoUrl !== neueVideoUrl) await dateienEntfernen([alteVideoUrl], ilan.uuid);

    await meiliSync.syncListing(ilan.uuid);
    await auditLog('ilan.guncelle', 'api', { userId: req.user.id, hedefTip: 'ilan', hedefId: ilan.id });
    const { rows: neu } = await query('SELECT * FROM ilanlar WHERE id=$1', [ilan.id]);
    const { rows: fotoNeu } = await query('SELECT * FROM ilan_fotograflar WHERE ilan_id=$1 ORDER BY sira', [ilan.id]);
    res.json({ ilan: { ...neu[0], fotograflar: fotoNeu }, mesaj: 'İlan güncellendi' });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// İlanı sil (sahip) — endgueltig.
//
// Vorher setzte diese Route nur ilan_durum='pasif' und meldete trotzdem
// "İlan kaldırıldı": Zeile, Fotozeilen und Bilddateien blieben liegen, und
// der Direktlink lieferte das "geloeschte" Inserat weiter an jeden aus.
// Jetzt wird wirklich geloescht — die Fotozeilen gehen per FK-Cascade mit,
// die Dateien raeumt der Handler selbst ab.
router.delete('/:uuid', authMiddleware, async (req, res) => {
  try {
    // Ohne diese Pruefung erzeugt eine numerische ID in Postgres 22P02 und
    // damit einen 500er mit rohem Fehlertext.
    const k = String(req.params.uuid || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k))
      return res.status(404).json({ hata: 'İlan bulunamadı' });

    const { rows } = await query('SELECT * FROM ilanlar WHERE uuid=$1 AND user_id=$2', [k, req.user.id]);
    if (!rows[0]) return res.status(404).json({ hata: 'İlan bulunamadı' });
    const ilan = rows[0];

    // Ein laufendes Geschaeft darf nicht weggeloescht werden. Die Belegzeile
    // ueberlebt zwar (ilan_id=NULL), faellt damit aber aus GET /api/islemler/benim
    // heraus — das verbindet per INNER JOIN mit ilanlar. Der Vorgang
    // verschwaende fuer Kaeufer UND Verkaeufer, das Geld haengt, und der
    // Chatverlauf zum Inserat geht per CASCADE gleich mit. Ein Verkaeufer
    // koennte so nach einer Beschwerde die Beweislage entfernen.
    const OFFEN = ['odeme_bekleniyor', 'aktif', 'askida', 'kargoya_verildi', 'itiraz_acildi'];
    const { rows: laufend } = await query(
      'SELECT COUNT(*)::int AS n FROM islemler WHERE ilan_id=$1 AND durum = ANY($2::text[])',
      [ilan.id, OFFEN]);
    if (laufend[0].n > 0)
      return res.status(409).json({ hata: 'Bu ilan için devam eden bir işlem var. İşlem tamamlanmadan ilan silinemez.' });

    const { rows: fotos } = await query('SELECT url FROM ilan_fotograflar WHERE ilan_id=$1', [ilan.id]);

    // Sieben Fremdschluessel auf ilanlar stehen auf NO ACTION und wuerden ein
    // DELETE blockieren. Geschaeftsunterlagen duerfen dabei NICHT verschwinden,
    // nur weil ein Verkaeufer sein Inserat entfernt — Zahlungen, Bewertungen
    // und Beschwerden bleiben also erhalten und verlieren nur den Verweis.
    // Gebote sind ohne Inserat gegenstandslos und gehen mit.
    // Die uebrigen Verweise (Fotos, Favoriten, Chats, Warenkorb, Merkmale,
    // Beobachter) raeumt die DB per CASCADE selbst ab.
    const LOESEN = ['odemeler', 'payments', 'islemler', 'degerlendirmeler',
                    'ilan_sikayetler', 'ilan_vitaminler', 'support_tickets'];
    const verbindung = await pool.connect();
    try {
      await verbindung.query('BEGIN');
      for (const t of LOESEN) await verbindung.query(`UPDATE ${t} SET ilan_id=NULL WHERE ilan_id=$1`, [ilan.id]);
      await verbindung.query('DELETE FROM teklifler WHERE ilan_id=$1', [ilan.id]);
      await verbindung.query('DELETE FROM ilanlar WHERE id=$1', [ilan.id]);
      await verbindung.query('COMMIT');
    } catch (e) {
      await verbindung.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      verbindung.release();
    }

    // Dateien erst nach dem COMMIT — ein Rollback soll keine Bilder kosten.
    const weg = await dateienEntfernen([...fotos.map(f => f.url), ilan.video_url], ilan.uuid);
    // Ohne das blieb das Inserat im Suchindex und wurde ueber /api/arama
    // weiter oeffentlich ausgeliefert, obwohl es die Zeile nicht mehr gibt.
    await meiliSync.deleteListing(ilan.uuid);

    await auditLog('ilan.sil', 'api', { userId: req.user.id, hedefTip:'ilan', hedefId: ilan.id, detay: { dateien: weg } });
    res.json({ mesaj: 'İlan silindi' });
  } catch(e) {
    // Rohe SQL-Meldungen gehoeren nicht zum Aufrufer.
    console.error('[ilanlar] DELETE:', e.message);
    res.status(500).json({ hata: 'İlan silinemedi.' });
  }
});

// AI açıklama önerisi
router.post('/ai/aciklama-oner', authMiddleware, async (req, res) => {
  const { baslik, durum, fiyat } = req.body;
  const aciklama = await ai.aciklamaOner(baslik, durum, fiyat);
  res.json({ aciklama });
});

// AI fiyat önerisi
router.post('/ai/fiyat-oner', authMiddleware, async (req, res) => {
  const { urun, durum } = req.body;
  const fiyat = await ai.fiyatOner(urun, durum);
  res.json(fiyat);
});

// Satıldı işaretle
router.put('/:id/satildi', authMiddleware, async (req, res) => {
  const { rows } = await query("UPDATE ilanlar SET ilan_durum='satildi' WHERE id=$1 AND user_id=$2 RETURNING id",[req.params.id, req.user.id]);
  if(!rows[0]) return res.status(404).json({ hata:'İlan bulunamadı' });
  res.json({ ok:true });
});
// Yeniden yayınla (+30 gün)
router.put('/:id/yeniden', authMiddleware, async (req, res) => {
  const { rows } = await query("UPDATE ilanlar SET ilan_durum='aktif', bitis_tarihi=NOW()+INTERVAL '30 days' WHERE id=$1 AND user_id=$2 RETURNING id",[req.params.id, req.user.id]);
  if(!rows[0]) return res.status(404).json({ hata:'İlan bulunamadı' });
  res.json({ ok:true });
});

// Kategori-Attribute (dynamische Özellikler) — inkl. Ana-Kategorie-Attribute (Parent-Walk)
router.get('/ozellikler/:kategori_id', async (req, res) => {
  try {
    const { rows: tan } = await query(`
      WITH RECURSIVE zincir AS (
        SELECT id, ust_id FROM kategoriler WHERE id=$1
        UNION ALL SELECT k.id, k.ust_id FROM kategoriler k JOIN zincir z ON k.id=z.ust_id
      )
      SELECT * FROM kategori_ozellik_tanimlari WHERE kategori_id IN (SELECT id FROM zincir) ORDER BY sira, id`,[req.params.kategori_id]);
    for (const t of tan) {
      const { rows: sec } = await query('SELECT deger FROM kategori_ozellik_secenekleri WHERE tanim_id=$1 ORDER BY sira, id',[t.id]);
      t.secenekler = sec.map(s=>s.deger);
    }
    res.json(tan);
  } catch(e){ res.status(500).json({ hata: e.message }); }
});

// ── Overnight: İlan Uzatma + Admin ──────────────────────────────
const { requireAdmin: _reqAdmin } = require('../middleware/auth');

// POST /:uuid/uzat – İlan süresini 30 gün uzat
router.post('/:uuid/uzat', authMiddleware, async (req, res) => {
  try {
    const r = await query('SELECT * FROM ilanlar WHERE uuid=$1 AND user_id=$2', [req.params.uuid, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'İlan bulunamadı.' });
    const ilan = r.rows[0];
    if ((ilan.uzatma_sayisi || 0) >= (ilan.max_uzatma || 10))
      return res.status(400).json({ error: 'Maksimum uzatma sınırına ulaşıldı.' });
    const yeni = new Date(ilan.son_gecerlilik || new Date());
    yeni.setDate(yeni.getDate() + 30);
    await query(`UPDATE ilanlar SET son_gecerlilik=$1, uzatma_sayisi=COALESCE(uzatma_sayisi,0)+1,
       yayin_durum='canli', hatirlama_gonderildi=false WHERE uuid=$2`, [yeni, req.params.uuid]);
    res.json({ ok: true, son_gecerlilik: yeni, uzatma_sayisi: (ilan.uzatma_sayisi||0)+1 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /admin/:uuid/durum – yayın durumu değiştir
router.patch('/admin/:uuid/durum', _reqAdmin, async (req, res) => {
  await query('UPDATE ilanlar SET yayin_durum=$1 WHERE uuid=$2', [req.body.durum, req.params.uuid]);
  res.json({ ok: true });
});

// GET /admin/all – tüm ilanlar (durum filtreli)
router.get('/admin/all', _reqAdmin, async (req, res) => {
  const { durum } = req.query;
  const params = []; let where = '';
  if (durum && durum !== 'all') { params.push(durum); where = 'WHERE i.yayin_durum = $1'; }
  const r = await query(`SELECT i.uuid, i.ilan_no, i.baslik, i.fiyat, i.yayin_durum, i.sikayet_sayisi,
     i.son_gecerlilik, i.created_at, k.ad as satici_ad FROM ilanlar i
     LEFT JOIN users k ON k.id=i.user_id ${where} ORDER BY i.created_at DESC LIMIT 200`, params);
  res.json(r.rows);
});

module.exports = router;
