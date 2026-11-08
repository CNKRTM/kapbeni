#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  Testkunden als dauerhafte Demo-Daten auf Staging (Auftragssammlung L).
//
//    node /opt/kapbeni/api/scripts/seed-testkunden.js          anlegen (idempotent)
//    node /opt/kapbeni/api/scripts/seed-testkunden.js --sil    wieder entfernen
//
//  - 8 Kunden unter @test.kapbeni.com, alle users.test_verisi=true. Ein Kunde, der
//    schon existiert (gleiche E-Mail), wird samt seinen Daten uebersprungen.
//  - --sil entfernt NUR diese 8 Konten (E-Mail aus der Liste UND test_verisi=true)
//    samt Inseraten, Bilddateien, Archiv, Ereignissen, Nachrichten, Geboten.
//  - Echte Daten und users.id=1 werden nie angefasst (Schranke in jeder Abfrage).
//  - Passwoerter zufaellig, nur in /root/kp-testkunden.txt (0600), nie auf stdout.
//    Fuer den E2E-Agenten genau EIN Konto: /root/kp-e2e-testkunde.txt (0600).
//  - Bilder: selbst erzeugte, neutrale Flaechen mit Text (sharp/SVG), durch die
//    normale Bildkette lib/bild.js (Skalieren, Wasserzeichen, WebP). Keine fremden Fotos.
//  - Kundennummern vergibt der DB-Trigger trg_musteri_no.
// ════════════════════════════════════════════════════════════════════════════
require('dotenv').config({ path: '/etc/kapbeni.env' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const { query, pool } = require('../src/db/pool');
const bild = require('../src/lib/bild');
const olay = require('../src/lib/olay');
const arsiv = require('../src/lib/ilanArsiv');
const { tcknGecerli, vknGecerli } = require('../src/lib/dogrula');

const DOMAIN = '@test.kapbeni.com';
const PW_DATEI = '/root/kp-testkunden.txt';
const E2E_DATEI = '/root/kp-e2e-testkunde.txt';
const UP = process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads';
const GUN = 864e5;
const simdi = Date.now();
const vor = (tage, std = 10, min = 0) => { const d = new Date(simdi - tage * GUN); d.setHours(std, min, 0, 0); return d; };

// Feste Zufallsquelle je Lauf genuegt; Werte muessen nur gueltig und erfunden sein.
const zufall = (n) => crypto.randomInt(0, n);
function tckn() {
  for (;;) {
    const d = [1 + zufall(9), ...Array.from({ length: 8 }, () => zufall(10))];
    const d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
    const t = [...d, (d10 + 10) % 10]; t.push(t.reduce((a, b) => a + b, 0) % 10);
    const s = t.join(''); if (tcknGecerli(s)) return s;
  }
}
function vkn() { for (;;) { const s = String(1 + zufall(9)) + String(zufall(1e9)).padStart(9, '0'); if (vknGecerli(s)) return s; } }

// Geraete (User-Agents) und IP-Bereiche tuerkischer Anbieter (GeoIP liefert die Stadt).
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  xiaomi: 'Mozilla/5.0 (Linux; Android 14; 2304FPN6DG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
};
const ISP = { '85.105': 'Türk Telekom', '88.247': 'Türk Telekom', '78.180': 'Türk Telekom', '176.33': 'Turkcell', '31.223': 'Superonline', '46.196': 'Vodafone', '95.10': 'Türk Telekom', '212.252': 'Turkcell Superonline' };
const ispVon = (ip) => ISP[ip.split('.').slice(0, 2).join('.')] || '—';

// Kategorien per Slug, Farbe der Platzhalterbilder je Hauptkategorie
const FARBE = { 1: '#475569', 2: '#1d4ed8', 3: '#0f766e', 4: '#a16207', 5: '#7c2d12', 8: '#be185d', 9: '#6d28d9', 11: '#15803d', 13: '#9a3412' };

// ── Die acht Testkunden ──────────────────────────────────────────────────
// letzte = Tage seit dem letzten Inserat (28-Tage-Regel), ilanlar: [Titel, Slug, Preis, Zustand, Tage, Status]
// Status: aktif | moderasyonda | silindi (archiviert) | admin (vom Admin entfernt) | reddedildi
const KUNDEN = [
  { key: 'ayse', email: 'ayse.yilmaz' + DOMAIN, ad: 'Ayşe', soyad: 'Yılmaz', cinsiyet: 'k', sehir: 'İstanbul', ilce: 'Kadıköy', tel: '+905550010001',
    kayit: 240, ip: ['85.105.44.21', '85.105.44.21', '176.33.10.8'], ua: ['iphone', 'win', 'iphone'], kyc: 'onaylandi', e2e: false,
    ilanlar: [['IKEA Poäng koltuk', 'mobilya', 1200, 'az_kullanilmis', 3, 'aktif'], ['Chicco bebek arabası', 'bebek-arac-gerecler', 2500, 'kullanilmis', 11, 'aktif'],
      ['Philips airfryer XL', 'elektrikli-ev-aletleri', 1650, 'yeni_gibi', 37, 'aktif'], ['Ahşap kitaplık', 'mobilya', 900, 'kullanilmis', 52, 'silindi'],
      ['Kışlık mont (M beden)', 'kadin-giyim', 450, 'yeni_gibi', 19, 'moderasyonda'], ['Bebek oyun halısı', 'oyuncak', 300, 'az_kullanilmis', 64, 'aktif']] },
  { key: 'mehmet', email: 'mehmet.demir' + DOMAIN, ad: 'Mehmet', soyad: 'Demir', cinsiyet: 'e', sehir: 'Mersin', ilce: 'Mezitli', tel: '+905550010002',
    kayit: 160, ip: ['31.223.4.90', '78.180.2.15', '31.223.4.90'], ua: ['xiaomi', 'xiaomi', 'android'], kyc: 'manuel_inceleme',
    ilanlar: [['iPhone 15 Pro 256GB sıfır', 'iphone-ios', 9000, 'sifir', 47, 'reddedildi'], ['Samsung Galaxy Tab S9', 'tablet', 3200, 'kullanilmis', 58, 'aktif'],
      ['PlayStation 5 + 2 kol', 'oyuncu', 14500, 'az_kullanilmis', 90, 'admin']] },
  { key: 'kaya', email: 'satis.kayaelektronik' + DOMAIN, ad: 'Serkan', soyad: 'Kaya', cinsiyet: 'e', sehir: 'Antalya', ilce: 'Muratpaşa', tel: '+905550010003',
    kurumsal: { firma_adi: 'Kaya Elektronik Tic. Ltd. Şti.', vergi_dairesi: 'Muratpaşa VD', sektor: 'Elektronik perakende', onay: true, adres: 'Şirinyalı Mah. 1500 Sk. No:12, Muratpaşa / Antalya' },
    kayit: 80, ip: ['88.247.12.3', '88.247.12.3', '46.196.77.10'], ua: ['edge', 'edge', 'iphone'],
    ilanlar: [['Lenovo ThinkPad T14 (yenilenmiş)', 'bilgisayar', 18900, 'yeni_gibi', 1, 'aktif'], ['Logitech MX Master 3S', 'bilgisayar', 2450, 'sifir', 1, 'aktif'],
      ['PS5 DualSense kol', 'oyuncu', 2100, 'sifir', 9, 'aktif'], ['Apple Watch SE 2', 'giyilebilir-teknoloji', 6800, 'sifir', 14, 'aktif'],
      ['Samsung 55" QLED TV', 'tv-goruntu-ses', 21500, 'sifir', 21, 'aktif'], ['Canon EOS 250D kit', 'fotograf-kamera', 17200, 'yeni_gibi', 26, 'aktif'],
      ['Xiaomi robot süpürge', 'elektrikli-ev-aletleri', 7400, 'sifir', 33, 'aktif'], ['iPad 10. nesil 64GB', 'tablet', 11900, 'sifir', 40, 'moderasyonda'],
      ['Arçelik mini buzdolabı', 'beyaz-esya', 5600, 'sifir', 45, 'silindi'], ['JBL Flip 6 hoparlör', 'tv-goruntu-ses', 3300, 'sifir', 60, 'aktif']] },
  { key: 'zeynep', email: 'zeynep.arslan' + DOMAIN, ad: 'Zeynep', soyad: 'Arslan', cinsiyet: 'k', sehir: 'Ankara', ilce: 'Çankaya', tel: '+905550010004',
    kayit: 200, ip: ['95.10.20.30', '95.10.20.30', '176.33.88.4'], ua: ['mac', 'mac', 'iphone'],
    ilanlar: [['Dağ bisikleti 27.5"', 'bisiklet', 6500, 'kullanilmis', 61, 'aktif'], ['Yoga matı ve blok seti', 'fitness', 350, 'yeni_gibi', 75, 'aktif']] },
  { key: 'emre', email: 'emre.celik' + DOMAIN, ad: 'Emre', soyad: 'Çelik', cinsiyet: 'e', sehir: 'İzmir', ilce: 'Karşıyaka', tel: '+905550010005',
    kayit: 120, ip: ['212.252.9.14', '212.252.9.14', '46.196.12.200'], ua: ['android', 'win', 'android'], silme: 12,
    ilanlar: [['Akustik gitar Yamaha F310', 'muzik-aletleri', 3900, 'az_kullanilmis', 16, 'aktif'], ['Harry Potter seti (7 kitap)', 'kitap', 750, 'kullanilmis', 22, 'aktif'],
      ['Matkap seti Bosch', 'el-aletleri', 2200, 'yeni_gibi', 30, 'aktif'], ['Kamp çadırı 4 kişilik', 'doga-sporlari', 1800, 'kullanilmis', 44, 'silindi']] },
  { key: 'deniz', email: 'info.denizoto' + DOMAIN, ad: 'Deniz', soyad: 'Aydemir', cinsiyet: null, sehir: 'Bursa', ilce: 'Nilüfer', tel: '+905550010006',
    kurumsal: { firma_adi: 'Deniz Oto Yedek Parça San. Tic. A.Ş.', vergi_dairesi: 'Nilüfer VD', sektor: 'Oto yedek parça', onay: false, adres: 'Organize Sanayi Bölgesi 4. Cad. No:8, Nilüfer / Bursa' },
    kayit: 70, ip: ['85.105.200.1', '85.105.200.1', '176.33.140.2'], ua: ['win', 'win', 'android'],
    ilanlar: [['Fren balatası seti (ön)', 'oto-yedek-parca', 1450, 'sifir', 35, 'aktif'], ['17" alüminyum jant takımı', 'jant-lastik', 12800, 'kullanilmis', 38, 'aktif'],
      ['Oto teyp Android 9"', 'ses-goruntu-sistemleri', 3600, 'sifir', 42, 'aktif'], ['Motosiklet kaskı LS2', 'kask', 2900, 'sifir', 49, 'moderasyonda'],
      ['Akü 72Ah', 'oto-yedek-parca', 3100, 'sifir', 55, 'silindi']] },
  { key: 'burak', email: 'burak.sahin' + DOMAIN, ad: 'Burak', soyad: 'Şahin', cinsiyet: 'e', sehir: 'Konya', ilce: 'Selçuklu', tel: '+905550010007',
    kayit: 100, ip: ['78.180.66.6', '31.223.200.9', '46.196.9.9'], ua: ['android', 'android', 'win'], askida: 'Tekrarlayan sahte ilan ve site dışı ödeme talebi (test verisi)',
    ilanlar: [['Rolex Submariner (replika değil)', 'hobi', 4500, 'sifir', 24, 'admin'], ['Garantili MacBook Pro M3', 'bilgisayar', 9500, 'sifir', 25, 'moderasyonda']] },
  { key: 'elif', email: 'elif.koc' + DOMAIN, ad: 'Elif', soyad: 'Koç', cinsiyet: 'k', sehir: 'Eskişehir', ilce: 'Tepebaşı', tel: '+905550010008',
    kayit: 50, ip: ['88.247.150.20', '88.247.150.20', '176.33.5.5'], ua: ['ipad', 'win', 'iphone'], e2e: true,
    ilanlar: [['Kahve makinesi DeLonghi', 'elektrikli-ev-aletleri', 4200, 'yeni_gibi', 10, 'aktif'], ['Masa lambası (retro)', 'aydinlatma', 380, 'kullanilmis', 18, 'aktif'],
      ['Saksı ve bahçe seti', 'bahce-dekorasyonu', 260, 'az_kullanilmis', 27, 'aktif']] },
];
const EMAILS = KUNDEN.map((k) => k.email);

async function platzhalterBild(titel, farbe, nr) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const zeilen = []; let z = '';
  for (const w of titel.split(' ')) { if ((z + ' ' + w).trim().length > 18) { zeilen.push(z.trim()); z = w; } else z += ' ' + w; }
  if (z.trim()) zeilen.push(z.trim());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <rect width="1200" height="900" fill="${farbe}"/><rect x="60" y="60" width="1080" height="780" rx="40" fill="#ffffff" fill-opacity="0.12"/>
    ${zeilen.slice(0, 3).map((t, i) => `<text x="600" y="${400 + i * 90 - (zeilen.length - 1) * 45}" font-family="DejaVu Sans, sans-serif" font-size="72" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(t)}</text>`).join('')}
    <text x="600" y="780" font-family="DejaVu Sans, sans-serif" font-size="34" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">TEST VERİSİ · Görsel ${nr}</text></svg>`;
  return bild.inseratsBildVerarbeiten(await sharp(Buffer.from(svg)).png().toBuffer());
}

async function kategorieId(slug) {
  const { rows } = await query('SELECT id, COALESCE(parent_id, ust_id) AS ust FROM kategoriler WHERE slug=$1', [slug]);
  if (!rows[0]) throw new Error('Kategorie fehlt: ' + slug);
  let id = rows[0].id, ust = rows[0].ust, haupt = id;
  while (ust) { haupt = ust; ust = (await query('SELECT COALESCE(parent_id, ust_id) AS ust FROM kategoriler WHERE id=$1', [ust])).rows[0]?.ust; }
  return { id, haupt };
}

async function markeSetzen(ilanId, katId) {
  const tan = await require('../src/lib/ozellik').tanimlarGetir(katId);
  const m = tan.find((t) => t.alan_adi === 'marka');
  if (!m || !m.secenekler?.length) return null;
  const wert = m.secenekler[zufall(Math.max(1, m.secenekler.length - 1))];   // ohne „Diğer“ am Ende
  await query('INSERT INTO ilan_ozellik_degerleri(ilan_id,tanim_id,deger) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [ilanId, m.id, wert]);
  return wert;
}

const ereignis = (userId, o, zaman, k, i, extra = {}) => {
  const ip = k.ip[i % k.ip.length], ua = UA[k.ua[i % k.ua.length]];
  return olay.geoBul(ip).then((g) => olay.yaz({ userId, olay: o, zaman, ip, userAgent: ua, geo: { ...g, isp: ispVon(ip) }, ...extra }));
};

async function anlegen() {
  const pw = new Map();
  try { for (const z of fs.readFileSync(PW_DATEI, 'utf8').split('\n')) { const [e, p] = z.split('\t'); if (e && p) pw.set(e, p); } } catch {}
  const angelegt = {};
  for (const k of KUNDEN) {
    const vorhanden = (await query('SELECT id FROM users WHERE lower(email)=$1', [k.email])).rows[0];
    if (vorhanden) { console.log(`= ${k.email} existiert (id ${vorhanden.id}), übersprungen`); angelegt[k.key] = { id: vorhanden.id, neu: false }; continue; }
    const pass = crypto.randomBytes(12).toString('base64url') + 'K7!';
    pw.set(k.email, pass);
    const kayit = vor(k.kayit, 9 + zufall(10), zufall(60));
    const kur = k.kurumsal;
    const vergi = kur ? vkn() : null;
    const { rows } = await query(
      `INSERT INTO users(email,phone,password_hash,ad,soyad,sehir,ilce,cinsiyet,test_verisi,created_at,hesap_tipi,firma_adi,vkn,vergi_dairesi,mersis_no,
         yetkili_kisi,sektor,ticari_adres,kurumsal_onaylandi,tc_no_hash,e_devlet_dogrulandi,email_dogrulandi,telefon_dogrulandi,phone_verified,
         iletisim_email,iletisim_sms,iletisim_whatsapp,bildirim_email,bildirim_sms,kyc_durumu)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,true,true,true,$21,$22,$23,$21,$22,$24) RETURNING id, musteri_no`,
      [k.email, k.tel, await bcrypt.hash(pass, 12), k.ad, k.soyad, k.sehir, k.ilce, k.cinsiyet, kayit,
       kur ? 'kurumsal' : 'bireysel', kur?.firma_adi || null, vergi, kur?.vergi_dairesi || null, kur ? '0' + vergi + '00015' : null,
       kur ? `${k.ad} ${k.soyad}` : null, kur?.sektor || null, kur?.adres || null, kur ? !!kur.onay : false,
       crypto.createHash('sha256').update(tckn() + (process.env.TC_SALT || 'kapbeni-test')).digest('hex'), k.kyc === 'onaylandi',
       zufall(2) === 1, zufall(3) === 1, zufall(2) === 1, k.kyc || null]);
    const u = rows[0]; angelegt[k.key] = { id: u.id, neu: true, no: u.musteri_no };
    await query("UPDATE users SET kullanici_no='SG-'||LPAD(id::TEXT,8,'0') WHERE id=$1", [u.id]);
    await ereignis(u.id, 'kayit', kayit, k, 0);
    console.log(`+ ${u.musteri_no} ${k.ad} ${k.soyad}${kur ? ' (' + kur.firma_adi + ')' : ''}`);

    // Anmeldungen ueber mehrere Wochen (verschiedene IPs/Geraete), dazu ein Fehlversuch
    const loginTage = [...new Set([k.kayit - 1, ...Array.from({ length: 7 }, () => zufall(Math.min(k.kayit, 70))), ...k.ilanlar.map((x) => x[4])])].filter((t) => t >= 0).sort((a, b) => b - a);
    for (const [n, t] of loginTage.entries()) {
      const z = vor(t, 8 + zufall(12), zufall(60));
      await ereignis(u.id, 'giris', z, k, n);
      await query('INSERT INTO kullanici_girisler(user_id,ip_adresi,sehir,ulke,tarayici,giris_tarihi,basarili) VALUES($1,$2,$3,$4,$5,$6,true)',
        [u.id, k.ip[n % k.ip.length], (await olay.geoBul(k.ip[n % k.ip.length])).sehir, 'Türkiye', UA[k.ua[n % k.ua.length]], z]);
    }
    await ereignis(u.id, 'giris_basarisiz', vor(Math.min(k.kayit, 20), 23, 41), k, 1, { detay: { sebep: 'sifre' } });

    // KYC / Unterlagen
    if (k.kyc) await query('INSERT INTO kyc_results(user_id,durum,selfie_score,liveness_score,created_at) VALUES($1,$2,$3,$4,$5)',
      [u.id, k.kyc, k.kyc === 'onaylandi' ? 0.94 : 0.61, k.kyc === 'onaylandi' ? 0.97 : 0.58, vor(k.kayit - 2)]);
    if (kur) {
      const B = [['vergi_levhasi', 'onayli', '2026 yılı vergi levhası (PDF, test yer tutucu)'], ['imza_sirkuleri', 'onayli', 'Noter onaylı (test yer tutucu)'],
        ['ticaret_sicil', 'onayli', 'TTSG ilanı (test yer tutucu)'], ['faaliyet_belgesi', kur.onay ? 'bekliyor' : 'bekliyor', 'Oda kaydı, son 6 ay (test yer tutucu)'],
        ['yetkili_kimlik', kur.onay ? 'onayli' : 'bekliyor', 'Yetkili kimlik ön/arka (test yer tutucu)'], ['iban', kur.onay ? 'onayli' : 'reddedildi', 'Şirket adına IBAN (test yer tutucu)']];
      for (const [tur, durum, aciklama] of B) {
        await query(`INSERT INTO musteri_belgeleri(user_id,tur,durum,aciklama,red_sebebi,gecerlilik,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [u.id, tur, durum, aciklama, durum === 'reddedildi' ? 'IBAN şahıs adına, şirket adına olmalı' : null,
           tur === 'faaliyet_belgesi' ? new Date(simdi + 27 * GUN) : null, vor(k.kayit - 1, 11)]);
        await ereignis(u.id, 'belge', vor(k.kayit - 1, 11, 5), k, 0, { hedefTip: 'belge', detay: { tur } });
      }
    }
  }
  return { angelegt, pw };
}

async function inserate(angelegt) {
  const ilanNach = {};
  for (const k of KUNDEN) {
    const a = angelegt[k.key]; if (!a?.neu) continue;
    const no = (await query('SELECT musteri_no FROM users WHERE id=$1', [a.id])).rows[0].musteri_no;
    ilanNach[k.key] = [];
    for (const [n, [titel, slug, fiyat, zustand, tage, status]] of k.ilanlar.entries()) {
      const { id: katId, haupt } = await kategorieId(slug);
      const z = vor(tage, 9 + zufall(11), zufall(60));
      const ilanDurum = status === 'moderasyonda' ? 'moderasyonda' : 'aktif';
      const skor = status === 'moderasyonda' || status === 'reddedildi' || status === 'admin' ? 18 + zufall(20) : 80 + zufall(18);
      const { rows } = await query(
        `INSERT INTO ilanlar(user_id,kategori_id,baslik,aciklama,fiyat,durum,ilan_durum,sehir,ilce,ai_score,ai_karar,ai_not,created_at,updated_at,goruntulenme)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14) RETURNING id, uuid`,
        [a.id, katId, titel, `${titel}. Test verisidir, gerçek bir ilan değildir. Temiz kullanıldı, elden teslim veya kargo mümkün.`, fiyat, zustand,
         ilanDurum, k.sehir, k.ilce, skor, skor >= 40 ? 'onaylandi' : 'reddedildi', skor >= 40 ? null : 'Fiyat piyasanın çok altında, şüpheli ifadeler (test)', z, zufall(400)]);
      const ilan = rows[0];
      const marka = await markeSetzen(ilan.id, katId);
      const anzahl = 1 + zufall(3);
      for (let i = 0; i < anzahl; i++) {
        const fname = `${ilan.uuid}_${i}.webp`;
        fs.writeFileSync(path.join(UP, 'ilanlar', fname), await platzhalterBild(titel, FARBE[haupt] || '#334155', i + 1));
        await query('INSERT INTO ilan_fotograflar(ilan_id,url,sira,ana_foto) VALUES($1,$2,$3,$4)', [ilan.id, `/uploads/ilanlar/${fname}`, i, i === 0]);
      }
      await ereignis(a.id, 'ilan_olustur', z, k, n, { hedefTip: 'ilan', hedefId: ilan.uuid, detay: { baslik: titel, fiyat, marka, ilan_durum: ilanDurum, ai_skor: skor } });
      if (n % 3 === 1) await ereignis(a.id, 'ilan_duzenle', new Date(z.getTime() + 2 * GUN), k, n + 1,
        { hedefTip: 'ilan', hedefId: ilan.uuid, detay: { baslik: titel, fiyat_eski: Math.round(fiyat * 1.1), fiyat_yeni: fiyat } });
      ilanNach[k.key].push({ ...ilan, titel, status, z, fiyat, no });
    }
  }
  return ilanNach;
}

async function kontakte(angelegt, ilanNach) {
  const id = (key) => angelegt[key]?.id;
  const k = (key) => KUNDEN.find((x) => x.key === key);
  const ilan = (key, n) => (ilanNach[key] || [])[n];
  // [Kaeufer, Verkaeufer, Inseratindex, Tage, [[von, Text, riskant?]]]
  const SOHBET = [
    ['zeynep', 'ayse', 0, 2, [['zeynep', 'Merhaba, koltuk hâlâ satılık mı?'], ['ayse', 'Evet, satılık. Kadıköy\'de elden teslim edebilirim.'], ['zeynep', 'Cumartesi uğrayabilir miyim?'], ['ayse', 'Olur, 14:00 uygun.']]],
    ['elif', 'kaya', 0, 1, [['elif', 'ThinkPad\'in pil sağlığı nedir?'], ['kaya', '%91, faturalı ve 6 ay garantili.'], ['elif', 'Kargo ücreti var mı?'], ['kaya', 'Kargo bizden.']]],
    ['ayse', 'mehmet', 1, 55, [['ayse', 'Tablet için 2.800 olur mu?'], ['mehmet', 'Kapora olarak 500 TL\'yi şu IBAN\'a gönder, sonra konuşuruz: TR00 0000 0000 0000 0000 0000 00', 'pesin_odeme'], ['mehmet', 'WhatsApp tan yaz 0555 000 00 00, burada cevap vermiyorum', 'iletisim_yonlendirme']]],
    ['emre', 'deniz', 0, 33, [['emre', 'Balata Corolla 2018\'e uyar mı?'], ['deniz', 'Uyar, şasi numarası ile teyit edebiliriz.']]],
    ['zeynep', 'burak', 1, 24, [['zeynep', 'MacBook neden bu kadar ucuz?'], ['burak', 'Acil satıyorum, bugün ödeme yaparsan kargolarım, link gönderiyorum: odeme-kapbeni-guvenli.example', 'sahte_odeme']]],
  ];
  for (const [alici, satici, n, tage, mesajlar] of SOHBET) {
    const il = ilan(satici, n); if (!il || !id(alici) || !id(satici)) continue;
    const { rows } = await query('INSERT INTO konusmalar(ilan_id,alici_id,satici_id,created_at) VALUES($1,$2,$3,$4) RETURNING id', [il.id, id(alici), id(satici), vor(tage, 10)]);
    for (const [m, [von, text, risk]] of mesajlar.entries()) {
      const z = vor(tage, 10 + m, 5 + m * 7);
      const r = await query('INSERT INTO mesajlar(konusma_id,gonderen_id,metin,tehlikeli,tehlike_turu,okundu,created_at) VALUES($1,$2,$3,$4,$5,true,$6) RETURNING id',
        [rows[0].id, id(von), text, !!risk, risk || null, z]);
      await ereignis(id(von), 'mesaj', z, k(von), m, { hedefTip: 'mesaj', hedefId: r.rows[0].id, detay: { konusma_id: rows[0].id, tehlikeli: !!risk, tur: risk || null } });
    }
  }
  // Gebote [Kaeufer, Verkaeufer, Inserat, Betrag, Status, Tage]
  const TEKLIF = [['zeynep', 'ayse', 0, 1100, 'bekliyor', 2], ['elif', 'kaya', 0, 17500, 'reddedildi', 1], ['ayse', 'mehmet', 1, 2800, 'bekliyor', 55],
    ['emre', 'kaya', 4, 20000, 'kabul', 18], ['elif', 'ayse', 1, 2300, 'kabul', 9], ['mehmet', 'emre', 0, 3500, 'suresi_doldu', 14]];
  for (const [alici, satici, n, betrag, status, tage] of TEKLIF) {
    const il = ilan(satici, n); if (!il || !id(alici)) continue;
    const z = vor(tage, 15);
    const r = await query('INSERT INTO teklifler(ilan_id,alici_id,satici_id,teklif_fiyat,status,mesaj,created_at,guncellendi_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id',
      [il.id, id(alici), id(satici), betrag, status, 'Test teklifi', z]);
    await ereignis(id(alici), 'teklif', z, k(alici), 1, { hedefTip: 'teklif', hedefId: r.rows[0].id, detay: { ilan: il.uuid, fiyat: betrag } });
  }
  // Beschwerden [Melder, Verkaeufer, Inserat, Typ, Text, Status, Tage]
  const SIKAYET = [['ayse', 'mehmet', 1, 'dolandiricilik', 'Satıcı IBAN\'a kapora istiyor (test).', 'beklemede', 54],
    ['zeynep', 'burak', 1, 'sahte_ilan', 'Fiyat gerçek dışı, link ile ödeme istiyor (test).', 'beklemede', 23],
    ['elif', 'burak', 1, 'dolandiricilik', 'Site dışı ödeme (test).', 'incelendi', 22], ['emre', 'ayse', 2, 'yanlis_kategori', 'Kategori hatalı olabilir (test).', 'kapatildi', 30]];
  for (const [melder, satici, n, tip, text, durum, tage] of SIKAYET) {
    const il = ilan(satici, n); if (!il || !id(melder)) continue;
    const z = vor(tage, 20);
    await query('INSERT INTO sikayet(ilan_uuid,sikayet_eden,sikayet_tipi,aciklama,durum,created_at) VALUES($1,$2,$3,$4,$5,$6)', [il.uuid, id(melder), tip, text, durum, z]);
    await query('UPDATE ilanlar SET sikayet_sayisi=COALESCE(sikayet_sayisi,0)+1 WHERE id=$1', [il.id]);
    await ereignis(id(melder), 'sikayet', z, k(melder), 2, { hedefTip: 'ilan', hedefId: il.uuid, detay: { sikayet_tipi: tip } });
  }
}

async function endzustaende(angelegt, ilanNach) {
  const adm = (await query("SELECT id FROM admin_users WHERE email='ui-test-admin@test.kapbeni.com' AND test_verisi=true")).rows[0]?.id || null;
  for (const k of KUNDEN) {
    const a = angelegt[k.key]; if (!a?.neu) continue;
    for (const il of ilanNach[k.key] || []) {
      const ende = new Date(il.z.getTime() + (3 + zufall(5)) * GUN);
      if (il.status === 'silindi' || il.status === 'admin') {
        const r = await arsiv.ilanSilVeArsivle({ uuid: il.uuid, grund: il.status === 'admin' ? 'admin_kaldirdi' : 'silindi',
          grundDetay: il.status === 'admin' ? 'Yanıltıcı ilan / kural ihlali (test verisi)' : null, kaynak: il.status === 'admin' ? 'admin' : 'kullanici',
          adminId: il.status === 'admin' ? adm : null, ip: k.ip[0], audit: { kaynak: 'seed', userId: a.id } });
        if (r.ok) {
          await query('UPDATE ilan_arsiv SET created_at=$1 WHERE id=$2', [ende, r.arsiv_id]);
          await ereignis(a.id, il.status === 'admin' ? 'ilan_kaldirildi' : 'ilan_sil', ende, k, 0, { hedefTip: 'ilan', hedefId: il.uuid, detay: { arsiv_id: r.arsiv_id },
            ...(il.status === 'admin' ? { ip: null, userAgent: '', geo: { sehir: '—', ulke: '—', isp: '—' } } : {}) });
        }
      } else if (il.status === 'reddedildi') {
        await query("UPDATE ilanlar SET ilan_durum='reddedildi', ai_not='İlan kurallarına aykırı fiyat ve ifade (test)' WHERE id=$1", [il.id]);
        const r = await arsiv.ilanKopieArsivle(il.id, { grund: 'reddedildi', grundDetay: 'İlan kurallarına aykırı (test)', kaynak: 'admin', adminId: adm });
        if (r) await query('UPDATE ilan_arsiv SET created_at=$1 WHERE id=$2', [ende, r.arsiv_id]);
        await ereignis(a.id, 'ilan_reddedildi', ende, k, 0, { hedefTip: 'ilan', hedefId: il.uuid, ip: null, userAgent: '', geo: { sehir: '—', ulke: '—', isp: '—' } });
      } else if (il.status === 'aktif') {
        try { await require('../src/lib/meiliSync').syncListing(il.uuid); } catch {}
      }
    }
    if (k.silme) {
      const t = vor(k.silme, 21, 12);
      await query("UPDATE ilanlar SET silme_oncesi_durum=ilan_durum, ilan_durum='pasif' WHERE user_id=$1 AND ilan_durum IN ('aktif','moderasyonda')", [a.id]);
      for (const il of ilanNach[k.key] || []) { try { await require('../src/lib/meiliSync').deleteListing(il.uuid); } catch {} }
      await query("UPDATE users SET durum='silme_bekliyor', silinme_istegi=$2 WHERE id=$1 AND test_verisi", [a.id, t]);
      await query(`INSERT INTO audit_log(olay,kaynak,user_id,hedef_tip,hedef_id,detay,created_at) VALUES('hesap.silme_talebi','api',$1,'user',$1,$2,$3)`,
        [a.id, JSON.stringify({ silinecek_tarih: new Date(t.getTime() + 30 * GUN).toISOString(), test_verisi: true }), t]);
      await ereignis(a.id, 'hesap_silme_talebi', t, k, 0, { hedefTip: 'user', hedefId: a.id });
    }
    if (k.askida) {
      await query("UPDATE users SET durum='askida', ban_sebebi=$2 WHERE id=$1 AND test_verisi", [a.id, k.askida]);
      await query(`INSERT INTO audit_log(olay,kaynak,admin_id,hedef_tip,hedef_id,detay,created_at) VALUES('user.askida','admin',$1,'user',$2,$3,$4)`,
        [adm, a.id, JSON.stringify({ sebep: k.askida }), vor(20, 9)]);
    }
  }
  // Interne Notizen (Test-Admin)
  const NOT = [['ayse', 'Sorunsuz satıcı, iade talebi yok. (test)', 30], ['mehmet', 'Riskli mesaj sonrası ilan reddedildi, KYC manuel incelemede. (test)', 46],
    ['kaya', 'Kurumsal başvuru onaylandı; faaliyet belgesi yenilenecek. (test)', 78], ['burak', 'Hesap askıya alındı, şikayetler doğrulandı. (test)', 20]];
  for (const [key, text, tage] of NOT) {
    if (!angelegt[key]?.neu) continue;
    await query('INSERT INTO admin_kullanici_notlar(kullanici_id,admin_id,not_metni,olusturma_tarihi) VALUES($1,$2,$3,$4)', [angelegt[key].id, adm, text, vor(tage, 11)]);
  }
}

function passwortDateien(pw) {
  const zeilen = EMAILS.filter((e) => pw.has(e)).map((e) => `${e}\t${pw.get(e)}`);
  fs.writeFileSync(PW_DATEI, '# Kapbeni Testkunden (Staging, test_verisi=true) — E-Mail<TAB>Passwort\n' + zeilen.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(PW_DATEI, 0o600);
  const e2e = KUNDEN.find((k) => k.e2e);
  if (pw.has(e2e.email)) {
    fs.writeFileSync(E2E_DATEI, `${e2e.email}\t${pw.get(e2e.email)}\n`, { mode: 0o600 });
    fs.chmodSync(E2E_DATEI, 0o600);
  }
}

async function sil() {
  const { rows } = await query('SELECT id, musteri_no, email FROM users WHERE lower(email) = ANY($1::text[]) AND test_verisi=true AND id<>1', [EMAILS]);
  if (!rows.length) { console.log('Keine Testkunden gefunden.'); return; }
  const ids = rows.map((r) => r.id);
  const ilanlar = (await query('SELECT id, uuid FROM ilanlar WHERE user_id = ANY($1::int[])', [ids])).rows;
  for (const i of ilanlar) {
    for (const f of fs.readdirSync(path.join(UP, 'ilanlar')).filter((n) => n.startsWith(i.uuid + '_'))) fs.unlinkSync(path.join(UP, 'ilanlar', f));
    try { await require('../src/lib/meiliSync').deleteListing(i.uuid); } catch {}
  }
  // Archiv-Ordner (auch von bereits geloeschten Inseraten)
  for (const r of rows) if (/^KP-\d{4}-\d{7}$/.test(r.musteri_no || '')) fs.rmSync(path.join(arsiv.ARSIV(), r.musteri_no), { recursive: true, force: true });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const ilanIds = ilanlar.map((i) => i.id);
    const uuids = ilanlar.map((i) => i.uuid);
    await c.query('DELETE FROM sikayet WHERE sikayet_eden = ANY($1::int[]) OR ilan_uuid = ANY($2::uuid[])', [ids, uuids]);
    await c.query('DELETE FROM teklifler WHERE alici_id = ANY($1::int[]) OR satici_id = ANY($1::int[])', [ids]);
    await c.query('DELETE FROM mesajlar WHERE konusma_id IN (SELECT id FROM konusmalar WHERE alici_id = ANY($1::int[]) OR satici_id = ANY($1::int[])) OR gonderen_id = ANY($1::int[])', [ids]);
    await c.query('DELETE FROM konusmalar WHERE alici_id = ANY($1::int[]) OR satici_id = ANY($1::int[])', [ids]);
    for (const t of ['odemeler', 'payments', 'islemler', 'degerlendirmeler', 'ilan_sikayetler', 'ilan_vitaminler', 'support_tickets'])
      await c.query(`UPDATE ${t} SET ilan_id=NULL WHERE ilan_id = ANY($1::int[])`, [ilanIds]);
    await c.query('DELETE FROM ilanlar WHERE user_id = ANY($1::int[])', [ids]);
    await c.query('DELETE FROM admin_kullanici_notlar WHERE kullanici_id = ANY($1::int[])', [ids]);
    await c.query('DELETE FROM risk_bayraklari WHERE kullanici_id = ANY($1::int[])', [ids]);
    await c.query('DELETE FROM kullanici_uyarilar WHERE kullanici_id = ANY($1::int[])', [ids]);
    await c.query("DELETE FROM audit_log WHERE user_id = ANY($1::int[]) OR (hedef_tip='user' AND hedef_id = ANY($1::int[]))", [ids]);
    await c.query('DELETE FROM users WHERE id = ANY($1::int[]) AND test_verisi=true AND id<>1', [ids]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  try { fs.unlinkSync(PW_DATEI); } catch {}
  try { fs.unlinkSync(E2E_DATEI); } catch {}
  console.log(`Entfernt: ${rows.length} Testkunden, ${ilanlar.length} Inserate (samt Dateien, Archiv, Ereignissen).`);
}

(async () => {
  try {
    if (process.argv.includes('--sil')) await sil();
    else {
      const { angelegt, pw } = await anlegen();
      const ilanNach = await inserate(angelegt);
      await kontakte(angelegt, ilanNach);
      await endzustaende(angelegt, ilanNach);
      passwortDateien(pw);
      const n = Object.values(angelegt).filter((a) => a.neu).length;
      console.log(`Fertig: ${n} neu angelegt. Passwörter: ${PW_DATEI} (0600), E2E-Konto: ${E2E_DATEI} (0600).`);
    }
  } catch (e) { console.error('FEHLER:', e.message); process.exitCode = 1; }
  finally { await pool.end().catch(() => {}); }
})();
