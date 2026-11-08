// ════════════════════════════════════════════════════════════════════════════
//  Express-Admin: Kundenliste und Kundenakte (Auftragssammlung A, G, H, L; v1.25/v1.26).
//  Eingebunden aus server.js: require('./musteri')(app, { db, adminAuth, … }).
//
//  Kundennummer = users.musteri_no (KP-JJJJ-NNNNNNN) ist der Schluessel in der
//  Adresse (#/musteri/<no>/<reiter>). AKTİF = letztes Inserat (auch archiviert)
//  in den letzten 28 Tagen. Abzeichenfarbe: kurumsal gelb, k rot, e blau, sonst grau.
//  Inseratsbilder kommen direkt aus dem Inserat (ilan_fotograflar.url), beendete
//  Inserate aus dem Archiv (signierte Adresse, siehe server.js arsivZeile).
// ════════════════════════════════════════════════════════════════════════════
const { telefonNormalize, vknGecerli } = require('../api/src/lib/dogrula');

const ASKIDA = ['askida', 'banli', 'banlı', 'parked'];
const GEHEIM = ['password_hash', 'reset_token', 'reset_token_exp', 'email_dogrulama_token', 'telefon_otp', 'otp_expires_at', 'tc_no_hash', 'token_version'];
const OLAY_TUR = {
  giris: 'giris', giris_basarisiz: 'giris', kayit: 'hesap', ilan_olustur: 'ilan', ilan_duzenle: 'ilan', ilan_sil: 'ilan', ilan_kaldirildi: 'ilan',
  ilan_reddedildi: 'ilan', mesaj: 'mesaj', teklif: 'teklif', teklif_alindi: 'teklif', sikayet: 'sikayet', belge: 'belge',
  hesap_silme_talebi: 'hesap', hesap_silme_iptal: 'hesap', hesap_anonim: 'hesap', hesap_askiya: 'hesap', hesap_aktif: 'hesap',
};
const OLAY_AD = {
  giris: 'Giriş', giris_basarisiz: 'Başarısız giriş', kayit: 'Kayıt oldu', ilan_olustur: 'İlan oluşturdu', ilan_duzenle: 'İlan düzenledi',
  ilan_sil: 'İlanı sildi', ilan_kaldirildi: 'İlan kaldırıldı (admin)', ilan_reddedildi: 'İlan reddedildi', mesaj: 'Mesaj gönderdi',
  teklif: 'Teklif verdi', teklif_alindi: 'Teklif aldı', sikayet: 'Şikayet etti', belge: 'Belge', hesap_silme_talebi: 'Hesap silme talebi',
  hesap_silme_iptal: 'Silme talebi iptal', hesap_anonim: 'Hesap anonimleştirildi', hesap_askiya: 'Hesap askıya alındı', hesap_aktif: 'Askı kaldırıldı',
};
const hesapDurum = (u) => u.durum === 'silindi' ? 'silindi' : u.durum === 'silme_bekliyor' ? 'silme_bekliyor' : ASKIDA.includes(u.durum) ? 'askida' : 'aktif';
const temizle = (u) => { const o = { ...u }; GEHEIM.forEach((k) => delete o[k]); o.tc_kayitli = !!u.tc_no_hash; return o; };
const SIRALA = {
  no: 'musteri_no', ad: "lower(COALESCE(NULLIF(firma_adi,''), ad || ' ' || COALESCE(soyad,'')))", kayit: 'created_at',
  son_giris: 'son_giris', son_ilan: 'son_ilan', ilan: 'ilan_sayisi',
};

module.exports = function musteriRouten(app, { db, adminAuth, auditAdmin, clientIp, arsivZeile, olayLib }) {
  const q = (sql, p) => db.query(sql, p);
  const fehler = (res, e, wo) => { console.error(`[musteri/${wo}]`, e.message); res.status(500).json({ hata: 'İşlem yapılamadı' }); };
  async function kunde(no) {
    const { rows } = await q('SELECT * FROM users WHERE musteri_no=$1', [String(no || '').slice(0, 20)]);
    return rows[0] || null;
  }
  // Eine Route je Kunde: 404, wenn die Nummer unbekannt ist.
  const mitKunde = (fn) => async (req, res) => {
    try { const u = await kunde(req.params.no); if (!u) return res.status(404).json({ hata: 'Müşteri bulunamadı' }); await fn(req, res, u); }
    catch (e) { fehler(res, e, req.path.split('/').pop()); }
  };

  // ── LISTE (serverseitig: Suche, Filter, Sortierung, Seiten) ──────────────
  const LISTE_BASIS = `
    SELECT u.id, u.musteri_no, u.ad, u.soyad, u.email, u.phone, u.hesap_tipi, u.firma_adi, u.vkn, u.cinsiyet, u.durum, u.ban_sebebi,
           u.test_verisi, u.created_at, u.silinme_istegi, u.silindi_at, u.kurumsal_onaylandi, u.sehir, u.ilce,
           GREATEST((SELECT max(created_at) FROM ilanlar WHERE user_id=u.id), (SELECT max(ilan_created_at) FROM ilan_arsiv WHERE user_id=u.id)) AS son_ilan,
           (SELECT count(*) FROM ilanlar WHERE user_id=u.id)::int AS ilan_sayisi,
           COALESCE((SELECT max(created_at) FROM musteri_olaylari WHERE user_id=u.id AND olay='giris'),
                    (SELECT max(giris_tarihi) FROM kullanici_girisler WHERE user_id=u.id AND basarili IS NOT FALSE)) AS son_giris
      FROM users u`;
  app.get('/admin/api/musteriler', adminAuth, async (req, res) => {
    try {
      const w = [], p = [];
      const par = (v) => { p.push(v); return '$' + p.length; };
      const s = String(req.query.q || '').trim().slice(0, 100);
      if (s) {
        if (/^[0-9a-f:.]+$/i.test(s) && /[.:]/.test(s) && s.length >= 4) {
          const x = par(s + '%');
          w.push(`(id IN (SELECT user_id FROM musteri_olaylari WHERE ip LIKE ${x}) OR id IN (SELECT user_id FROM kullanici_girisler WHERE ip_adresi LIKE ${x}))`);
        } else {
          const l = par('%' + s + '%');
          const teile = [`musteri_no ILIKE ${l}`, `(ad || ' ' || COALESCE(soyad,'')) ILIKE ${l}`, `firma_adi ILIKE ${l}`, `email ILIKE ${l}`];
          const ziffern = s.replace(/\D/g, '');
          const tel = telefonNormalize(s);
          if (tel) teile.push(`phone = ${par(tel)}`);
          if (ziffern.length >= 4) { teile.push(`regexp_replace(COALESCE(phone,''),'\\D','','g') LIKE ${par('%' + ziffern + '%')}`); teile.push(`vkn LIKE ${par(ziffern + '%')}`); }
          w.push('(' + teile.join(' OR ') + ')');
        }
      }
      const tip = String(req.query.tip || '');
      if (tip === 'bireysel') w.push("COALESCE(hesap_tipi,'bireysel') <> 'kurumsal'");
      if (tip === 'kurumsal') w.push("hesap_tipi = 'kurumsal'");
      if (tip === 'kurumsal_onay') w.push("hesap_tipi = 'kurumsal' AND kurumsal_onaylandi IS NOT TRUE");
      const d = String(req.query.durum || '');
      if (d === 'aktif') w.push("durum='aktif' AND son_ilan > NOW() - interval '28 days'");
      if (d === 'aktif_degil') w.push("durum='aktif' AND (son_ilan IS NULL OR son_ilan <= NOW() - interval '28 days')");
      if (d === 'silme_bekliyor' || d === 'silindi') w.push(`durum = ${par(d)}`);
      if (d === 'askida') w.push(`durum = ANY(${par(ASKIDA)}::text[])`);
      const t = String(req.query.test ?? '');
      if (t === '0') w.push('test_verisi IS NOT TRUE');
      if (t === '1') w.push('test_verisi IS TRUE');
      if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.bas || '')) w.push(`created_at >= ${par(req.query.bas)}::date`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.bit || '')) w.push(`created_at < ${par(req.query.bit)}::date + 1`);
      const sira = SIRALA[req.query.sirala] || 'created_at';
      const yon = req.query.yon === 'asc' ? 'ASC' : 'DESC';
      const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 25));
      const sayfa = Math.max(1, parseInt(req.query.sayfa, 10) || 1);
      const { rows } = await q(`WITH x AS (${LISTE_BASIS})
        SELECT *, (son_ilan > NOW() - interval '28 days') AS aktif_28, count(*) OVER()::int AS toplam
          FROM x ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
         ORDER BY ${sira} ${yon} NULLS LAST, id DESC LIMIT ${limit} OFFSET ${(sayfa - 1) * limit}`, p);
      const testW = t === '0' ? 'WHERE test_verisi IS NOT TRUE' : t === '1' ? 'WHERE test_verisi IS TRUE' : '';
      const kpi = (await q(`WITH x AS (${LISTE_BASIS}) SELECT count(*)::int toplam,
          count(*) FILTER (WHERE durum='aktif' AND son_ilan > NOW()-interval '28 days')::int aktif,
          count(*) FILTER (WHERE durum='aktif' AND (son_ilan IS NULL OR son_ilan <= NOW()-interval '28 days'))::int aktif_degil,
          count(*) FILTER (WHERE durum='silme_bekliyor')::int silme_bekliyor, count(*) FILTER (WHERE durum='silindi')::int silindi,
          count(*) FILTER (WHERE durum = ANY($1::text[]))::int askida, count(*) FILTER (WHERE hesap_tipi='kurumsal')::int kurumsal,
          count(*) FILTER (WHERE hesap_tipi='kurumsal' AND kurumsal_onaylandi IS NOT TRUE)::int kurumsal_onay,
          count(*) FILTER (WHERE test_verisi)::int test FROM x ${testW}`, [ASKIDA])).rows[0];
      res.json({ satirlar: rows.map((r) => { const { toplam, ...o } = r; return { ...o, hesap_durum: hesapDurum(r) }; }),
        toplam: rows[0]?.toplam || 0, sayfa, limit, kpi });
    } catch (e) { fehler(res, e, 'liste'); }
  });

  // Alte Adresse #/kullanicilar/<id> -> Kundennummer
  app.get('/admin/api/musteri-no/:id(\\d+)', adminAuth, async (req, res) => {
    const r = (await q('SELECT musteri_no FROM users WHERE id=$1', [req.params.id])).rows[0];
    r ? res.json(r) : res.status(404).json({ hata: 'Müşteri bulunamadı' });
  });

  // ── AKTE: Kopf, Kennzahlen, Gewerbe, Verteilung ──────────────────────────
  app.get('/admin/api/musteriler/:no', adminAuth, mitKunde(async (req, res, u) => {
    const id = u.id;
    const one = async (sql, p = [id]) => (await q(sql, p)).rows[0];
    const [il, ar, son, mes, tek, sik, kyc, abo, kat, giris] = await Promise.all([
      one(`SELECT count(*)::int toplam, count(*) FILTER (WHERE ilan_durum='aktif')::int aktif, count(*) FILTER (WHERE ilan_durum='satildi')::int satildi,
             count(*) FILTER (WHERE ilan_durum='moderasyonda')::int moderasyonda, round(avg(ai_score))::int ai_ort FROM ilanlar WHERE user_id=$1`),
      one(`SELECT count(DISTINCT ilan_uuid)::int n FROM ilan_arsiv WHERE user_id=$1 AND grund <> 'reddedildi'`),
      one(`SELECT GREATEST((SELECT max(created_at) FROM ilanlar WHERE user_id=$1), (SELECT max(ilan_created_at) FROM ilan_arsiv WHERE user_id=$1)) AS son_ilan`),
      one(`SELECT count(*)::int n, count(*) FILTER (WHERE tehlikeli)::int riskli FROM mesajlar WHERE gonderen_id=$1`),
      one(`SELECT count(*) FILTER (WHERE alici_id=$1)::int verilen, count(*) FILTER (WHERE satici_id=$1)::int alinan,
             count(*) FILTER (WHERE status='kabul')::int kabul FROM teklifler WHERE alici_id=$1 OR satici_id=$1`),
      one(`SELECT count(*) FILTER (WHERE s.sikayet_eden=$1)::int eden,
             count(*) FILTER (WHERE s.ilan_uuid IN (SELECT uuid FROM ilanlar WHERE user_id=$1 UNION SELECT ilan_uuid FROM ilan_arsiv WHERE user_id=$1))::int hakkinda,
             count(*) FILTER (WHERE COALESCE(s.durum,'beklemede') IN ('beklemede','acik','yeni') AND s.ilan_uuid IN (SELECT uuid FROM ilanlar WHERE user_id=$1))::int acik
             FROM sikayet s`),
      one('SELECT id, durum, created_at FROM kyc_results WHERE user_id=$1 ORDER BY id DESC LIMIT 1'),
      one(`SELECT a.bitis, p.isim FROM abonelikler a JOIN paketler p ON p.id=a.paket_id WHERE a.kullanici_id=$1 AND a.durum='aktif' ORDER BY a.bitis DESC NULLS LAST LIMIT 1`).catch(() => null),
      q(`SELECT COALESCE(pp.ad, p.ad, k.ad, 'Kategori yok') AS k, count(*)::int n FROM (
            SELECT kategori_id FROM ilanlar WHERE user_id=$1
            UNION ALL SELECT kategori_id FROM ilan_arsiv a WHERE user_id=$1 AND grund <> 'reddedildi' AND NOT EXISTS (SELECT 1 FROM ilanlar WHERE uuid=a.ilan_uuid)
          ) x LEFT JOIN kategoriler k ON k.id=x.kategori_id LEFT JOIN kategoriler p ON p.id=k.parent_id LEFT JOIN kategoriler pp ON pp.id=p.parent_id
          GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [id]).then((r) => r.rows),
      one(`SELECT max(created_at) AS son, count(DISTINCT ip)::int ipler FROM musteri_olaylari WHERE user_id=$1 AND olay='giris'`),
    ]);
    const sonIlan = son.son_ilan ? new Date(son.son_ilan) : null;
    const gun = sonIlan ? Math.floor((Date.now() - sonIlan) / 864e5) : null;
    const silmeKalan = u.durum === 'silme_bekliyor' && u.silinme_istegi
      ? Math.max(0, 30 - Math.floor((Date.now() - new Date(u.silinme_istegi)) / 864e5)) : null;
    res.json({
      musteri: temizle(u), hesap_durum: hesapDurum(u), aktif: gun != null && gun <= 28, son_ilan: sonIlan, son_ilan_gun: gun,
      silme_kalan_gun: silmeKalan, vkn_gecerli: u.vkn ? vknGecerli(u.vkn) : null,
      kpi: { ilan: il, arsiv: ar.n, mesaj: mes, teklif: tek, sikayet: sik, giris },
      kyc: kyc || null, paket: abo || null, kategoriler: kat,
    });
  }));

  // ── İLANLAR (aktuelle direkt aus dem Inserat, beendete aus dem Archiv) ────
  async function ilanVerileri(id) {
    const { rows: il } = await q(`SELECT i.id, i.uuid, i.ilan_no, i.ilan_numarasi, i.baslik, i.fiyat, i.durum, i.ilan_durum, i.yayin_durum, i.sehir, i.ilce,
        i.ai_score, i.ai_karar, i.ai_not, i.created_at, i.updated_at, i.goruntulenme, i.sikayet_sayisi, i.video_url, k.ad AS kategori_ad, p.ad AS ust_kategori,
        (SELECT json_agg(url ORDER BY sira, id) FROM ilan_fotograflar WHERE ilan_id=i.id) AS fotolar,
        (SELECT v.deger FROM ilan_ozellik_degerleri v JOIN kategori_ozellik_tanimlari t ON t.id=v.tanim_id WHERE v.ilan_id=i.id AND t.alan_adi='marka' LIMIT 1) AS marka
      FROM ilanlar i LEFT JOIN kategoriler k ON k.id=i.kategori_id LEFT JOIN kategoriler p ON p.id=k.parent_id
      WHERE i.user_id=$1 ORDER BY i.created_at DESC`, [id]);
    const { rows: ar } = await q(`SELECT * FROM ilan_arsiv WHERE user_id=$1 ORDER BY created_at DESC`, [id]);
    return { il, ar };
  }
  app.get('/admin/api/musteriler/:no/ilanlar', adminAuth, mitKunde(async (req, res, u) => {
    const { il, ar } = await ilanVerileri(u.id);
    res.json({ ilanlar: il, arsiv: ar.map((a) => arsivZeile(req, a)) });
  }));

  // ── ZEITLEISTE ───────────────────────────────────────────────────────────
  app.get('/admin/api/musteriler/:no/zaman', adminAuth, mitKunde(async (req, res, u) => {
    const id = u.id;
    const { rows: ev } = await q('SELECT * FROM musteri_olaylari WHERE user_id=$1 ORDER BY created_at DESC LIMIT 600', [id]);
    const { il, ar } = await ilanVerileri(id);
    const ilanMap = new Map(il.map((x) => [String(x.uuid), x]));
    const arMap = new Map(); ar.forEach((a) => { if (!arMap.has(String(a.ilan_uuid))) arMap.set(String(a.ilan_uuid), arsivZeile(req, a)); });
    const ilanKurz = (uuid) => {
      const x = ilanMap.get(String(uuid));
      if (x) return { uuid: x.uuid, baslik: x.baslik, fiyat: x.fiyat, kategori: [x.ust_kategori, x.kategori_ad].filter(Boolean).join(' › '), durum: x.ilan_durum,
        marka: x.marka, zustand: x.durum, foto: (x.fotolar || [])[0] || null, ai: x.ai_score, arsiv: false };
      const a = arMap.get(String(uuid));
      if (a) return { uuid: a.ilan_uuid, baslik: a.baslik, fiyat: a.fiyat, kategori: a.kategori_ad, durum: a.grund, marka: a.marka, zustand: a.durum,
        foto: (a.bilder || [])[0]?.url || null, arsiv: true, arsiv_id: a.id };
      return null;
    };
    const mesajIds = ev.filter((e) => e.olay === 'mesaj' && /^\d+$/.test(e.hedef_id || '')).map((e) => +e.hedef_id);
    const mesajMap = new Map((await q(`SELECT m.id, m.metin, m.tehlikeli, m.tehlike_turu, i.baslik FROM mesajlar m JOIN konusmalar k ON k.id=m.konusma_id
        LEFT JOIN ilanlar i ON i.id=k.ilan_id WHERE m.id = ANY($1::int[])`, [mesajIds])).rows.map((m) => [String(m.id), m]));
    const teklifMap = new Map((await q(`SELECT t.id, t.teklif_fiyat, t.status, i.baslik, i.uuid FROM teklifler t LEFT JOIN ilanlar i ON i.id=t.ilan_id
        WHERE t.alici_id=$1 OR t.satici_id=$1`, [id])).rows.map((t) => [String(t.id), t]));
    const eintrag = (e) => {
      const o = { zaman: e.created_at, olay: e.olay, tur: OLAY_TUR[e.olay] || 'hesap', ad: OLAY_AD[e.olay] || e.olay, ip: e.ip, sehir: e.sehir, ulke: e.ulke,
        isp: e.isp, cihaz: e.cihaz, tarayici: e.tarayici, os: e.os, detay: e.detay || {} };
      if (o.tur === 'ilan' || o.tur === 'sikayet') o.ilan = ilanKurz(e.hedef_id);
      if (e.olay === 'mesaj') o.mesaj = mesajMap.get(String(e.hedef_id)) || null;
      if (e.olay === 'teklif') o.teklif = teklifMap.get(String(e.hedef_id)) || null;
      return o;
    };
    const liste = ev.map(eintrag);
    // Ergaenzungen ohne Ereigniszeile: aeltere Inserate, erhaltene Gebote, Kontovorgaenge aus audit_log
    const mitEreignis = new Set(ev.filter((e) => e.olay === 'ilan_olustur').map((e) => String(e.hedef_id)));
    for (const x of il) if (!mitEreignis.has(String(x.uuid)))
      liste.push({ zaman: x.created_at, olay: 'ilan_olustur', tur: 'ilan', ad: OLAY_AD.ilan_olustur, ilan: ilanKurz(x.uuid), detay: { kaynak: 'ilanlar' } });
    for (const t of teklifMap.values()) {
      const r = (await q('SELECT alici_id, satici_id, created_at FROM teklifler WHERE id=$1', [t.id])).rows[0];
      if (r && r.satici_id === id) liste.push({ zaman: r.created_at, olay: 'teklif_alindi', tur: 'teklif', ad: OLAY_AD.teklif_alindi, teklif: t, detay: {} });
    }
    const { rows: au } = await q(`SELECT olay, created_at, detay, ip_adresi FROM audit_log
        WHERE (user_id=$1 AND olay IN ('hesap.silme_iptal','hesap.anonimlestirildi'))
           OR (hedef_tip='user' AND hedef_id=$1 AND kaynak='admin' AND olay LIKE 'user.%') ORDER BY created_at DESC LIMIT 100`, [id]);
    const AU = { 'hesap.silme_iptal': 'hesap_silme_iptal', 'hesap.anonimlestirildi': 'hesap_anonim' };
    for (const a of au) {
      const olay = AU[a.olay] || (/askida|ban|park/.test(a.olay) ? 'hesap_askiya' : /aktif/.test(a.olay) ? 'hesap_aktif' : null);
      if (olay && !ev.some((e) => e.olay === olay && Math.abs(new Date(e.created_at) - new Date(a.created_at)) < 5000))
        liste.push({ zaman: a.created_at, olay, tur: 'hesap', ad: OLAY_AD[olay], ip: a.ip_adresi, detay: a.detay || {} });
    }
    liste.sort((a, b) => new Date(b.zaman) - new Date(a.zaman));
    res.json({ olaylar: liste });
  }));

  // ── MESAJLAR (alle Unterhaltungen, riskante markiert) ────────────────────
  app.get('/admin/api/musteriler/:no/mesajlar', adminAuth, mitKunde(async (req, res, u) => {
    const { rows } = await q(`SELECT k.id, k.created_at, i.baslik, i.uuid AS ilan_uuid, k.alici_id, k.satici_id,
        ua.musteri_no AS alici_no, ua.ad AS alici_ad, ua.soyad AS alici_soyad, ua.cinsiyet AS alici_cinsiyet, ua.hesap_tipi AS alici_tip,
        us.musteri_no AS satici_no, us.ad AS satici_ad, us.soyad AS satici_soyad, us.cinsiyet AS satici_cinsiyet, us.hesap_tipi AS satici_tip,
        (SELECT json_agg(json_build_object('id',m.id,'gonderen_id',m.gonderen_id,'metin',m.metin,'tehlikeli',m.tehlikeli,'tur',m.tehlike_turu,'zaman',m.created_at) ORDER BY m.id)
           FROM mesajlar m WHERE m.konusma_id=k.id) AS mesajlar
      FROM konusmalar k LEFT JOIN ilanlar i ON i.id=k.ilan_id JOIN users ua ON ua.id=k.alici_id JOIN users us ON us.id=k.satici_id
      WHERE k.alici_id=$1 OR k.satici_id=$1 ORDER BY k.created_at DESC LIMIT 100`, [u.id]);
    res.json({ konusmalar: rows });
  }));

  // ── TEKLİFLER ────────────────────────────────────────────────────────────
  app.get('/admin/api/musteriler/:no/teklifler', adminAuth, mitKunde(async (req, res, u) => {
    const { rows } = await q(`SELECT t.*, i.baslik, i.uuid AS ilan_uuid, i.fiyat AS ilan_fiyat,
        ua.musteri_no AS alici_no, ua.ad AS alici_ad, ua.soyad AS alici_soyad, us.musteri_no AS satici_no, us.ad AS satici_ad, us.soyad AS satici_soyad
      FROM teklifler t LEFT JOIN ilanlar i ON i.id=t.ilan_id JOIN users ua ON ua.id=t.alici_id JOIN users us ON us.id=t.satici_id
      WHERE t.alici_id=$1 OR t.satici_id=$1 ORDER BY t.created_at DESC`, [u.id]);
    res.json({ teklifler: rows.map((t) => ({ ...t, yon: t.alici_id === u.id ? 'verilen' : 'alinan' })) });
  }));

  // ── ŞİKAYETLER (vom Kunden und gegen seine Inserate) ─────────────────────
  app.get('/admin/api/musteriler/:no/sikayetler', adminAuth, mitKunde(async (req, res, u) => {
    const { rows } = await q(`SELECT s.*, COALESCE(i.baslik, a.baslik) AS ilan_baslik, i.user_id AS ilan_sahibi,
        e.musteri_no AS eden_no, e.ad AS eden_ad, e.soyad AS eden_soyad,
        CASE WHEN s.sikayet_eden=$1 THEN 'eden' ELSE 'hakkinda' END AS yon
      FROM sikayet s LEFT JOIN ilanlar i ON i.uuid=s.ilan_uuid
      LEFT JOIN LATERAL (SELECT baslik, user_id FROM ilan_arsiv WHERE ilan_uuid=s.ilan_uuid ORDER BY id DESC LIMIT 1) a ON true
      LEFT JOIN users e ON e.id=s.sikayet_eden
      WHERE s.sikayet_eden=$1 OR i.user_id=$1 OR a.user_id=$1 ORDER BY s.created_at DESC`, [u.id]);
    res.json({ sikayetler: rows });
  }));

  // ── IP & CİHAZ ───────────────────────────────────────────────────────────
  app.get('/admin/api/musteriler/:no/ip', adminAuth, mitKunde(async (req, res, u) => {
    const { rows } = await q(`SELECT id, olay, ip, sehir, ulke, isp, cihaz, tarayici, os, created_at, detay FROM musteri_olaylari
       WHERE user_id=$1 AND ip IS NOT NULL ORDER BY created_at DESC LIMIT 400`, [u.id]);
    // Risiko einfach und nachvollziehbar: Fehlversuch / riskante Nachricht / Ausland = yüksek,
    // erstmals gesehene IP = orta, sonst düşük.
    const erste = new Map();
    [...rows].reverse().forEach((r) => { if (!erste.has(r.ip)) erste.set(r.ip, r.id); });
    const satirlar = rows.map((r) => {
      const risk = r.olay === 'giris_basarisiz' || r.detay?.tehlikeli || (r.ulke && !['Türkiye', '—'].includes(r.ulke)) ? 'yuksek'
        : erste.get(r.ip) === r.id && rows.length > 1 ? 'orta' : 'dusuk';
      return { ...r, ad: OLAY_AD[r.olay] || r.olay, risk };
    });
    const { rows: ipler } = await q(`SELECT ip, max(sehir) sehir, max(ulke) ulke, max(isp) isp, count(*)::int n, min(created_at) ilk, max(created_at) son
       FROM musteri_olaylari WHERE user_id=$1 AND ip IS NOT NULL GROUP BY ip ORDER BY max(created_at) DESC`, [u.id]);
    const { rows: cihazlar } = await q(`SELECT cihaz, tarayici, os, count(*)::int n, max(created_at) son FROM musteri_olaylari
       WHERE user_id=$1 AND cihaz IS NOT NULL AND cihaz <> '—' GROUP BY 1,2,3 ORDER BY max(created_at) DESC`, [u.id]);
    // Andere Konten mit derselben IP (Hinweis auf Mehrfachkonten)
    const { rows: ortak } = await q(`SELECT DISTINCT m.ip, x.musteri_no, x.ad, x.soyad FROM musteri_olaylari m JOIN users x ON x.id=m.user_id
       WHERE m.user_id<>$1 AND m.ip IN (SELECT DISTINCT ip FROM musteri_olaylari WHERE user_id=$1 AND ip IS NOT NULL) AND m.ip NOT LIKE '127.%' LIMIT 30`, [u.id]);
    res.json({ satirlar, ipler, cihazlar, ortak });
  }));

  // ── BELGELER (Gewerbe-Unterlagen + KYC) ──────────────────────────────────
  app.get('/admin/api/musteriler/:no/belgeler', adminAuth, mitKunde(async (req, res, u) => {
    const [b, k, kd] = await Promise.all([
      q(`SELECT b.*, a.ad_soyad AS inceleyen FROM musteri_belgeleri b LEFT JOIN admin_users a ON a.id=b.inceleyen_admin WHERE b.user_id=$1 ORDER BY b.id`, [u.id]),
      q('SELECT id, durum, selfie_score, liveness_score, red_sebebi, created_at, updated_at FROM kyc_results WHERE user_id=$1 ORDER BY id DESC', [u.id]),
      q('SELECT id, status, admin_notu, created_at, (kimlik_foto_url IS NOT NULL) AS kimlik_var, (selfie_foto_url IS NOT NULL) AS selfie_var FROM kyc_dogrulama WHERE user_id=$1 ORDER BY id DESC', [u.id]),
    ]);
    res.json({ belgeler: b.rows, kyc: k.rows, kyc_dogrulama: kd.rows, kurumsal: u.hesap_tipi === 'kurumsal', kurumsal_onaylandi: !!u.kurumsal_onaylandi });
  }));
  app.post('/admin/api/musteriler/:no/belgeler/:id(\\d+)', adminAuth, mitKunde(async (req, res, u) => {
    const karar = req.body?.karar;
    if (!['onayli', 'reddedildi', 'bekliyor'].includes(karar)) return res.status(400).json({ hata: 'Geçersiz karar' });
    const sebep = String(req.body?.sebep || '').trim().slice(0, 500) || null;
    if (karar === 'reddedildi' && !sebep) return res.status(400).json({ hata: 'Red sebebi zorunludur' });
    const r = await q(`UPDATE musteri_belgeleri SET durum=$1, red_sebebi=$2, inceleyen_admin=$3, inceleme_at=NOW() WHERE id=$4 AND user_id=$5 RETURNING tur`,
      [karar, karar === 'reddedildi' ? sebep : null, req.admin.id, req.params.id, u.id]);
    if (!r.rows[0]) return res.status(404).json({ hata: 'Belge bulunamadı' });
    await auditAdmin('belge.' + karar, req.admin.id, { hedefTip: 'user', hedefId: u.id, detay: { belge_id: +req.params.id, tur: r.rows[0].tur, sebep } });
    res.json({ ok: true });
  }));

  // ── NOTLAR (intern, Kunde sieht sie nie) ─────────────────────────────────
  app.get('/admin/api/musteriler/:no/notlar', adminAuth, mitKunde(async (req, res, u) => {
    const { rows } = await q(`SELECT n.id, n.not_metni, n.olusturma_tarihi, a.ad_soyad, a.email FROM admin_kullanici_notlar n
       LEFT JOIN admin_users a ON a.id=n.admin_id WHERE n.kullanici_id=$1 ORDER BY n.olusturma_tarihi DESC`, [u.id]);
    res.json({ notlar: rows });
  }));
  app.post('/admin/api/musteriler/:no/notlar', adminAuth, mitKunde(async (req, res, u) => {
    const metin = String(req.body?.not || '').trim();
    if (!metin) return res.status(400).json({ hata: 'Not boş olamaz' });
    if (metin.length > 4000) return res.status(400).json({ hata: 'Not en fazla 4000 karakter olabilir' });
    await q('INSERT INTO admin_kullanici_notlar(kullanici_id,admin_id,not_metni,olusturma_tarihi) VALUES($1,$2,$3,NOW())', [u.id, req.admin.id, metin]);
    await auditAdmin('musteri.not', req.admin.id, { hedefTip: 'user', hedefId: u.id });
    res.json({ ok: true });
  }));

  // ── AKTIONEN ─────────────────────────────────────────────────────────────
  app.post('/admin/api/musteriler/:no/askiya-al', adminAuth, mitKunde(async (req, res, u) => {
    const sebep = String(req.body?.sebep || '').trim().slice(0, 500);
    if (!sebep) return res.status(400).json({ hata: 'Askıya alma sebebi zorunludur' });
    if (['silindi', 'silme_bekliyor'].includes(u.durum)) return res.status(409).json({ hata: 'Bu hesap silme sürecinde; askıya alınamaz' });
    await q("UPDATE users SET durum='askida', ban_sebebi=$1 WHERE id=$2", [sebep, u.id]);
    await auditAdmin('user.askida', req.admin.id, { hedefTip: 'user', hedefId: u.id, detay: { sebep } });
    await olayLib.yaz({ userId: u.id, olay: 'hesap_askiya', hedefTip: 'user', hedefId: u.id, ip: null, userAgent: '', detay: { sebep, admin_id: req.admin.id } });
    res.json({ ok: true });
  }));
  app.post('/admin/api/musteriler/:no/aktifle', adminAuth, mitKunde(async (req, res, u) => {
    if (!ASKIDA.includes(u.durum)) return res.status(409).json({ hata: 'Hesap askıda değil' });
    await q("UPDATE users SET durum='aktif', ban_sebebi=NULL WHERE id=$1", [u.id]);
    await auditAdmin('user.aktif', req.admin.id, { hedefTip: 'user', hedefId: u.id, detay: { onceki: u.durum, sebep: u.ban_sebebi } });
    await olayLib.yaz({ userId: u.id, olay: 'hesap_aktif', hedefTip: 'user', hedefId: u.id, ip: null, userAgent: '', detay: { admin_id: req.admin.id } });
    res.json({ ok: true });
  }));
  app.put('/admin/api/musteriler/:no/cinsiyet', adminAuth, mitKunde(async (req, res, u) => {
    const c = req.body?.cinsiyet;
    if (![null, 'k', 'e'].includes(c ?? null)) return res.status(400).json({ hata: 'Geçersiz değer' });
    await q('UPDATE users SET cinsiyet=$1 WHERE id=$2', [c ?? null, u.id]);
    await auditAdmin('musteri.cinsiyet', req.admin.id, { hedefTip: 'user', hedefId: u.id, detay: { cinsiyet: c ?? null } });
    res.json({ ok: true });
  }));

  // ── DIŞA AKTAR (JSON komplett, CSV = Zeitleiste) ─────────────────────────
  app.get('/admin/api/musteriler/:no/disa-aktar', adminAuth, mitKunde(async (req, res, u) => {
    await auditAdmin('musteri.disa_aktar', req.admin.id, { hedefTip: 'user', hedefId: u.id, detay: { bicim: req.query.bicim || 'json' } });
    const zaman = (await q('SELECT * FROM musteri_olaylari WHERE user_id=$1 ORDER BY created_at', [u.id])).rows;
    const dosya = `${u.musteri_no}-${new Date().toISOString().slice(0, 10)}`;
    if (req.query.bicim === 'csv') {
      const esc = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const kopf = ['zaman', 'olay', 'hedef_tip', 'hedef_id', 'ip', 'sehir', 'ulke', 'isp', 'cihaz', 'tarayici', 'os', 'detay'];
      const csv = '﻿' + [kopf.join(';'), ...zaman.map((r) => kopf.map((k) => esc(k === 'zaman' ? new Date(r.created_at).toISOString() : r[k])).join(';'))].join('\n');
      res.set('Content-Disposition', `attachment; filename="${dosya}.csv"`).type('text/csv; charset=utf-8').send(csv);
      return;
    }
    const [ilan, mesaj, teklif, sikayet, belge, notlar] = await Promise.all([
      ilanVerileri(u.id),
      q('SELECT m.* FROM mesajlar m JOIN konusmalar k ON k.id=m.konusma_id WHERE k.alici_id=$1 OR k.satici_id=$1 ORDER BY m.id', [u.id]).then((r) => r.rows),
      q('SELECT * FROM teklifler WHERE alici_id=$1 OR satici_id=$1 ORDER BY id', [u.id]).then((r) => r.rows),
      q('SELECT * FROM sikayet WHERE sikayet_eden=$1 OR ilan_uuid IN (SELECT uuid FROM ilanlar WHERE user_id=$1) ORDER BY id', [u.id]).then((r) => r.rows),
      q('SELECT * FROM musteri_belgeleri WHERE user_id=$1 ORDER BY id', [u.id]).then((r) => r.rows),
      q('SELECT * FROM admin_kullanici_notlar WHERE kullanici_id=$1 ORDER BY id', [u.id]).then((r) => r.rows),
    ]);
    res.set('Content-Disposition', `attachment; filename="${dosya}.json"`).json({
      olusturma: new Date().toISOString(), musteri: temizle(u), ilanlar: ilan.il,
      arsiv: ilan.ar.map((a) => ({ ...a, bilder: (a.bilder || []).map((b) => ({ url: b.url, arsivde: !!b.arsiv })) })),
      olaylar: zaman, mesajlar: mesaj, teklifler: teklif, sikayetler: sikayet, belgeler: belge, notlar,
    });
  }));
};

module.exports.hesapDurum = hesapDurum;
