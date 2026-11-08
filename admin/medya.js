// ════════════════════════════════════════════════════════════════════════════
//  Express-Admin: SİSTEM → Medya Motoru (Auftragssammlung J, v1.29).
//  Kennzahlen, Jobliste mit Filter und „Tekrar dene", Einstellungen.
//  Die Jobs selbst verarbeitet der Dienst kapbeni-media (api/src/medyaMotoru.js);
//  hier wird nur gelesen, zurueckgestellt und die Engine geweckt.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const http = require('http');
const medyaAyar = require('../api/src/lib/medyaAyar');

const UPLOAD = process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const TMP_MEDYA = path.join(UPLOAD, 'tmp', 'medya');

function motor(methode, pfad) {
  return new Promise((fertig) => {
    const token = process.env.MEDYA_MOTORU_TOKEN;
    if (!token) return fertig(null);
    const req = http.request({ host: '127.0.0.1', port: Number(process.env.MEDYA_MOTORU_PORT || 3901), path: pfad, method: methode,
      headers: { Authorization: `Bearer ${token}`, 'Content-Length': 0 }, timeout: 1500 }, (res) => {
      let s = ''; res.on('data', (d) => { s += d; }); res.on('end', () => { try { fertig(JSON.parse(s)); } catch { fertig(null); } });
    });
    req.on('error', () => fertig(null));
    req.on('timeout', () => { req.destroy(); fertig(null); });
    req.end();
  });
}

/** Belegung eines Ordners (nur eine Ebene tief — die Upload-Ordner sind flach,
 *  das Archiv hat zwei Ebenen und wird rekursiv gezaehlt). */
function ordnerGroesse(dir, tiefe = 3) {
  let n = 0, dateien = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const voll = path.join(dir, e.name);
      if (e.isFile()) { n += fs.statSync(voll).size; dateien++; }
      else if (e.isDirectory() && tiefe > 0) { const u = ordnerGroesse(voll, tiefe - 1); n += u.bayt; dateien += u.dosya; }
    }
  } catch { /* fehlt */ }
  return { bayt: n, dosya: dateien };
}

module.exports = function medyaRouten(app, { db, adminAuth, auditAdmin }) {
  const q = (sql, p) => db.query(sql, p);
  const fehler = (res, e, wo) => { console.error(`[medya/${wo}]`, e.message); res.status(500).json({ hata: 'İşlem yapılamadı' }); };
  const nurSuper = (req, res, next) => req.admin?.rol === 'super_admin' ? next()
    : res.status(403).json({ hata: 'Bu ayarları yalnızca süper yönetici değiştirebilir.' });

  app.get('/admin/api/medya/ozet', adminAuth, async (req, res) => {
    try {
      const [{ rows: d }, { rows: k }, { rows: s }] = await Promise.all([
        q(`SELECT durum, count(*)::int n FROM medya_isleri GROUP BY durum`),
        q(`SELECT COALESCE(sum(boyut_once),0)::bigint once, COALESCE(sum(boyut_sonra),0)::bigint sonra, count(*)::int n
             FROM medya_isleri WHERE durum='tamam' AND boyut_once > 0 AND boyut_sonra > 0`),
        q(`SELECT tip, round(avg(sure_ms))::int ort, count(*)::int n FROM medya_isleri
             WHERE durum='tamam' AND sure_ms IS NOT NULL AND created_at > now() - interval '30 days' GROUP BY tip`),
      ]);
      const say = Object.fromEntries(d.map((r) => [r.durum, r.n]));
      let disk = null;
      try { const st = fs.statfsSync(UPLOAD); disk = { toplam: st.blocks * st.bsize, bos: st.bavail * st.bsize }; } catch { /* alt */ }
      const durum = await motor('GET', '/durum');
      res.json({
        bekliyor: say.bekliyor || 0, isleniyor: say.isleniyor || 0, hata: say.hata || 0, tamam: say.tamam || 0,
        tasarruf: { once: Number(k[0].once), sonra: Number(k[0].sonra), adet: k[0].n },
        sure: Object.fromEntries(s.map((r) => [r.tip, { ort_ms: r.ort, adet: r.n }])),
        disk: { ...disk, ilanlar: ordnerGroesse(path.join(UPLOAD, 'ilanlar'), 0), arsiv: ordnerGroesse(path.join(UPLOAD, 'archiv')),
                gecici: ordnerGroesse(TMP_MEDYA, 0) },
        motor: durum ? { cevrimici: true, aktif: durum.aktiv, laufend: durum.laufend, seit: durum.seit } : { cevrimici: false },
      });
    } catch (e) { fehler(res, e, 'ozet'); }
  });

  app.get('/admin/api/medya/isler', adminAuth, async (req, res) => {
    try {
      const w = []; const p = [];
      if (['bekliyor', 'isleniyor', 'tamam', 'hata'].includes(req.query.durum)) { p.push(req.query.durum); w.push(`m.durum=$${p.length}`); }
      if (['bild', 'bild_sm', 'video'].includes(req.query.tip)) { p.push(req.query.tip); w.push(`m.tip=$${p.length}`); }
      if (req.query.ara) { p.push(`%${String(req.query.ara).slice(0, 60)}%`); w.push(`(i.baslik ILIKE $${p.length} OR u.musteri_no ILIKE $${p.length} OR m.ilan_uuid::text ILIKE $${p.length})`); }
      const sayfa = Math.max(1, +req.query.sayfa || 1); const adet = 50;
      const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
      const { rows } = await q(`SELECT m.id, m.tip, m.durum, m.senkron, m.ilan_id, m.ilan_uuid, m.deneme, m.hata, m.hata_kullanici,
            m.boyut_once, m.boyut_sonra, m.sure_ms, m.detay, m.hedef, m.created_at, m.bitti_at,
            i.baslik, u.musteri_no, trim(coalesce(u.ad,'')||' '||coalesce(u.soyad,'')) AS kullanici,
            (m.kaynak IS NOT NULL AND m.tip='video') AS kaynak_var
          FROM medya_isleri m LEFT JOIN ilanlar i ON i.id=m.ilan_id LEFT JOIN users u ON u.id=m.user_id
          ${where} ORDER BY m.id DESC LIMIT ${adet + 1} OFFSET ${(sayfa - 1) * adet}`, p);
      // Kann man es erneut versuchen? Nur Engine-Jobs; bei Videos muss die Quelle noch da sein (unten).
      for (const r of rows) { r.tekrar = r.durum === 'hata' && !r.senkron && r.tip !== 'video'; delete r.kaynak_var; }
      // Quelle pruefen (eine Abfrage, nur fuer fehlgeschlagene Videos der Seite)
      const ids = rows.filter((r) => r.durum === 'hata' && r.tip === 'video').map((r) => r.id);
      if (ids.length) {
        const { rows: k } = await q('SELECT id, kaynak FROM medya_isleri WHERE id = ANY($1::int[])', [ids]);
        const da = new Set(k.filter((x) => x.kaynak && path.resolve(x.kaynak).startsWith(TMP_MEDYA + path.sep) && fs.existsSync(x.kaynak)).map((x) => x.id));
        for (const r of rows) if (ids.includes(r.id)) r.tekrar = da.has(r.id);
      }
      res.json({ isler: rows.slice(0, adet), sonraki: rows.length > adet, sayfa });
    } catch (e) { fehler(res, e, 'isler'); }
  });

  app.post('/admin/api/medya/isler/:id(\\d+)/tekrar', adminAuth, async (req, res) => {
    try {
      const { rows } = await q('SELECT * FROM medya_isleri WHERE id=$1', [req.params.id]);
      const j = rows[0];
      if (!j) return res.status(404).json({ hata: 'İş bulunamadı' });
      if (j.durum !== 'hata') return res.status(409).json({ hata: 'Yalnızca başarısız işler tekrar denenebilir.' });
      if (j.senkron) return res.status(409).json({ hata: 'Bu görsel yükleme sırasında işlendi; dosya saklanmadı. Müşteri yeniden yüklemeli.' });
      if (j.tip === 'video' && !(j.kaynak && path.resolve(j.kaynak).startsWith(TMP_MEDYA + path.sep) && fs.existsSync(j.kaynak)))
        return res.status(409).json({ hata: 'Kaynak dosya artık yok (7 gün sonra silinir). Müşteri videoyu yeniden yüklemeli.' });
      await q(`UPDATE medya_isleri SET durum='bekliyor', deneme=0, hata=NULL, hata_kullanici=NULL, bitti_at=NULL WHERE id=$1`, [j.id]);
      if (j.tip === 'video')
        await q(`UPDATE ilanlar SET video_durum='isleniyor', video_hata=NULL WHERE id=$1 AND video_is_id=$2`, [j.ilan_id, j.id]);
      await auditAdmin('medya.tekrar', req.admin.id, { hedefTip: 'medya_is', hedefId: j.id, detay: { tip: j.tip, ilan_id: j.ilan_id } });
      motor('POST', '/uyandir');
      res.json({ ok: true });
    } catch (e) { fehler(res, e, 'tekrar'); }
  });

  app.get('/admin/api/medya/ayarlar', adminAuth, async (req, res) => {
    try {
      res.json({ ayarlar: await medyaAyar.ayarlar({ frisch: true }), standart: medyaAyar.STANDARD, sinirlar: medyaAyar.GRENZEN,
        duzenleyebilir: req.admin.rol === 'super_admin' });
    } catch (e) { fehler(res, e, 'ayarlar'); }
  });

  app.post('/admin/api/medya/ayarlar', adminAuth, nurSuper, async (req, res) => {
    try {
      const g = await medyaAyar.speichern(req.body || {}, req.admin.id);
      await auditAdmin('medya.ayarlar', req.admin.id, { hedefTip: 'medya_ayarlari', detay: g });
      res.json({ ok: true, ayarlar: await medyaAyar.ayarlar({ frisch: true }) });
    } catch (e) { fehler(res, e, 'ayar_kaydet'); }
  });
};
