// ════════════════════════════════════════════════════════════════════════════
//  Entegrasyonlar — gemeinsame Konfiguration aller externen Dienste.
//  Aufbau nach Cankartım 04-sistem (lib/integrations/unified-config.ts,
//  readiness.ts, api/admin/system/integrations/test/route.ts).
//
//  - Tabelle entegrasyon_ayarlari (Migration 20261108_06): je Anbieter eine
//    Zeile, Zugangsdaten als AES-256-GCM-Umschlag {v,iv,tag,ct} in credentials.
//  - Schluessel: INTEGRATION_ENCRYPTION_KEY (64 Hex-Zeichen) aus /etc/kapbeni.env.
//  - Lesereihenfolge je Feld: DB -> .env -> Standard; die Herkunft wird mitgeliefert.
//  - Geheime Werte verlassen den Server nur maskiert (••••1234). Kommt eine
//    Maske oder ein leerer Wert zurueck, bleibt der gespeicherte Wert stehen.
//  Benutzt von admin/server.js (Maske, Test) und der API (Turnstile, Mailer,
//  Google, Meili, Nominatim, Claude-Modell).
// ════════════════════════════════════════════════════════════════════════════
require('dotenv').config({ path: '/etc/kapbeni.env' });
const crypto = require('crypto');
const { Pool } = require('pg');

let _pool = null;
const pool = () => (_pool ||= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }));

const ORTAM = process.env.KAPBENI_ORTAM === 'prod' ? 'prod' : 'staging';
const MASKE = '••••';

// Offizielle Cloudflare-Testschluessel (bestehen immer) — https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_TEST = { siteKey: '1x00000000000000000000AA', secretKey: '1x0000000000000000000000000000000AA' };

// ── Anbieter-Definitionen ───────────────────────────────────────────────────
// alan: key, label, secret, zorunlu (Pflicht fuer „Hazır“), env (Rueckfall),
// varsayilan (Standard), envSadece (nur .env, in der Maske nicht editierbar),
// tip ('text'|'textarea'|'select'), secenekler (bei select).
const SAGLAYICILAR = [
  { key: 'claude', ad: 'Claude (Anthropic)', aciklama: 'KI-Moderation, açıklama önerisi, mesaj kontrolü', kategori: 'yapay_zeka', ikon: '🤖',
    modlar: ['disabled', 'live'], varsayilanMod: 'live',
    alanlar: [
      { key: 'apiKey', label: 'API Key (ANTHROPIC_API_KEY, .env)', secret: true, zorunlu: true, env: 'ANTHROPIC_API_KEY', envSadece: true },
      { key: 'model', label: 'Model', tip: 'select', dinamik: 'claude-modeller', zorunlu: true, env: 'KAPBENI_MOD_MODEL', varsayilan: 'claude-haiku-5-5' },
    ] },
  { key: 'iyzico', ad: 'iyzico Ödeme', aciklama: 'Paket ve doping ödemeleri (henüz ödeme akışı yok)', kategori: 'odeme', ikon: '💳',
    modlar: ['disabled', 'test', 'live'], varsayilanMod: 'test',
    alanlar: [
      { key: 'apiKey', label: 'API Key', secret: true, zorunlu: true, env: 'IYZICO_API_KEY' },
      { key: 'secretKey', label: 'Secret Key', secret: true, zorunlu: true, env: 'IYZICO_SECRET_KEY' },
      { key: 'merchantId', label: 'Merchant ID' },
      { key: 'baseUrl', label: 'Base URL (Live)', varsayilan: 'https://api.iyzipay.com' },
      { key: 'sandboxUrl', label: 'Sandbox URL (Test)', varsayilan: 'https://sandbox-api.iyzipay.com' },
    ] },
  { key: 'smtp', ad: 'SMTP E-Posta', aciklama: 'Sistem e-postaları (şifre sıfırlama, bildirimler)', kategori: 'eposta', ikon: '✉️',
    modlar: ['disabled', 'live'], varsayilanMod: 'live',
    alanlar: [
      { key: 'host', label: 'SMTP Host', zorunlu: true, env: 'SMTP_HOST', placeholder: 'smtp.example.com' },
      { key: 'port', label: 'SMTP Port', env: 'SMTP_PORT', varsayilan: '587' },
      { key: 'user', label: 'Kullanıcı', zorunlu: true, env: 'SMTP_USER' },
      { key: 'pass', label: 'Şifre', secret: true, zorunlu: true, env: 'SMTP_PASS' },
      { key: 'from', label: 'Gönderen (From)', env: 'SMTP_FROM', placeholder: 'noreply@kapbeni.com' },
    ] },
  { key: 'resend', ad: 'Resend E-Posta', aciklama: 'Resend API ile e-posta (doluysa SMTP yerine öncelikli)', kategori: 'eposta', ikon: '📨',
    modlar: ['disabled', 'live'], varsayilanMod: 'disabled',
    alanlar: [
      { key: 'apiKey', label: 'API Key', secret: true, zorunlu: true, env: 'RESEND_API_KEY' },
      { key: 'from', label: 'Gönderen (From)', zorunlu: true, env: 'RESEND_FROM', placeholder: 'Kap Beni <noreply@kapbeni.com>' },
      { key: 'replyTo', label: 'Reply-To', env: 'RESEND_REPLY_TO', placeholder: 'destek@kapbeni.com' },
    ] },
  { key: 'turnstile', ad: 'Cloudflare Turnstile', aciklama: 'Bot koruması: admin girişi, şifre sıfırlama, müşteri giriş/kayıt', kategori: 'guvenlik', ikon: '🛡️',
    modlar: ['disabled', 'test', 'live'], varsayilanMod: 'test',
    alanlar: [
      { key: 'siteKey', label: 'Site Key', zorunlu: true, env: 'TURNSTILE_SITE_KEY' },
      { key: 'secretKey', label: 'Secret Key', secret: true, zorunlu: true, env: 'TURNSTILE_SECRET_KEY' },
    ] },
  { key: 'google_musteri', ad: 'Google ile Giriş (Müşteri)', aciklama: 'Müşteri girişi ve kaydı için Google OAuth', kategori: 'giris', ikon: '🔑',
    modlar: ['disabled', 'live'], varsayilanMod: 'disabled',
    alanlar: [
      { key: 'clientId', label: 'Client ID', zorunlu: true, placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'Client Secret', secret: true, zorunlu: true },
      { key: 'redirectUris', label: 'İzinli Redirect URI’lar (satır başına bir)', tip: 'textarea', zorunlu: true, placeholder: 'https://kapbeni.com/api/auth/google/callback' },
    ] },
  { key: 'google_admin', ad: 'Google ile Giriş (Admin)', aciklama: 'Yönetici girişi için Google OAuth, yalnız izinli e-postalar', kategori: 'giris', ikon: '🔐',
    modlar: ['disabled', 'live'], varsayilanMod: 'disabled',
    alanlar: [
      { key: 'clientId', label: 'Client ID', zorunlu: true, placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'clientSecret', label: 'Client Secret', secret: true, zorunlu: true },
      { key: 'redirectUris', label: 'İzinli Redirect URI’lar (satır başına bir)', tip: 'textarea', zorunlu: true, placeholder: 'https://kapbeni.com/kapbeniadmin/admin/api/google/callback' },
      { key: 'izinliler', label: 'İzinli e-postalar / alan adları (@kapbeni.com)', tip: 'textarea', zorunlu: true, placeholder: 'ad@kapbeni.com\n@compendus.com.tr' },
    ] },
  { key: 'netgsm', ad: 'NetGSM SMS', aciklama: 'SMS doğrulama ve bildirim (hazırlanıyor)', kategori: 'sms', ikon: '📱', hazirlik: true,
    modlar: ['disabled', 'test', 'live'], varsayilanMod: 'disabled',
    alanlar: [
      { key: 'usercode', label: 'Kullanıcı Kodu', zorunlu: true },
      { key: 'password', label: 'Şifre', secret: true, zorunlu: true },
      { key: 'msgheader', label: 'Mesaj Başlığı', zorunlu: true, placeholder: 'KAPBENI' },
    ] },
  { key: 'r2', ad: 'Cloudflare R2', aciklama: 'Bulut depolama (hazırlanıyor, şu an yerel disk)', kategori: 'depolama', ikon: '☁️', hazirlik: true,
    modlar: ['disabled', 'live'], varsayilanMod: 'disabled',
    alanlar: [
      { key: 'accountId', label: 'Account ID', zorunlu: true, env: 'R2_ACCOUNT_ID' },
      { key: 'accessKeyId', label: 'Access Key ID', secret: true, zorunlu: true, env: 'R2_ACCESS_KEY_ID' },
      { key: 'secretAccessKey', label: 'Secret Access Key', secret: true, zorunlu: true, env: 'R2_SECRET_ACCESS_KEY' },
      { key: 'bucket', label: 'Bucket', zorunlu: true, env: 'R2_BUCKET' },
      { key: 'publicUrl', label: 'Public URL', env: 'R2_PUBLIC_URL' },
    ] },
  { key: 'meilisearch', ad: 'Meilisearch', aciklama: 'İlan arama motoru', kategori: 'arama', ikon: '🔎',
    modlar: ['disabled', 'live'], varsayilanMod: 'live',
    alanlar: [
      { key: 'host', label: 'Host', zorunlu: true, env: 'MEILI_HOST', varsayilan: 'http://127.0.0.1:7700' },
      { key: 'apiKey', label: 'Master/API Key', secret: true, zorunlu: true, env: 'MEILI_MASTER_KEY' },
    ] },
  { key: 'nominatim', ad: 'Nominatim (OSM)', aciklama: '“Konumu Kullan”: koordinattan il/ilçe', kategori: 'harita', ikon: '🗺️',
    modlar: ['disabled', 'live'], varsayilanMod: 'live',
    alanlar: [
      { key: 'userAgent', label: 'User-Agent', zorunlu: true, varsayilan: 'KapBeni/1.0 (+https://kapbeni.com; destek@kapbeni.com)' },
      { key: 'email', label: 'İletişim e-postası', varsayilan: 'destek@kapbeni.com' },
    ] },
];
const tanim = (key) => SAGLAYICILAR.find((s) => s.key === key);

// ── Verschluesselung (AES-256-GCM) ──────────────────────────────────────────
function anahtar() {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('INTEGRATION_ENCRYPTION_KEY fehlt oder ist ungültig');
  return Buffer.from(hex, 'hex');
}
function sifrele(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', anahtar(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj || {}), 'utf8'), c.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') };
}
function coz(zarf) {
  if (!zarf || !zarf.ct) return {};
  const d = crypto.createDecipheriv('aes-256-gcm', anahtar(), Buffer.from(zarf.iv, 'base64'));
  d.setAuthTag(Buffer.from(zarf.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(zarf.ct, 'base64')), d.final()]).toString('utf8'));
}
const maskele = (v) => { const s = String(v || ''); return s ? MASKE + (s.length > 8 ? s.slice(-4) : '') : ''; };
const maskeMi = (v) => typeof v === 'string' && v.startsWith(MASKE);
const dolu = (v) => v != null && String(v).trim() !== '';

// ── Lesen (mit kurzem Zwischenspeicher) ─────────────────────────────────────
// 10 s: Aenderungen aus dem Admin-Prozess erreichen die API spaetestens nach 10 s.
const _cache = new Map(); const CACHE_MS = 10_000;
function cacheLeeren(key) { key ? _cache.delete(key) : _cache.clear(); }

async function satirOku(key) {
  try { const { rows } = await pool().query('SELECT e.*, a.ad_soyad AS guncelleyen_ad FROM entegrasyon_ayarlari e LEFT JOIN admin_users a ON a.id=e.guncelleyen WHERE e.provider=$1', [key]); return rows[0] || null; }
  catch (e) { if (e.code === '42P01') return null; throw e; } // Tabelle fehlt -> wie leer
}

/** Effektive Konfiguration: { key, mod, aktif, degerler, kaynak:{feld:'db'|'env'|'default'|null}, satir } */
async function ayar(key) {
  const t = tanim(key); if (!t) throw new Error('Bilinmeyen sağlayıcı: ' + key);
  const c = _cache.get(key); if (c && Date.now() - c.at < CACHE_MS) return c.v;
  const satir = await satirOku(key);
  let db = {};
  if (satir?.credentials) { try { db = coz(satir.credentials); } catch (e) { console.error('[entegrasyon] entschluesseln', key, e.message); db = {}; } }
  const cfg = satir?.config || {};
  const degerler = {}; const kaynak = {};
  for (const a of t.alanlar) {
    const dbWert = a.envSadece ? undefined : (a.secret ? db[a.key] : cfg[a.key]);
    if (dolu(dbWert)) { degerler[a.key] = String(dbWert); kaynak[a.key] = 'db'; }
    else if (a.env && dolu(process.env[a.env])) { degerler[a.key] = process.env[a.env]; kaynak[a.key] = 'env'; }
    else if (dolu(a.varsayilan)) { degerler[a.key] = a.varsayilan; kaynak[a.key] = 'default'; }
    else { degerler[a.key] = ''; kaynak[a.key] = null; }
  }
  let mod = satir?.mod || t.varsayilanMod;
  if (!t.modlar.includes(mod)) mod = t.varsayilanMod;
  const v = { key, mod, aktif: mod !== 'disabled', degerler, kaynak, satir, modKaynak: satir ? 'db' : 'default' };
  _cache.set(key, { at: Date.now(), v });
  return v;
}

/** Bereitschaft wie Cankartım readiness.ts: disabled | missing | ready | verified */
function hazirlik(t, a) {
  const zorunlu = t.alanlar.filter((x) => x.zorunlu);
  // Turnstile im Testmodus nutzt die offiziellen Testschluessel — dann fehlt nichts.
  const testSchluessel = t.key === 'turnstile' && a.mod === 'test';
  const eksik = testSchluessel ? [] : zorunlu.filter((x) => !dolu(a.degerler[x.key])).map((x) => x.label);
  const mevcut = zorunlu.length - eksik.length;
  let durum;
  if (a.mod === 'disabled') durum = 'disabled';
  else if (eksik.length) durum = 'missing';
  else if (a.satir?.son_test_sonuc === 'ok' && a.satir.son_test_at && (!a.satir.guncellendi_at || new Date(a.satir.son_test_at) >= new Date(a.satir.guncellendi_at))) durum = 'verified';
  else durum = 'ready';
  const ozet = { disabled: 'Devre dışı bırakıldı', missing: `${eksik.length} zorunlu alan eksik`,
    ready: testSchluessel ? 'Test modu: Cloudflare test anahtarları kullanılıyor' : 'Zorunlu alanlar tamam, bağlantı testi bekleniyor', verified: testSchluessel ? 'Test modu: Cloudflare test anahtarları, son test başarılı' : 'Zorunlu alanlar tamam, son test başarılı' }[durum];
  return { durum, eksik, mevcut, toplam: zorunlu.length, ozet };
}

/** Fuer die Admin-Maske: alles maskiert, nie Klartext-Geheimnisse. */
async function listeMaskeli() {
  const out = [];
  for (const t of SAGLAYICILAR) {
    const a = await ayar(t.key);
    const h = hazirlik(t, a);
    out.push({
      key: t.key, ad: t.ad, aciklama: t.aciklama, kategori: t.kategori, ikon: t.ikon, hazirlik: !!t.hazirlik,
      modlar: t.modlar, mod: a.mod, modKaynak: a.modKaynak, aktif: a.aktif, readiness: h,
      alanlar: t.alanlar.map((x) => ({ key: x.key, label: x.label, secret: !!x.secret, zorunlu: !!x.zorunlu,
        envSadece: !!x.envSadece, tip: x.tip || 'text', secenekler: x.secenekler || null, dinamik: x.dinamik || null, placeholder: x.placeholder || x.varsayilan || '',
        env: x.env || null, kaynak: a.kaynak[x.key], dolu: dolu(a.degerler[x.key]),
        deger: x.secret ? maskele(a.degerler[x.key]) : a.degerler[x.key] })),
      son_test_at: a.satir?.son_test_at || null, son_test_sonuc: a.satir?.son_test_sonuc || null,
      son_test_mesaj: a.satir?.son_test_mesaj || null, guncellendi_at: a.satir?.guncellendi_at || null,
      guncelleyen: a.satir?.guncelleyen_ad || null,
      turnstileTest: t.key === 'turnstile' && a.mod === 'test',
    });
  }
  return out;
}

/** Speichern. Geheime Felder: leer oder Maske -> gespeicherten Wert behalten; "__SIL__" leert. */
async function kaydet(key, { mod, degerler = {} }, adminId) {
  const t = tanim(key); if (!t) { const e = new Error('Bilinmeyen sağlayıcı'); e.status = 404; throw e; }
  if (mod && !t.modlar.includes(mod)) { const e = new Error('Geçersiz mod: ' + mod); e.status = 400; throw e; }
  if (key === 'iyzico' && mod === 'live' && ORTAM !== 'prod') { const e = new Error('Staging sunucusunda iyzico canlı moda alınamaz (yalnız test/sandbox).'); e.status = 400; throw e; }
  const satir = await satirOku(key);
  let gizli = {}; if (satir?.credentials) { try { gizli = coz(satir.credentials); } catch { gizli = {}; } }
  const cfg = { ...(satir?.config || {}) };
  for (const a of t.alanlar) {
    if (a.envSadece || !(a.key in degerler)) continue;
    let v = degerler[a.key]; v = v == null ? '' : String(v).trim();
    if (a.secret) {
      if (v === '__SIL__') delete gizli[a.key];
      else if (v && !maskeMi(v)) gizli[a.key] = v.slice(0, 4000);
    } else if (v) cfg[a.key] = v.slice(0, 4000); else delete cfg[a.key];
  }
  const yeniMod = mod || satir?.mod || t.varsayilanMod;
  await pool().query(
    `INSERT INTO entegrasyon_ayarlari(provider,kategori,mod,aktif,credentials,config,guncelleyen,guncellendi_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT(provider) DO UPDATE SET kategori=EXCLUDED.kategori, mod=EXCLUDED.mod, aktif=EXCLUDED.aktif,
       credentials=EXCLUDED.credentials, config=EXCLUDED.config, guncelleyen=EXCLUDED.guncelleyen, guncellendi_at=NOW()`,
    [key, t.kategori, yeniMod, yeniMod !== 'disabled', Object.keys(gizli).length ? sifrele(gizli) : null, cfg, adminId || null]);
  cacheLeeren(key);
  return ayar(key);
}

// ── Verbindungstests (lesend, ohne Nebenwirkungen) ──────────────────────────
const zamanAsimi = (ms) => AbortSignal.timeout(ms);

function iyzicoAuth(apiKey, secretKey, uriPath, body) {
  // IYZWSv2: HMAC-SHA256(secret, randomKey + uriPath + body) -> base64("apiKey:..&randomKey:..&signature:..")
  const rnd = Date.now() + crypto.randomBytes(6).toString('hex');
  const sig = crypto.createHmac('sha256', secretKey).update(rnd + uriPath + body).digest('hex');
  const auth = 'IYZWSv2 ' + Buffer.from(`apiKey:${apiKey}&randomKey:${rnd}&signature:${sig}`).toString('base64');
  return { Authorization: auth, 'x-iyzi-rnd': rnd, 'Content-Type': 'application/json' };
}

const TESTLER = {
  async claude(a) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: a.degerler.apiKey, timeout: 10000, maxRetries: 0 });
    const m = await client.models.retrieve(a.degerler.model);
    return `Anahtar geçerli, model erişilebilir (${m.id})`;
  },
  async iyzico(a) {
    // Immer gegen die Sandbox, solange nicht prod (keine echten Zahlungen).
    const basis = (a.mod === 'live' && ORTAM === 'prod') ? a.degerler.baseUrl : a.degerler.sandboxUrl;
    const uri = '/payment/iyzipos/installment';
    const body = JSON.stringify({ locale: 'tr', conversationId: 'kp-admin-test-' + Date.now(), binNumber: '450634', price: '100.00' });
    const r = await fetch(basis.replace(/\/$/, '') + uri, { method: 'POST', headers: iyzicoAuth(a.degerler.apiKey, a.degerler.secretKey, uri, body), body, signal: zamanAsimi(12000) });
    const d = await r.json().catch(() => ({}));
    if (d.status !== 'success') throw new Error(`${d.errorCode || r.status}: ${d.errorMessage || 'iyzico yanıtı başarısız'}`);
    return `installmentInfo başarılı (${basis.includes('sandbox') ? 'sandbox' : 'live'})`;
  },
  async smtp(a) {
    const nodemailer = require('nodemailer');
    const port = parseInt(a.degerler.port, 10) || 587;
    const tr = nodemailer.createTransport({ host: a.degerler.host, port, secure: port === 465, auth: { user: a.degerler.user, pass: a.degerler.pass }, connectionTimeout: 10000 });
    await tr.verify();
    return `SMTP bağlantısı ve oturum açma başarılı (${a.degerler.host}:${port})`;
  },
  async resend(a) {
    const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${a.degerler.apiKey}` }, signal: zamanAsimi(10000) });
    if (r.status === 401 || r.status === 403) throw new Error('API anahtarı reddedildi (' + r.status + ')');
    if (!r.ok) throw new Error('Resend yanıtı ' + r.status);
    const d = await r.json().catch(() => ({}));
    return `API anahtarı geçerli (${(d.data || []).length} alan adı)`;
  },
  async turnstile(a) {
    const secret = a.mod === 'test' ? TURNSTILE_TEST.secretKey : a.degerler.secretKey;
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST',
      body: new URLSearchParams({ secret, response: 'XXXX.DUMMY.TOKEN.XXXX' }), signal: zamanAsimi(10000) });
    const d = await r.json();
    const kodlar = d['error-codes'] || [];
    if (a.mod === 'test') { if (!d.success) throw new Error('Test anahtarı beklenen sonucu vermedi: ' + kodlar.join(',')); return 'Test modu: Cloudflare test anahtarları çalışıyor'; }
    if (kodlar.includes('invalid-input-secret')) throw new Error('Secret Key geçersiz');
    return 'Secret Key Cloudflare tarafından kabul edildi';
  },
  async google_musteri(a) { return googleTest(a); },
  async google_admin(a) { return googleTest(a); },
  async meilisearch(a) {
    const h = a.degerler.host.replace(/\/$/, '');
    const r1 = await fetch(h + '/health', { signal: zamanAsimi(5000) });
    if (!r1.ok) throw new Error('Meilisearch erreichbar değil (' + r1.status + ')');
    const r2 = await fetch(h + '/indexes', { headers: { Authorization: `Bearer ${a.degerler.apiKey}` }, signal: zamanAsimi(5000) });
    if (!r2.ok) throw new Error('Anahtar reddedildi (' + r2.status + ')');
    const d = await r2.json();
    return `Sağlıklı, ${d.total ?? (d.results || []).length} indeks`;
  },
  async nominatim(a) {
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=41.0082&lon=28.9784&zoom=10',
      { headers: { 'User-Agent': a.degerler.userAgent }, signal: zamanAsimi(10000) });
    if (!r.ok) throw new Error('Nominatim yanıtı ' + r.status);
    const d = await r.json();
    return `Yanıt alındı (${d.address?.province || d.address?.city || d.display_name?.split(',')[0] || 'ok'})`;
  },
  async netgsm() { throw new Error('NetGSM entegrasyonu hazırlanıyor — test henüz yok'); },
  async r2() { throw new Error('R2 entegrasyonu hazırlanıyor — test henüz yok'); },
};
async function googleTest(a) {
  // Unbrauchbarer Code: invalid_grant = Client-ID/Secret stimmen, invalid_client = falsch.
  const uri = String(a.degerler.redirectUris || '').split(/\s+/).filter(Boolean)[0] || 'https://kapbeni.com';
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: zamanAsimi(10000),
    body: new URLSearchParams({ code: 'kp-test', client_id: a.degerler.clientId, client_secret: a.degerler.clientSecret, redirect_uri: uri, grant_type: 'authorization_code' }) });
  const d = await r.json().catch(() => ({}));
  if (d.error === 'invalid_client' || d.error === 'unauthorized_client') throw new Error('Client ID/Secret reddedildi (' + d.error + ')');
  if (d.error === 'invalid_grant' || d.error === 'redirect_uri_mismatch') return 'Client ID/Secret Google tarafından tanındı';
  throw new Error('Beklenmeyen yanıt: ' + (d.error || r.status));
}

async function test(key, adminId) {
  const t = tanim(key); if (!t) { const e = new Error('Bilinmeyen sağlayıcı'); e.status = 404; throw e; }
  const a = await ayar(key);
  let sonuc, mesaj;
  const eksik = hazirlik(t, a).eksik;
  if (a.mod === 'disabled') { sonuc = 'hata'; mesaj = 'Devre dışı — test yapılmadı'; }
  else if (eksik.length && !(key === 'turnstile' && a.mod === 'test')) { sonuc = 'hata'; mesaj = 'Eksik alanlar: ' + eksik.join(', '); }
  else {
    try { mesaj = await TESTLER[key](a); sonuc = 'ok'; }
    catch (e) { sonuc = 'hata'; mesaj = String(e.message || e).slice(0, 300); }
  }
  // Nur die Testspalten schreiben; eine Zeile entsteht notfalls mit dem Standardmodus.
  await pool().query(
    `INSERT INTO entegrasyon_ayarlari(provider,kategori,mod,aktif,son_test_at,son_test_sonuc,son_test_mesaj)
     VALUES($1,$2,$3,$4,NOW(),$5,$6)
     ON CONFLICT(provider) DO UPDATE SET son_test_at=NOW(), son_test_sonuc=EXCLUDED.son_test_sonuc, son_test_mesaj=EXCLUDED.son_test_mesaj`,
    [key, t.kategori, a.mod, a.aktif, sonuc, mesaj]);
  cacheLeeren(key);
  return { ok: sonuc === 'ok', sonuc, mesaj, test_at: new Date().toISOString() };
}

// ── Helfer fuer die Nutzung im Code ─────────────────────────────────────────
/** Turnstile-Einstellungen fuer die Oberflaeche (nie das Secret). */
async function turnstileGenel() {
  const a = await ayar('turnstile').catch(() => null);
  if (!a || a.mod === 'disabled') return { aktif: false, mod: 'disabled', siteKey: null };
  if (a.mod === 'test') return { aktif: true, mod: 'test', siteKey: TURNSTILE_TEST.siteKey };
  if (!dolu(a.degerler.siteKey) || !dolu(a.degerler.secretKey)) return { aktif: false, mod: 'live', siteKey: null };
  return { aktif: true, mod: 'live', siteKey: a.degerler.siteKey };
}
/**
 * Serverseitige Pruefung. live: siteverify (ohne Token oder bei Ablehnung -> ok:false).
 * test: offizielle Testschluessel, es wird nicht geprueft. disabled/ohne Schluessel: nicht geprueft.
 */
async function turnstileDogrula(token, ip) {
  const a = await ayar('turnstile').catch(() => null);
  if (!a || a.mod === 'disabled') return { ok: true, geprueft: false, mod: 'disabled' };
  if (a.mod === 'test') return { ok: true, geprueft: false, mod: 'test' };
  if (!dolu(a.degerler.siteKey) || !dolu(a.degerler.secretKey)) return { ok: true, geprueft: false, mod: 'live-eksik' };
  if (!token) return { ok: false, geprueft: true, mod: 'live', hata: 'Güvenlik doğrulaması eksik' };
  try {
    const body = new URLSearchParams({ secret: a.degerler.secretKey, response: String(token) });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: zamanAsimi(8000) });
    const d = await r.json();
    return d.success ? { ok: true, geprueft: true, mod: 'live' } : { ok: false, geprueft: true, mod: 'live', hata: 'Güvenlik doğrulaması başarısız', kodlar: d['error-codes'] };
  } catch (e) {
    console.error('[turnstile] siteverify', e.message);
    return { ok: false, geprueft: true, mod: 'live', hata: 'Güvenlik doğrulaması şu an yapılamıyor, lütfen tekrar deneyin' };
  }
}
/** Google-Login nur, wenn die Integration live ist und Client-ID/Secret/Redirect gesetzt sind. */
async function googleAyar(hangisi) {
  const key = hangisi === 'admin' ? 'google_admin' : 'google_musteri';
  const a = await ayar(key).catch(() => null);
  if (!a || a.mod !== 'live') return null;
  const d = a.degerler;
  const uris = String(d.redirectUris || '').split(/\s+/).filter(Boolean);
  if (!dolu(d.clientId) || !dolu(d.clientSecret) || !uris.length) return null;
  return { clientId: d.clientId, clientSecret: d.clientSecret, redirectUris: uris,
    izinliler: String(d.izinliler || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) };
}
/** Mail-Kanal: resend (live + Schluessel) > smtp (live + host/user/pass) > log. */
async function mailKanal() {
  const r = await ayar('resend').catch(() => null);
  if (r && r.mod === 'live' && dolu(r.degerler.apiKey) && dolu(r.degerler.from)) return { kanal: 'resend', ayar: r.degerler };
  const s = await ayar('smtp').catch(() => null);
  if (s && s.mod === 'live' && dolu(s.degerler.host) && dolu(s.degerler.user) && dolu(s.degerler.pass)) return { kanal: 'smtp', ayar: s.degerler };
  return { kanal: 'log', ayar: null };
}

/** Verfuegbare Claude-Modelle (models.list kostet keine Tokens). */
async function claudeModeller() {
  const a = await ayar('claude');
  if (!dolu(a.degerler.apiKey)) return [];
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: a.degerler.apiKey, timeout: 10000, maxRetries: 0 });
  const liste = [];
  for await (const m of client.models.list({ limit: 100 })) liste.push({ id: m.id, ad: m.display_name || m.id });
  return liste;
}

// ── Google OAuth (Geruest, v1.21) ───────────────────────────────────────────
// Wird nur benutzt, wenn googleAyar() eine vollstaendige, live geschaltete
// Konfiguration liefert. Prueft das ID-Token ueber Googles tokeninfo (aud, email_verified).
function googleAuthUrl(cfg, state) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUris[0], response_type: 'code',
    scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  return u.toString();
}
async function googleCodeTausch(cfg, code) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: zamanAsimi(10000),
    body: new URLSearchParams({ code: String(code || ''), client_id: cfg.clientId, client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUris[0], grant_type: 'authorization_code' }) });
  const d = await r.json().catch(() => ({}));
  if (!d.id_token) throw new Error('Google: ' + (d.error || 'id_token yok'));
  const t = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(d.id_token), { signal: zamanAsimi(10000) });
  const info = await t.json().catch(() => ({}));
  if (info.aud !== cfg.clientId) throw new Error('Google: aud uyuşmuyor');
  if (String(info.email_verified) !== 'true' || !info.email) throw new Error('Google: e-posta doğrulanmamış');
  return { sub: String(info.sub), email: String(info.email).toLowerCase(), ad: info.given_name || null, soyad: info.family_name || null };
}

const kapat = async () => { if (_pool) { const p = _pool; _pool = null; await p.end(); } };

module.exports = { googleAuthUrl, googleCodeTausch, kapat, claudeModeller, SAGLAYICILAR, tanim, ayar, listeMaskeli, kaydet, test, hazirlik, cacheLeeren,
  turnstileGenel, turnstileDogrula, googleAyar, mailKanal, maskele, sifrele, coz, TURNSTILE_TEST, ORTAM };
