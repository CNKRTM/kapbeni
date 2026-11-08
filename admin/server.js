require('dotenv').config({ path: '/etc/kapbeni.env' });
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Dieselbe Quelle wie die Fusszeile der Hauptseite: /opt/kapbeni/VERSION.
// Einmal beim Start gelesen — deploy.sh startet die Dienste ohnehin neu.
// Faellt die Datei weg, steht "dev" da statt einer erfundenen Nummer.
const APP_VERSION = (() => {
  try { return fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim() || 'dev'; }
  catch { return 'dev'; }
})();
// Liegt nur im api-Projekt; gleiches Require-Muster wie openai/mailer weiter unten.
const rateLimit = require('../api/node_modules/express-rate-limit');

const app = express();
const entegrasyon = require('../api/src/lib/entegrasyon');
const ilanArsiv = require('../api/src/lib/ilanArsiv');
const olayLib = require('../api/src/lib/olay');
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
// Auch unter /admin/… (z. B. /admin/img/…), falls die Seite mit Schraegstrich aufgerufen wird.
app.use('/admin', express.static(path.join(__dirname, 'public'), { index: false, redirect: false }));
// Inseratsbilder fuer Kundenakte/İlan Onayı auch unter dem Admin-Pfad (LAN :3002 kennt /uploads nicht).
// Nur der ohnehin oeffentliche Ordner ilanlar — Archiv/KYC/Belege bleiben gesperrt.
app.use('/admin/uploads/ilanlar', express.static(path.join(process.env.UPLOAD_DIR || '/var/www/kapbeni/uploads', 'ilanlar'), { index: false, redirect: false, fallthrough: false }));

// ── Brute-Force-Schutz fuer den Admin-Login ───────────────────────────────
// Analog zu api/src/index.js: 20 Versuche je 15 Minuten.
// Schluessel: die echte Client-IP. nginx setzt X-Real-IP, aber nur Anfragen,
// die tatsaechlich ueber den lokalen Proxy kommen, duerfen diesen Header
// setzen — sonst koennte jemand mit Direktzugriff auf :3002 den Header
// faelschen und das Limit umgehen. Ohne diesen Schluessel saehe Express
// hinter nginx ALLE Anfragen als 127.0.0.1 und ein Angreifer koennte den
// echten Admin mit 20 Fehlversuchen aussperren.
const clientIp = (req) => {
  const direkt = req.socket?.remoteAddress || req.ip || '';
  const ueberProxy = direkt.includes('127.0.0.1') || direkt === '::1' || direkt.includes('::ffff:127.0.0.1');
  return (ueberProxy && req.headers['x-real-ip']) ? String(req.headers['x-real-ip']) : direkt;
};
const girisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  message: { hata: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});
app.use('/admin/api/giris', girisLimiter);

// Admin JWT — kaynak: 'admin' (API'nin 'api' kaynağından farklı).
// Seit v1.17 traegt der Token die Sitzungs-ID (sid) aus admin_oturumlar: Abmelden
// und (ab v1.18) die Bildschirmsperre wirken serverseitig, nicht nur im Browser.
const OTURUM_SAAT = 8;
const adminToken = (user, sid) => jwt.sign(
  { id: user.id, email: user.email, rol: user.rol, kaynak: 'admin', sid },
  process.env.JWT_SECRET, { expiresIn: OTURUM_SAAT + 'h' }
);
async function oturumAc(admin, req) {
  const sid = require('crypto').randomUUID();
  await db.query(
    `INSERT INTO admin_oturumlar(id,admin_id,ip,user_agent,bitis) VALUES($1,$2,$3,$4,NOW()+($5||' hours')::interval)`,
    [sid, admin.id, clientIp(req).slice(0, 45), String(req.headers['user-agent'] || '').slice(0, 400), String(OTURUM_SAAT)]);
  return sid;
}

const KILIT_DK = 15;
const KILIT_SERBEST = new Set(['/admin/api/ben', '/admin/api/kilit-ac', '/admin/api/cikis', '/admin/api/kilitle']);
const adminAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.admin_token;
  if (!token) return res.status(401).json({ hata: 'Giriş gerekli' });
  let d;
  try { d = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ hata: 'Geçersiz token' }); }
  if (d.kaynak !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  if (!d.sid) return res.status(401).json({ hata: 'Oturum yenilendi, lütfen tekrar giriş yapın' });
  try {
    const { rows } = await db.query(
      `SELECT o.*, a.aktif AS admin_aktif FROM admin_oturumlar o JOIN admin_users a ON a.id=o.admin_id
       WHERE o.id=$1 AND o.admin_id=$2`, [d.sid, d.id]);
    const o = rows[0];
    if (!o || o.kapandi_at || new Date(o.bitis) < new Date() || !o.admin_aktif)
      return res.status(401).json({ hata: 'Oturum sona erdi' });
    // Bildschirmsperre (v1.18): 15 min ohne Aktivitaet -> gesperrt; gesperrt = 423
    // fuer alles ausser /ben, /kilit-ac, /cikis, /kilitle. Hintergrundabrufe
    // (Header X-Kp-Arka: 1, z. B. Sidebar-Zaehler) zaehlen nicht als Aktivitaet.
    let kilitli = o.kilitli;
    if (!kilitli && Date.now() - new Date(o.son_aktivite).getTime() > KILIT_DK * 60000) {
      const u = await db.query('UPDATE admin_oturumlar SET kilitli=true, kilit_at=NOW() WHERE id=$1 AND kilitli=false', [o.id]);
      if (u.rowCount) await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.kilit','admin',$1,$2,$3)`,
        [d.id, JSON.stringify({ sebep: 'zaman_asimi' }), clientIp(req).slice(0, 45)]);
      kilitli = true; o.kilitli = true;
    }
    const yol = req.originalUrl.split('?')[0].replace(/\/+$/, '');
    if (kilitli && !KILIT_SERBEST.has(yol)) return res.status(423).json({ hata: 'Ekran kilitli', kilitli: true });
    if (!kilitli && req.headers['x-kp-arka'] !== '1') await db.query('UPDATE admin_oturumlar SET son_aktivite=NOW() WHERE id=$1', [o.id]);
    req.admin = d; req.oturum = o;
    next();
  } catch (e) { console.error('[adminAuth]', e.message); res.status(500).json({ hata: 'Oturum kontrol edilemedi' }); }
};

const auditAdmin = async (olay, admin_id, opts = {}) => {
  await db.query(
    `INSERT INTO audit_log(olay,kaynak,admin_id,hedef_tip,hedef_id,detay) VALUES($1,'admin',$2,$3,$4,$5)`,
    [olay, admin_id, opts.hedefTip||null, opts.hedefId||null, opts.detay ? JSON.stringify(opts.detay) : null]
  );
};

// ── ADMIN AUTH ──────────────────────────────────────────────────────────

// Jeder Versuch kommt mit IP ins audit_log (Hinweis auf der Login-Seite).
const adminOzet = (a) => ({ id: a.id, email: a.email, ad_soyad: a.ad_soyad, rol: a.rol });
app.post('/admin/api/giris', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const ip = clientIp(req).slice(0, 45);
    const ts = await entegrasyon.turnstileDogrula(req.body?.turnstile, ip);
    if (!ts.ok) {
      await db.query(`INSERT INTO audit_log(olay,kaynak,detay,ip_adresi) VALUES('admin.giris_hata','admin',$1,$2)`,
        [JSON.stringify({ email: email.slice(0, 120), sebep: 'turnstile' }), ip]);
      return res.status(400).json({ hata: ts.hata || 'Güvenlik doğrulaması başarısız' });
    }
    const { rows } = await db.query('SELECT * FROM admin_users WHERE lower(email)=$1 AND aktif=true', [email]);
    if (!rows[0] || !await bcrypt.compare(password, rows[0].password_hash)) {
      await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.giris_hata','admin',$1,$2,$3)`,
        [rows[0]?.id || null, JSON.stringify({ email: email.slice(0, 120) }), ip]);
      return res.status(401).json({ hata: 'E-posta veya şifre hatalı' });
    }
    const sid = await oturumAc(rows[0], req);
    await db.query('UPDATE admin_users SET son_giris=NOW() WHERE id=$1', [rows[0].id]);
    await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.giris','admin',$1,$2,$3)`,
      [rows[0].id, JSON.stringify({ yontem: 'sifre' }), ip]);
    res.json({ token: adminToken(rows[0], sid), admin: adminOzet(rows[0]) });
  } catch (e) { console.error('[admin/giris]', e.message); res.status(500).json({ hata: 'Giriş yapılamadı' }); }
});

app.get('/admin/api/ben', adminAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM admin_users WHERE id=$1', [req.admin.id]);
  res.json({ admin: adminOzet(rows[0]), kilitli: !!req.oturum.kilitli });
});

app.post('/admin/api/cikis', adminAuth, async (req, res) => {
  await db.query('UPDATE admin_oturumlar SET kapandi_at=NOW() WHERE id=$1', [req.oturum.id]);
  await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,ip_adresi) VALUES('admin.cikis','admin',$1,$2)`, [req.admin.id, clientIp(req).slice(0, 45)]);
  res.json({ ok: true });
});

// ── Bildschirmsperre ───────────────────────────────────────────────────
app.post('/admin/api/kilitle', adminAuth, async (req, res) => {
  const sebep = ['manuel', 'hareketsizlik'].includes(req.body?.sebep) ? req.body.sebep : 'manuel';
  const u = await db.query('UPDATE admin_oturumlar SET kilitli=true, kilit_at=NOW() WHERE id=$1 AND kilitli=false', [req.oturum.id]);
  if (u.rowCount) await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.kilit','admin',$1,$2,$3)`,
    [req.admin.id, JSON.stringify({ sebep }), clientIp(req).slice(0, 45)]);
  res.json({ ok: true, kilitli: true });
});
app.post('/admin/api/aktivite', adminAuth, (req, res) => res.json({ ok: true }));
// Entsperren: Passwort serverseitig, 10 Versuche je 15 min und IP, nach 5 Fehlern
// in derselben Sitzung wird sie geschlossen (zurueck zum Login).
const kilitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true,
  keyGenerator: clientIp, message: { hata: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' } });
app.post('/admin/api/kilit-ac', kilitLimiter, adminAuth, async (req, res) => {
  const ip = clientIp(req).slice(0, 45);
  const { rows } = await db.query('SELECT password_hash FROM admin_users WHERE id=$1 AND aktif=true', [req.admin.id]);
  const ok = rows[0] && await bcrypt.compare(String(req.body?.password || ''), rows[0].password_hash);
  if (!ok) {
    const { rows: o } = await db.query('UPDATE admin_oturumlar SET kilit_hata=kilit_hata+1 WHERE id=$1 RETURNING kilit_hata', [req.oturum.id]);
    const n = o[0]?.kilit_hata || 0;
    await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.kilit_ac_hata','admin',$1,$2,$3)`,
      [req.admin.id, JSON.stringify({ deneme: n }), ip]);
    if (n >= 5) {
      await db.query('UPDATE admin_oturumlar SET kapandi_at=NOW() WHERE id=$1', [req.oturum.id]);
      await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.kilit_cikis','admin',$1,$2,$3)`,
        [req.admin.id, JSON.stringify({ sebep: '5 hatalı deneme' }), ip]);
      return res.status(401).json({ hata: '5 hatalı deneme — oturum kapatıldı. Lütfen tekrar giriş yapın.', cikis: true });
    }
    return res.status(403).json({ hata: `Şifre hatalı (${n}/5)` });
  }
  await db.query('UPDATE admin_oturumlar SET kilitli=false, kilit_hata=0, son_aktivite=NOW() WHERE id=$1', [req.oturum.id]);
  await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,ip_adresi) VALUES('admin.kilit_ac','admin',$1,$2)`, [req.admin.id, ip]);
  res.json({ ok: true });
});

// ── Şifremi unuttum (v1.19) ─────────────────────────────────────────────
// Token: 32 Zufallsbytes (base64url), gespeichert nur als SHA-256, 30 min, einmal.
// Antwort immer gleich („Eğer kayıtlıysa …“), egal ob es das Konto gibt.
const SIFRE_KURAL_HATA = 'Şifre en az 10 karakter olmalı ve büyük harf, küçük harf ve rakam içermelidir.';
const sifreGecerli = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200 && /[a-zçğıöşü]/.test(p) && /[A-ZÇĞİÖŞÜ]/.test(p) && /\d/.test(p);
const tokenHash = (t) => require('crypto').createHash('sha256').update(String(t)).digest('hex');
const ADMIN_URL = () => (process.env.ADMIN_PUBLIC_URL || 'https://kapbeni.com/kapbeniadmin/admin').replace(/\/$/, '');
const unuttumLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: clientIp, message: { hata: 'Çok fazla istek. 15 dakika sonra tekrar deneyin.' } });
const yenileLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: clientIp, message: { hata: 'Çok fazla istek. 15 dakika sonra tekrar deneyin.' } });
const NOTR = 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.';

app.post('/admin/api/sifre-unuttum', unuttumLimiter, async (req, res) => {
  const ip = clientIp(req).slice(0, 45);
  const ts = await entegrasyon.turnstileDogrula(req.body?.turnstile, ip).catch(() => ({ ok: false }));
  if (!ts.ok) return res.status(400).json({ hata: ts.hata || 'Güvenlik doğrulaması başarısız' });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200);
    let kanal = (await entegrasyon.mailKanal().catch(() => ({ kanal: 'log' }))).kanal;
    const { rows } = email ? await db.query('SELECT id, email, ad_soyad FROM admin_users WHERE lower(email)=$1 AND aktif=true', [email]) : { rows: [] };
    if (rows[0]) {
      const token = require('crypto').randomBytes(32).toString('base64url');
      // Aeltere offene Tokens dieses Kontos verfallen sofort
      await db.query('UPDATE admin_sifre_sifirlama SET expires_at=NOW() WHERE admin_id=$1 AND kullanildi_at IS NULL AND expires_at>NOW()', [rows[0].id]);
      await db.query(`INSERT INTO admin_sifre_sifirlama(admin_id,token_hash,expires_at,ip) VALUES($1,$2,NOW()+interval '30 minutes',$3)`,
        [rows[0].id, tokenHash(token), ip]);
      const link = `${ADMIN_URL()}#/yeni-sifre?t=${token}`;
      const { sendMail } = require('../api/src/utils/mailer');
      const m = await sendMail({ to: rows[0].email, subject: 'Kap Beni Yönetim Paneli – Şifre sıfırlama',
        html: `<p>Merhaba ${String(rows[0].ad_soyad || '').replace(/[<>&]/g, '')},</p><p>Yönetim paneli şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın. Bağlantı <strong>30 dakika</strong> geçerlidir ve yalnızca bir kez kullanılabilir.</p><p><a href="${link}">${link}</a></p><p>Bu isteği siz yapmadıysanız bu e-postayı yok sayın.</p><p>Kap Beni</p>`,
        logIcerik: 'Link: ' + link });
      kanal = m.kanal;
    }
    await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.sifre_unuttum','admin',$1,$2,$3)`,
      [rows[0]?.id || null, JSON.stringify({ bulundu: !!rows[0], kanal, email: email.slice(0, 120) }), ip]);
  } catch (e) { console.error('[sifre-unuttum]', e.message); }
  // Kanal sagt nur, ob ueberhaupt gesendet wird (Konfiguration), nichts ueber das Konto.
  const mk = (await entegrasyon.mailKanal().catch(() => ({ kanal: 'log' }))).kanal;
  res.json({ mesaj: NOTR, mail_kanali: mk });
});

async function sifirlamaBul(token) {
  if (!token || String(token).length < 20) return null;
  const { rows } = await db.query(
    `SELECT s.*, a.email FROM admin_sifre_sifirlama s JOIN admin_users a ON a.id=s.admin_id
     WHERE s.token_hash=$1 AND s.kullanildi_at IS NULL AND s.expires_at>NOW() AND a.aktif=true`, [tokenHash(token)]);
  return rows[0] || null;
}
app.get('/admin/api/sifre-yenile/kontrol', yenileLimiter, async (req, res) => {
  res.json({ gecerli: !!(await sifirlamaBul(req.query.t)) });
});
app.post('/admin/api/sifre-yenile', yenileLimiter, async (req, res) => {
  const ip = clientIp(req).slice(0, 45);
  try {
    const { token, password } = req.body || {};
    const s = await sifirlamaBul(token);
    if (!s) return res.status(400).json({ hata: 'Bağlantı geçersiz, kullanılmış veya süresi dolmuş.' });
    if (!sifreGecerli(password)) return res.status(400).json({ hata: SIFRE_KURAL_HATA });
    if (String(password).toLowerCase().includes(String(s.email).split('@')[0].toLowerCase())) return res.status(400).json({ hata: 'Şifre e-posta adınızı içeremez.' });
    // Einmal nutzbar: das UPDATE gewinnt nur einmal (auch bei Doppelklick)
    const u = await db.query('UPDATE admin_sifre_sifirlama SET kullanildi_at=NOW() WHERE id=$1 AND kullanildi_at IS NULL', [s.id]);
    if (!u.rowCount) return res.status(400).json({ hata: 'Bağlantı zaten kullanılmış.' });
    await db.query('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 12), s.admin_id]);
    await db.query('UPDATE admin_oturumlar SET kapandi_at=NOW() WHERE admin_id=$1 AND kapandi_at IS NULL', [s.admin_id]);
    await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,ip_adresi) VALUES('admin.sifre_yenilendi','admin',$1,$2)`, [s.admin_id, ip]);
    res.json({ ok: true, mesaj: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' });
  } catch (e) { console.error('[sifre-yenile]', e.message); res.status(500).json({ hata: 'Şifre güncellenemedi' }); }
});

// ── Google ile giriş (Admin, Geruest v1.21) ──────────────────────────────
// Nur bei live geschalteter Integration „Google ile Giriş (Admin)“. Zugelassen wird
// nur, wer in den izinliler steht (E-Mail oder @domain) UND ein aktives admin_users-
// Konto mit derselben E-Mail hat. Keine automatische Anlage von Admins.
const googleIzinli = (email, liste) => liste.some((x) => x.startsWith('@') ? email.endsWith(x) : email === x);
app.get('/admin/api/google/baslat', async (req, res) => {
  const cfg = await entegrasyon.googleAyar('admin').catch(() => null);
  if (!cfg) return res.status(404).json({ hata: 'Google ile giriş henüz aktif değil' });
  const state = jwt.sign({ t: 'google-admin', n: require('crypto').randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.redirect(entegrasyon.googleAuthUrl(cfg, state));
});
app.get('/admin/api/google/callback', async (req, res) => {
  const cfg = await entegrasyon.googleAyar('admin').catch(() => null);
  if (!cfg) return res.status(404).json({ hata: 'Google ile giriş henüz aktif değil' });
  const ip = clientIp(req).slice(0, 45);
  const geri = (h) => res.redirect(ADMIN_URL() + '#/' + h);
  try {
    const st = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (st.t !== 'google-admin') throw new Error('state');
    const g = await entegrasyon.googleCodeTausch(cfg, req.query.code);
    const { rows } = await db.query('SELECT * FROM admin_users WHERE lower(email)=$1 AND aktif=true', [g.email]);
    if (!googleIzinli(g.email, cfg.izinliler) || !rows[0]) {
      await db.query(`INSERT INTO audit_log(olay,kaynak,detay,ip_adresi) VALUES('admin.giris_hata','admin',$1,$2)`,
        [JSON.stringify({ email: g.email, yontem: 'google', sebep: 'izinli_degil' }), ip]);
      return geri('giris?hata=google_izin');
    }
    const sid = await oturumAc(rows[0], req);
    await db.query('UPDATE admin_users SET son_giris=NOW() WHERE id=$1', [rows[0].id]);
    await db.query(`INSERT INTO audit_log(olay,kaynak,admin_id,detay,ip_adresi) VALUES('admin.giris','admin',$1,$2,$3)`,
      [rows[0].id, JSON.stringify({ yontem: 'google' }), ip]);
    geri('google-giris?token=' + encodeURIComponent(adminToken(rows[0], sid)));
  } catch (e) { console.error('[admin/google]', e.message); geri('giris?hata=google'); }
});

// Oeffentlich: was die Login-Seite braucht (keine Geheimnisse).
app.get('/admin/api/giris-yapilandirma', async (req, res) => {
  let turnstile = { aktif: false }, google = { aktif: false }, mail = { kanal: 'log' };
  try { turnstile = await entegrasyon.turnstileGenel(); } catch {}
  try { google = { aktif: !!(await entegrasyon.googleAyar('admin')) }; } catch {}
  try { mail = await entegrasyon.mailKanal(); } catch {}
  await bauLesen();
  res.json({ version: APP_VERSION, commit: _bau.commit, ortam: entegrasyon.ORTAM, turnstile, google, mail_kanali: mail.kanal });
});

// ── DASHBOARD ──────────────────────────────────────────────────────────

app.get('/admin/api/dashboard', adminAuth, async (req, res) => {
  const [users, ilanlar, islemler, tickets, audit] = await Promise.all([
    db.query(`SELECT COUNT(*) as toplam, COUNT(*) FILTER(WHERE durum='askida') as askida,
              COUNT(*) FILTER(WHERE created_at > NOW()-INTERVAL '24h') as bugun FROM users`),
    db.query(`SELECT COUNT(*) as toplam, COUNT(*) FILTER(WHERE ilan_durum='moderasyonda') as bekleyen,
              COUNT(*) FILTER(WHERE ilan_durum='aktif') as aktif FROM ilanlar`),
    db.query(`SELECT COUNT(*) as toplam, COUNT(*) FILTER(WHERE durum='itiraz_acildi') as itirazli,
              SUM(tutar) FILTER(WHERE durum='tamamlandi') as toplam_hacim FROM islemler`),
    db.query(`SELECT COUNT(*) FILTER(WHERE durum='acik') as acik,
              COUNT(*) FILTER(WHERE oncelik='acil') as acil FROM support_tickets`),
    db.query(`SELECT olay, COUNT(*) as sayi FROM audit_log WHERE created_at > NOW()-INTERVAL '24h'
              GROUP BY olay ORDER BY sayi DESC LIMIT 10`),
  ]);
  res.json({
    users: users.rows[0], ilanlar: ilanlar.rows[0],
    islemler: islemler.rows[0], tickets: tickets.rows[0],
    son_olaylar: audit.rows
  });
});

// ── KULLANICI YÖNETİMİ ──────────────────────────────────────────────────

app.get('/admin/api/users', adminAuth, async (req, res) => {
  const { q, durum, sayfa = 1, limit = 30 } = req.query;
  let where = ['1=1']; const params = [];  let p = 1;
  if (q) { where.push(`(email ILIKE $${p++} OR ad ILIKE $${p++} OR phone ILIKE $${p++})`); params.push(`%${q}%`,`%${q}%`,`%${q}%`); p++; p++; }
  if (durum) { where.push(`durum=$${p++}`); params.push(durum); }
  params.push(limit, (sayfa-1)*limit);
  const { rows } = await db.query(
    `SELECT u.*, k.durum as kyc_durum,
            (SELECT COUNT(*) FROM ilanlar WHERE user_id=u.id) as ilan_sayisi
     FROM users u LEFT JOIN kyc_results k ON k.user_id=u.id AND k.id=(SELECT MAX(id) FROM kyc_results WHERE user_id=u.id)
     WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT $${p++} OFFSET $${p}`, params
  );
  res.json(rows);
});

app.post('/admin/api/users/:id/ban', adminAuth, async (req, res) => {
  const { sebep } = req.body;
  await db.query("UPDATE users SET durum='banlı', ban_sebebi=$1 WHERE id=$2", [sebep, req.params.id]);
  await auditAdmin('user.ban', req.admin.id, { hedefTip:'user', hedefId:+req.params.id, detay:{sebep} });
  res.json({ mesaj: 'Kullanıcı banlandı' });
});

app.post('/admin/api/users/:id/aktifle', adminAuth, async (req, res) => {
  await db.query("UPDATE users SET durum='aktif', ban_sebebi=NULL WHERE id=$1", [req.params.id]);
  await auditAdmin('user.aktifle', req.admin.id, { hedefTip:'user', hedefId:+req.params.id });
  res.json({ mesaj: 'Kullanıcı aktifleştirildi' });
});

// ── İLAN MÖDERASYOnu ──────────────────────────────────────────────────

app.get('/admin/api/ilanlar', adminAuth, async (req, res) => {
  const { durum = 'moderasyonda', sayfa = 1, limit = 20 } = req.query;
  const { rows } = await db.query(
    `SELECT i.*, u.email, u.ad, u.soyad, u.musteri_no, u.cinsiyet, u.hesap_tipi, u.firma_adi, k.ad as kategori_ad,
            (SELECT v.deger FROM ilan_ozellik_degerleri v JOIN kategori_ozellik_tanimlari t ON t.id=v.tanim_id WHERE v.ilan_id=i.id AND t.alan_adi='marka' LIMIT 1) as marka,
            (SELECT url FROM ilan_fotograflar WHERE ilan_id=i.id AND ana_foto=true LIMIT 1) as ana_foto
     FROM ilanlar i JOIN users u ON u.id=i.user_id LEFT JOIN kategoriler k ON k.id=i.kategori_id
     WHERE i.ilan_durum=$1 ORDER BY i.created_at ASC LIMIT $2 OFFSET $3`,
    [durum, limit, (sayfa-1)*limit]
  );
  res.json(rows);
});

app.post('/admin/api/ilanlar/:id/onayla', adminAuth, async (req, res) => {
  await db.query("UPDATE ilanlar SET ilan_durum='aktif' WHERE id=$1", [req.params.id]);
  await auditAdmin('ilan.onayla', req.admin.id, { hedefTip:'ilan', hedefId:+req.params.id });
  res.json({ mesaj: 'İlan onaylandı' });
});

// Ablehnen: Inserat bleibt (der Eigentuemer sieht es als abgelehnt), zusaetzlich
// Snapshot + KOPIE der Bilder ins Archiv (Auftragssammlung G, v1.23).
app.post('/admin/api/ilanlar/:id/reddet', adminAuth, async (req, res) => {
  const { sebep } = req.body;
  await db.query("UPDATE ilanlar SET ilan_durum='reddedildi', ai_not=$1 WHERE id=$2", [sebep, req.params.id]);
  await auditAdmin('ilan.reddet', req.admin.id, { hedefTip:'ilan', hedefId:+req.params.id, detay:{sebep} });
  try {
    const a = await ilanArsiv.ilanKopieArsivle(+req.params.id, { grund: 'reddedildi', grundDetay: sebep || null, kaynak: 'admin', adminId: req.admin.id, ip: clientIp(req) });
    const u = (await db.query('SELECT user_id, uuid FROM ilanlar WHERE id=$1', [req.params.id])).rows[0];
    if (u) await olayLib.yaz({ userId: u.user_id, olay: 'ilan_reddedildi', hedefTip: 'ilan', hedefId: u.uuid, ip: null, userAgent: '', detay: { sebep: sebep || null, arsiv_id: a && a.arsiv_id } });
  } catch (e) { console.error('[reddet/arsiv]', e.message); }
  res.json({ mesaj: 'İlan reddedildi' });
});

// Entfernen durch den Admin (Kundenakte → İlanlar → Kaldır): derselbe Loeschweg wie
// beim Eigentuemer (lib/ilanArsiv.js) — 409 bei laufender Transaktion, Archiv, Meili, audit.
app.delete('/admin/api/ilanlar/:uuid', adminAuth, async (req, res) => {
  try {
    const sebep = String(req.body?.sebep || '').trim().slice(0, 500);
    if (!sebep) return res.status(400).json({ hata: 'Kaldırma sebebi zorunludur' });
    const r = await ilanArsiv.ilanSilVeArsivle({ uuid: req.params.uuid, grund: 'admin_kaldirdi', grundDetay: sebep,
      kaynak: 'admin', adminId: req.admin.id, ip: clientIp(req), audit: { kaynak: 'admin', adminId: req.admin.id } });
    if (!r.ok) return res.status(r.status).json({ hata: r.hata });
    await olayLib.yaz({ userId: r.user_id, olay: 'ilan_kaldirildi', hedefTip: 'ilan', hedefId: req.params.uuid, ip: null, userAgent: '', detay: { sebep, arsiv_id: r.arsiv_id } });
    res.json({ ok: true, arsiv_id: r.arsiv_id });
  } catch (e) { console.error('[admin/ilan-sil]', e.message); res.status(500).json({ hata: 'İlan kaldırılamadı' }); }
});

// ── ARŞİV (Auftragssammlung G): Snapshot + Bilder nur fuer angemeldete Admins ──
// <img> kann keinen Bearer-Header senden, deshalb tragen die Bild-Adressen ein
// kurzlebiges, signiertes Token (30 min) mit Sitzungs-ID; die Route prueft es und
// ob die Sitzung offen und nicht gesperrt ist.
function arsivDosyaUrl(req, id, n) {
  const t = jwt.sign({ k: 'arsiv', id: String(id), n: String(n), sid: req.admin.sid }, process.env.JWT_SECRET, { expiresIn: '30m' });
  return `arsiv/dosya/${id}/${n}?t=${encodeURIComponent(t)}`;
}
function arsivZeile(req, a) {
  const bilder = (a.bilder || []).map((b, n) => ({ url: b.arsiv ? arsivDosyaUrl(req, a.id, n) : b.url, arsivde: !!b.arsiv }));
  const video = a.video ? { url: a.video.arsiv ? arsivDosyaUrl(req, a.id, 'v') : a.video.url, arsivde: !!a.video.arsiv } : null;
  return { ...a, bilder, video };
}
app.get('/admin/api/arsiv/:id(\\d+)', adminAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM ilan_arsiv WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ hata: 'Arşiv kaydı yok' });
  res.json(arsivZeile(req, rows[0]));
});
app.get('/admin/api/arsiv/dosya/:id(\\d+)/:n', async (req, res) => {
  try {
    const d = jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET);
    if (d.k !== 'arsiv' || d.id !== req.params.id || d.n !== req.params.n) return res.status(403).end();
    const o = (await db.query('SELECT kapandi_at, kilitli, bitis FROM admin_oturumlar WHERE id=$1', [d.sid])).rows[0];
    if (!o || o.kapandi_at || o.kilitli || new Date(o.bitis) < new Date()) return res.status(401).end();
    const a = (await db.query('SELECT bilder, video FROM ilan_arsiv WHERE id=$1', [req.params.id])).rows[0];
    if (!a) return res.status(404).end();
    const e = req.params.n === 'v' ? a.video : (a.bilder || [])[+req.params.n];
    const p = e && ilanArsiv.dosyaYolu(e.arsiv);
    if (!p) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=600');
    res.sendFile(p);
  } catch { res.status(403).end(); }
});

// ── EMANET İŞLEM YÖNETİMİ ─────────────────────────────────────────────

app.get('/admin/api/islemler', adminAuth, async (req, res) => {
  const { durum, sayfa = 1, limit = 20 } = req.query;
  let where = durum ? `WHERE i.durum='${durum}'` : '';
  const { rows } = await db.query(
    `SELECT i.*, il.baslik, il.uuid as ilan_uuid,
            ua.email as alici_email, ua.ad as alici_ad,
            us.email as satici_email, us.ad as satici_ad
     FROM islemler i
     JOIN ilanlar il ON il.id=i.ilan_id
     JOIN users ua ON ua.id=i.alici_id
     JOIN users us ON us.id=i.satici_id
     ${where} ORDER BY i.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, (sayfa-1)*limit]
  );
  res.json(rows);
});

app.post('/admin/api/islemler/:uuid/iade', adminAuth, async (req, res) => {
  const { sebep } = req.body;
  await db.query("UPDATE islemler SET durum='iade' WHERE uuid=$1", [req.params.uuid]);
  const { rows } = await db.query('SELECT * FROM islemler WHERE uuid=$1', [req.params.uuid]);
  await auditAdmin('islem.iade', req.admin.id, { hedefTip:'islem', hedefId:rows[0]?.id, detay:{sebep} });
  res.json({ mesaj: 'İade işlendi' });
});

app.post('/admin/api/islemler/:uuid/onayla', adminAuth, async (req, res) => {
  await db.query("UPDATE islemler SET durum='tamamlandi' WHERE uuid=$1", [req.params.uuid]);
  const { rows } = await db.query('SELECT * FROM islemler WHERE uuid=$1', [req.params.uuid]);
  await auditAdmin('islem.admin_onayla', req.admin.id, { hedefTip:'islem', hedefId:rows[0]?.id });
  res.json({ mesaj: 'İşlem onaylandı, para aktarılıyor' });
});

// ── SUPPORT TİCKETLER ──────────────────────────────────────────────────

app.get('/admin/api/tickets', adminAuth, async (req, res) => {
  const { durum = 'acik', oncelik, sayfa = 1, limit = 20 } = req.query;
  let where = [`t.durum=$1`]; const params = [durum]; let p = 2;
  if (oncelik) { where.push(`t.oncelik=$${p++}`); params.push(oncelik); }
  params.push(limit, (sayfa-1)*limit);
  const { rows } = await db.query(
    `SELECT t.*, u.email, u.ad, u.soyad
     FROM support_tickets t JOIN users u ON u.id=t.user_id
     WHERE ${where.join(' AND ')} ORDER BY
     CASE t.oncelik WHEN 'acil' THEN 1 WHEN 'yuksek' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
     t.created_at ASC LIMIT $${p++} OFFSET $${p}`, params
  );
  res.json(rows);
});

app.post('/admin/api/tickets/:uuid/yanitla', adminAuth, async (req, res) => {
  const { metin, yeni_durum } = req.body;
  const { rows } = await db.query('SELECT * FROM support_tickets WHERE uuid=$1', [req.params.uuid]);
  if (!rows[0]) return res.status(404).json({ hata: 'Ticket bulunamadı' });
  await db.query(
    'INSERT INTO ticket_yanıtlar(ticket_id,gonderen_id,gonderen_tip,metin) VALUES($1,$2,$3,$4)',
    [rows[0].id, req.admin.id, 'admin', metin]
  );
  if (yeni_durum) await db.query('UPDATE support_tickets SET durum=$1,updated_at=NOW() WHERE id=$2', [yeni_durum, rows[0].id]);
  await auditAdmin('ticket.yanit', req.admin.id, { hedefTip:'ticket', hedefId:rows[0].id });
  res.json({ mesaj: 'Yanıt gönderildi' });
});

// ── KYC YÖNETİMİ ──────────────────────────────────────────────────────

app.get('/admin/api/kyc', adminAuth, async (req, res) => {
  const { durum = 'manuel_inceleme' } = req.query;
  const { rows } = await db.query(
    `SELECT k.*, u.email, u.ad, u.soyad, u.phone, u.musteri_no, u.cinsiyet, u.hesap_tipi, u.firma_adi FROM kyc_results k
     JOIN users u ON u.id=k.user_id WHERE k.durum=$1 ORDER BY k.created_at ASC`, [durum]
  );
  res.json(rows);
});

app.post('/admin/api/kyc/:id/onayla', adminAuth, async (req, res) => {
  await db.query("UPDATE kyc_results SET durum='onaylandi',manuel_onay_by=$1 WHERE id=$2", [req.admin.id, req.params.id]);
  await auditAdmin('kyc.manuel_onayla', req.admin.id, { hedefTip:'kyc', hedefId:+req.params.id });
  res.json({ mesaj: 'KYC onaylandı' });
});
// Reddet — die KYC-Seite rief diesen Endpunkt schon immer auf, er fehlte (404).
app.post('/admin/api/kyc/:id/reddet', adminAuth, async (req, res) => {
  const sebep = String(req.body?.sebep || '').trim().slice(0, 500) || null;
  await db.query("UPDATE kyc_results SET durum='reddedildi', red_sebebi=COALESCE($1,red_sebebi), manuel_onay_by=$2, updated_at=NOW() WHERE id=$3", [sebep, req.admin.id, req.params.id]);
  await auditAdmin('kyc.manuel_reddet', req.admin.id, { hedefTip:'kyc', hedefId:+req.params.id, detay:{ sebep } });
  res.json({ mesaj: 'KYC reddedildi' });
});

// ── AUDIT LOG ──────────────────────────────────────────────────────────

app.get('/admin/api/audit', adminAuth, async (req, res) => {
  const { limit = 50, olay } = req.query;
  let where = olay ? `WHERE olay ILIKE '%${olay}%'` : '';
  const { rows } = await db.query(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $1`, [limit]);
  res.json(rows);
});

// ── MESAJ GÖRÜNTÜLEME (Support) ────────────────────────────────────────

app.get('/admin/api/mesajlar/tehlikeli', adminAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.*, k.ilan_id, il.baslik as ilan_baslik,
            ug.email as gonderen_email, ug.musteri_no as gonderen_no, ug.cinsiyet as gonderen_cinsiyet, ug.hesap_tipi as gonderen_tip, ug.ad as gonderen_ad, ug.soyad as gonderen_soyad
     FROM mesajlar m
     JOIN konusmalar k ON k.id=m.konusma_id
     JOIN ilanlar il ON il.id=k.ilan_id
     JOIN users ug ON ug.id=m.gonderen_id
     WHERE m.tehlikeli=true ORDER BY m.created_at DESC LIMIT 50`
  );
  res.json(rows);
});

// ── BAU: Version + Git-Kurz-Hash (oeffentlich, auch fuer die Login-Seite) ──
// deploy.sh committet NACH dem Neuladen der Dienste — der Hash wird deshalb
// nicht beim Start, sondern bei Bedarf gelesen (60 s zwischengespeichert).
let _bau = { at: 0, commit: '' };
const bauLesen = () => new Promise((ok) => {
  if (Date.now() - _bau.at < 60000) return ok(_bau);
  require('child_process').execFile('git', ['-C', path.join(__dirname, '..'), 'rev-parse', '--short', 'HEAD'],
    { timeout: 3000 }, (e, out) => { _bau = { at: Date.now(), commit: e ? '' : String(out).trim() }; ok(_bau); });
});
app.get('/admin/api/bau', async (req, res) => {
  await bauLesen();
  res.json({ version: APP_VERSION, commit: _bau.commit, ortam: process.env.KAPBENI_ORTAM === 'prod' ? 'prod' : 'staging' });
});

// ── SIDEBAR-ZAEHLER (Klammern hinter den Menuepunkten) ───────────────────
app.get('/admin/api/sidebar-sayac', adminAuth, async (req, res) => {
  const z = async (sql) => { try { return (await db.query(sql)).rows[0].c; } catch { return null; } };
  const [ilanonay, riskmesaj, kyc, kurumsalonay, destek, ilansikayet] = await Promise.all([
    z("SELECT count(*)::int c FROM ilanlar WHERE ilan_durum='moderasyonda'"),
    z("SELECT count(*)::int c FROM mesajlar WHERE tehlikeli=true"),
    z("SELECT count(*)::int c FROM kyc_results WHERE durum='manuel_inceleme'"),
    z("SELECT count(*)::int c FROM users WHERE hesap_tipi='kurumsal' AND kurumsal_onaylandi=false"),
    z("SELECT count(*)::int c FROM destek_talepleri WHERE durum='acik'"),
    z("SELECT count(*)::int c FROM sikayet WHERE COALESCE(durum,'beklemede') IN ('beklemede','acik','yeni')"),
  ]);
  res.json({ ilanonay, riskmesaj, kyc, kurumsalonay, destek, ilansikayet });
});

// ── HEALTH ────────────────────────────────────────────────────────────

app.get('/admin/health', (req, res) => res.json({ durum: 'ok', servis: 'admin' }));


// ═══ AUFGABE 9: Erweiterte Admin-Endpunkte ═══
const { exec } = require('child_process');
const os = require('os');

// Dashboard-Stats erweitert
app.get('/admin/api/dashboard/stats', adminAuth, async (req,res)=>{
  try{
    const q=async(sql)=> (await db.query(sql)).rows[0].c;
    res.json({
      bugun_yeni_kullanici: await q("SELECT count(*)::int c FROM users WHERE created_at::date=CURRENT_DATE"),
      yeni_ilan: await q("SELECT count(*)::int c FROM ilanlar WHERE created_at::date=CURRENT_DATE"),
      aktif_ilan: await q("SELECT count(*)::int c FROM ilanlar WHERE ilan_durum='aktif'"),
      bekleyen_onay: await q("SELECT count(*)::int c FROM ilanlar WHERE ilan_durum='moderasyonda'"),
      acik_destek: await q("SELECT count(*)::int c FROM destek_talepleri WHERE durum='acik'"),
      toplam_kullanici: await q("SELECT count(*)::int c FROM users"),
    });
  }catch(e){ res.status(500).json({hata:e.message}); }
});
app.get('/admin/api/dashboard/servisler', adminAuth, (req,res)=>{
  const svc=['nginx','postgresql','redis-server'];
  const out={};
  let done=0;
  svc.forEach(sv=> exec(`systemctl is-active ${sv}`,(e,so)=>{ out[sv]=so.trim()||'inactive'; if(++done===svc.length){ out.node='active'; out.pm2='active'; res.json(out);} }));
});
app.get('/admin/api/dashboard/metrics', adminAuth, (req,res)=>{
  const ram=Math.round((1-os.freemem()/os.totalmem())*100);
  res.json({ cpu: Math.round(os.loadavg()[0]*100)/100, ram, uptime: Math.round(os.uptime()) });
});
app.get('/admin/api/dashboard/loglar', adminAuth, (req,res)=>{
  exec("tail -n 40 /var/log/kapbeni/api-out.log 2>/dev/null || echo ''",(e,so)=>res.json({loglar:(so||'').split('\n').slice(-40)}));
});

// Kullanıcılar Liste (Filter)
app.get('/admin/api/kullanicilar', adminAuth, async (req,res)=>{
  const {q,durum}=req.query;
  const cond=[]; const p=[]; let i=1;
  if(q){ cond.push(`(ad ILIKE $${i} OR soyad ILIKE $${i} OR email ILIKE $${i} OR kullanici_no ILIKE $${i})`); p.push('%'+q+'%'); i++; }
  if(durum && durum!=='tumu'){ cond.push(`durum=$${i}`); p.push(durum); i++; }
  const w=cond.length?`WHERE ${cond.join(' AND ')}`:'';
  const {rows}=await db.query(`SELECT id,kullanici_no,ad,soyad,email,durum,rol,hesap_tipi,created_at,
    (SELECT count(*) FROM ilanlar WHERE user_id=users.id)::int ilan_sayisi FROM users ${w} ORDER BY id DESC LIMIT 200`,p);
  const kpi=(await db.query("SELECT count(*)::int toplam, count(*) FILTER(WHERE durum='aktif')::int aktif, count(*) FILTER(WHERE durum='parked')::int park FROM users")).rows[0];
  res.json({ kullanicilar:rows, kpi });
});
app.get('/admin/api/kullanicilar/:id', adminAuth, async (req,res)=>{
  const {rows}=await db.query('SELECT * FROM users WHERE id=$1',[req.params.id]);
  if(!rows[0]) return res.status(404).json({hata:'Yok'});
  delete rows[0].password_hash;
  const ilan=(await db.query('SELECT count(*)::int c FROM ilanlar WHERE user_id=$1',[req.params.id])).rows[0].c;
  const giris=(await db.query('SELECT count(*)::int c FROM kullanici_girisler WHERE user_id=$1',[req.params.id])).rows[0].c;
  const risk=(await db.query('SELECT count(*)::int c FROM risk_bayraklari WHERE kullanici_id=$1',[req.params.id])).rows[0].c;
  res.json({ ...rows[0], ilan_sayisi:ilan, giris_sayisi:giris, risk_sayisi:risk });
});
app.get('/admin/api/kullanicilar/:id/girisler', adminAuth, async (req,res)=>{
  res.json((await db.query('SELECT * FROM kullanici_girisler WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.params.id])).rows);
});
app.get('/admin/api/kullanicilar/:id/ilanlar', adminAuth, async (req,res)=>{
  res.json((await db.query('SELECT id,uuid,baslik,fiyat,ilan_durum,created_at FROM ilanlar WHERE user_id=$1 ORDER BY id DESC',[req.params.id])).rows);
});
const setDurum=(durum)=>async(req,res)=>{ await db.query('UPDATE users SET durum=$1 WHERE id=$2',[durum,req.params.id]); await auditAdmin('user.'+durum,req.admin.id,{hedefTip:'user',hedefId:+req.params.id}); res.json({ok:true}); };
app.put('/admin/api/kullanicilar/:id/parkla', adminAuth, setDurum('parked'));
app.put('/admin/api/kullanicilar/:id/askiya-al', adminAuth, setDurum('askida'));
app.put('/admin/api/kullanicilar/:id/banla', adminAuth, setDurum('banli'));
app.put('/admin/api/kullanicilar/:id/aktifles', adminAuth, setDurum('aktif'));
app.put('/admin/api/kullanicilar/:id/e-devlet', adminAuth, async (req,res)=>{ await db.query("UPDATE users SET e_devlet_dogrulandi=true,e_devlet_dogrulama_tarihi=NOW(),satici_dogrulama='dogrulandi' WHERE id=$1",[req.params.id]); res.json({ok:true}); });
app.post('/admin/api/kullanicilar/:id/not', adminAuth, async (req,res)=>{ await db.query('INSERT INTO admin_kullanici_notlar(kullanici_id,admin_id,not_metni) VALUES($1,$2,$3)',[req.params.id,req.admin.id,req.body.not]); res.json({ok:true}); });
app.post('/admin/api/kullanicilar/:id/risk-bayrak', adminAuth, async (req,res)=>{ await db.query('INSERT INTO risk_bayraklari(kullanici_id,tip,aciklama,admin_id) VALUES($1,$2,$3,$4)',[req.params.id,req.body.tip,req.body.aciklama,req.admin.id]); res.json({ok:true}); });

// Şikayetler
app.get('/admin/api/sikayetler', adminAuth, async (req,res)=>{
  res.json((await db.query(`SELECT s.*, i.baslik FROM ilan_sikayetler s LEFT JOIN ilanlar i ON i.id=s.ilan_id ORDER BY s.id DESC LIMIT 100`)).rows);
});
// Destek (Admin)
app.get('/admin/api/destek', adminAuth, async (req,res)=>{
  res.json((await db.query(`SELECT t.*, u.ad,u.soyad,(SELECT count(*) FROM destek_mesajlar WHERE talep_id=t.id)::int mesaj_sayisi
    FROM destek_talepleri t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 100`)).rows);
});
app.get('/admin/api/destek/:id', adminAuth, async (req,res)=>{
  const t=(await db.query('SELECT * FROM destek_talepleri WHERE id=$1',[req.params.id])).rows[0];
  const m=(await db.query('SELECT * FROM destek_mesajlar WHERE talep_id=$1 ORDER BY id',[req.params.id])).rows;
  res.json({...t, mesajlar:m});
});
app.post('/admin/api/destek/:id/yanit', adminAuth, async (req,res)=>{
  await db.query('INSERT INTO destek_mesajlar(talep_id,gonderen_id,icerik) VALUES($1,$2,$3)',[req.params.id,req.admin.id,req.body.icerik]);
  await db.query("UPDATE destek_talepleri SET durum=COALESCE($1,durum),guncelleme_tarihi=NOW() WHERE id=$2",[req.body.durum||null,req.params.id]);
  res.json({ok:true});
});
// Ödemeler
app.get('/admin/api/odemeler', adminAuth, async (req,res)=>{
  res.json((await db.query(`SELECT o.*, u.ad,u.soyad FROM odemeler o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 100`)).rows);
});
// Kategoriler/Slider/Vitaminler (Verwaltung, read)
app.get('/admin/api/slider', adminAuth, async (req,res)=>{ res.json((await db.query('SELECT * FROM hero_slider ORDER BY sira')).rows); });
app.get('/admin/api/vitaminler', adminAuth, async (req,res)=>{ res.json((await db.query('SELECT * FROM vitamin_paketler ORDER BY id')).rows); });



// ── ENTEGRASYONLAR (ersetzt „API Bağlantılar“, v1.16) ─────────────────
// Konfiguration und Tests liegen in api/src/lib/entegrasyon.js (gemeinsam mit der API).
const nurSuperAdmin = (req, res, next) => req.admin?.rol === 'super_admin' ? next()
  : res.status(403).json({ hata: 'Bu işlem yalnız süper admin içindir' });

// Alte Endpunkte leiten weiter bzw. sind ersetzt.
app.get('/admin/api/api-durum', (req, res) => res.redirect(308, 'entegrasyonlar'));
app.get('/admin/api/api-test', (req, res) => res.status(410).json({ hata: 'Ersetzt durch POST /admin/api/entegrasyonlar/:provider/test' }));

app.get('/admin/api/entegrasyonlar', adminAuth, async (req, res) => {
  try {
    const [liste, mail] = await Promise.all([entegrasyon.listeMaskeli(), entegrasyon.mailKanal()]);
    res.json({ ortam: entegrasyon.ORTAM, mail_kanali: mail.kanal, sifreleme: /^[0-9a-f]{64}$/i.test(process.env.INTEGRATION_ENCRYPTION_KEY || ''),
      duzenleyebilir: req.admin.rol === 'super_admin', entegrasyonlar: liste });
  } catch (e) { console.error('[entegrasyonlar]', e.message); res.status(500).json({ hata: 'Entegrasyonlar okunamadı' }); }
});
app.get('/admin/api/entegrasyonlar/claude/modeller', adminAuth, async (req, res) => {
  try { res.json(await entegrasyon.claudeModeller()); }
  catch (e) { res.status(502).json({ hata: 'Model listesi alınamadı: ' + String(e.message).slice(0, 120) }); }
});
app.post('/admin/api/entegrasyonlar/:provider', adminAuth, nurSuperAdmin, async (req, res) => {
  try {
    const { mod, degerler } = req.body || {};
    await entegrasyon.kaydet(req.params.provider, { mod, degerler: degerler || {} }, req.admin.id);
    // Im audit_log nur Feldnamen, nie Werte.
    const geaendert = Object.entries(degerler || {}).filter(([, v]) => v != null && String(v) !== '' && !String(v).startsWith('••••')).map(([k]) => k);
    await auditAdmin('entegrasyon.kaydet', req.admin.id, { hedefTip: 'entegrasyon', detay: { provider: req.params.provider, mod, alanlar: geaendert, ip: clientIp(req) } });
    const liste = await entegrasyon.listeMaskeli();
    res.json({ ok: true, entegrasyon: liste.find((x) => x.key === req.params.provider) });
  } catch (e) { res.status(e.status || 500).json({ hata: e.status ? e.message : 'Kaydedilemedi' }); if (!e.status) console.error('[entegrasyon.kaydet]', e.message); }
});
app.post('/admin/api/entegrasyonlar/:provider/test', adminAuth, nurSuperAdmin, async (req, res) => {
  try {
    const r = await entegrasyon.test(req.params.provider, req.admin.id);
    await auditAdmin('entegrasyon.test', req.admin.id, { hedefTip: 'entegrasyon', detay: { provider: req.params.provider, sonuc: r.sonuc } });
    res.json(r);
  } catch (e) { res.status(e.status || 500).json({ hata: e.status ? e.message : 'Test çalıştırılamadı' }); if (!e.status) console.error('[entegrasyon.test]', e.message); }
});


// ═══ OVERNIGHT: Yeni Admin Sektionları (additiv, /admin/api/... + db pool) ═══
// Not: Ana API /api/... rotaları yalnızca kaynak='api' token kabul eder;
// admin panelin token'ı kaynak='admin' olduğundan burada kendi rotalarımızı
// tanımlıyoruz ve doğrudan aynı Postgres pool üzerinden sorguluyoruz.

// ── İLANLAR (Yayın durumu / Ampel) ─────────────────────────────────────
app.get('/admin/api/ilanlar-yayin', adminAuth, async (req, res) => {
  try {
    const { durum } = req.query;
    const params = []; let where = '';
    if (durum && durum !== 'all') { params.push(durum); where = 'WHERE i.yayin_durum = $1'; }
    const { rows } = await db.query(
      `SELECT i.uuid, i.ilan_no, i.baslik, i.fiyat, i.yayin_durum, i.sikayet_sayisi,
              i.son_gecerlilik, i.created_at, k.ad as satici_ad
       FROM ilanlar i LEFT JOIN users k ON k.id=i.user_id ${where}
       ORDER BY i.created_at DESC LIMIT 200`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.patch('/admin/api/ilanlar-yayin/:uuid/durum', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE ilanlar SET yayin_durum=$1 WHERE uuid=$2', [req.body.durum, req.params.uuid]);
    await auditAdmin('ilan.yayin_durum', req.admin.id, { hedefTip:'ilan', detay:{uuid:req.params.uuid, durum:req.body.durum} });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── İLAN ŞİKAYETLERİ ───────────────────────────────────────────────────
app.get('/admin/api/ilan-sikayet', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, k.ad as sikayet_eden_ad, k.musteri_no as eden_no, k.cinsiyet as eden_cinsiyet, k.hesap_tipi as eden_tip,
              i.baslik as ilan_baslik, i.ilan_no, sa.musteri_no as satici_no, sa.cinsiyet as satici_cinsiyet, sa.hesap_tipi as satici_tip,
              sa.ad as satici_ad, sa.soyad as satici_soyad
       FROM sikayet s LEFT JOIN users k ON k.id=s.sikayet_eden
       LEFT JOIN ilanlar i ON i.uuid=s.ilan_uuid LEFT JOIN users sa ON sa.id=i.user_id ORDER BY s.created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.patch('/admin/api/ilan-sikayet/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE sikayet SET durum=$1 WHERE id=$2', [req.body.durum, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── DEĞERLENDİRMELER ───────────────────────────────────────────────────
app.get('/admin/api/degerlendirme', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, k1.ad as degerlendiren_ad, k2.ad as degerlendirilen_ad
       FROM degerlendirmeler d JOIN users k1 ON k1.id=d.degerlendiren
       JOIN users k2 ON k2.id=d.degerlendirilen ORDER BY d.created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.patch('/admin/api/degerlendirme/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE degerlendirmeler SET durum=$1 WHERE id=$2', [req.body.durum, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── SUPPORT TICKETS (admin_cevap → e-posta tetikleyici) ────────────────
app.get('/admin/api/support-tickets', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.patch('/admin/api/support-tickets/:id', adminAuth, async (req, res) => {
  try {
    const { admin_cevap, durum } = req.body;
    await db.query('UPDATE support_tickets SET admin_cevap=COALESCE($1,admin_cevap), durum=COALESCE($2,durum), updated_at=NOW() WHERE id=$3',
      [admin_cevap ?? null, durum ?? null, req.params.id]);
    if (admin_cevap) {
      try {
        // mailer liegt im Nachbarpaket api/; dessen eigenes require('nodemailer')
        // wird relativ zum Modul selbst aufgeloest und findet api/node_modules.
        const { sendMail } = require('../api/src/utils/mailer');
        const t = await db.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
        if (t.rows[0]?.email) await sendMail({
          to: t.rows[0].email,
          subject: `Destek Talebiniz Yanıtlandı – ${t.rows[0].ticket_no}`,
          html: `<p>Merhaba,</p><p>Talebiniz (${t.rows[0].ticket_no}) yanıtlandı:</p><p><em>${admin_cevap}</em></p><p>Kap Beni Destek</p>`
        });
      } catch (mailErr) { console.error('ticket mail hatası:', mailErr.message); }
    }
    await auditAdmin('ticket.yanit', req.admin.id, { hedefTip:'ticket', hedefId:+req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── ÖNERİLER ───────────────────────────────────────────────────────────
app.get('/admin/api/oneriler', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, k.ad as kullanici_ad FROM oneriler o
       LEFT JOIN users k ON k.id=o.kullanici_id ORDER BY o.created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── WHATSAPP AYARLARI (aktif + online/offline durum toggle) ────────────
app.get('/admin/api/whatsapp-ayar', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT aktif, telefon, api_key, durum FROM whatsapp_ayar LIMIT 1');
    res.json(rows[0] || { aktif:false, telefon:'', api_key:'', durum:'offline' });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.patch('/admin/api/whatsapp-ayar', adminAuth, async (req, res) => {
  try {
    const { aktif, telefon, api_key, durum } = req.body;
    const ex = await db.query('SELECT id FROM whatsapp_ayar LIMIT 1');
    if (ex.rows.length) {
      await db.query('UPDATE whatsapp_ayar SET aktif=COALESCE($1,aktif), telefon=COALESCE($2,telefon), api_key=COALESCE($3,api_key), durum=COALESCE($4,durum) WHERE id=$5',
        [aktif, telefon, api_key, durum, ex.rows[0].id]);
    } else {
      await db.query('INSERT INTO whatsapp_ayar (aktif,telefon,api_key,durum) VALUES($1,$2,$3,$4)',
        [aktif, telefon, api_key, durum || 'offline']);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── KURUMSAL ONAY BEKLEYENLER ──────────────────────────────────────────
app.get('/admin/api/kurumsal-bekleyenler', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, ad, soyad, email, firma_adi, vkn, vergi_dairesi, mersis_no, ticari_adres, yetkili_kisi, sektor, created_at, musteri_no, cinsiyet, hesap_tipi
       FROM users WHERE hesap_tipi='kurumsal' AND kurumsal_onaylandi=false ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.patch('/admin/api/kurumsal-onayla/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE users SET kurumsal_onaylandi=$1 WHERE id=$2', [req.body.onay, req.params.id]);
    await auditAdmin('kurumsal.onay', req.admin.id, { hedefTip:'user', hedefId:+req.params.id, detay:{onay:req.body.onay} });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── PAKETLER CRUD ──────────────────────────────────────────────────────
app.get('/admin/api/paketler', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM paketler ORDER BY hesap_tipi, fiyat');
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.post('/admin/api/paketler', adminAuth, async (req, res) => {
  try {
    const { isim, fiyat, ilan_hakki, sure_gun, hesap_tipi, aktif } = req.body;
    if (!isim) return res.status(400).json({ hata: 'İsim zorunlu' });
    const { rows } = await db.query(
      `INSERT INTO paketler (isim,fiyat,ilan_hakki,sure_gun,hesap_tipi,aktif)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [isim, fiyat||0, ilan_hakki||0, sure_gun||30, hesap_tipi||'bireysel', aktif!==false]);
    await auditAdmin('paket.ekle', req.admin.id, { hedefTip:'paket', hedefId:rows[0].id });
    res.json({ ok: true, paket: rows[0] });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.put('/admin/api/paketler/:id', adminAuth, async (req, res) => {
  try {
    const { isim, fiyat, ilan_hakki, sure_gun, hesap_tipi, aktif } = req.body;
    const fields = []; const vals = []; let i = 1;
    if (isim !== undefined)       { fields.push(`isim=$${i++}`);       vals.push(isim); }
    if (fiyat !== undefined)      { fields.push(`fiyat=$${i++}`);      vals.push(fiyat); }
    if (ilan_hakki !== undefined) { fields.push(`ilan_hakki=$${i++}`); vals.push(ilan_hakki); }
    if (sure_gun !== undefined)   { fields.push(`sure_gun=$${i++}`);   vals.push(sure_gun); }
    if (hesap_tipi !== undefined) { fields.push(`hesap_tipi=$${i++}`); vals.push(hesap_tipi); }
    if (aktif !== undefined)      { fields.push(`aktif=$${i++}`);      vals.push(aktif); }
    if (!fields.length) return res.status(400).json({ hata: 'Alan yok' });
    vals.push(req.params.id);
    await db.query(`UPDATE paketler SET ${fields.join(',')} WHERE id=$${i}`, vals);
    await auditAdmin('paket.guncelle', req.admin.id, { hedefTip:'paket', hedefId:+req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── KUPONLAR CRUD (paket_kuponlari) ────────────────────────────────────
app.get('/admin/api/paket-kuponlari', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM paket_kuponlari ORDER BY id DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});
app.post('/admin/api/paket-kuponlari', adminAuth, async (req, res) => {
  try {
    const { kod, indirim_tipi, indirim_degeri, gecerlilik_bitis, kullanim_limiti, aktif } = req.body;
    if (!kod || indirim_degeri == null) return res.status(400).json({ hata: 'Kod ve indirim değeri zorunlu' });
    await db.query(
      `INSERT INTO paket_kuponlari (kod,indirim_tipi,indirim_degeri,gecerlilik_bitis,kullanim_limiti,aktif)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [kod, indirim_tipi||'yuzde', indirim_degeri, gecerlilik_bitis||null, kullanim_limiti||null, aktif!==false]);
    await auditAdmin('kupon.ekle', req.admin.id, { hedefTip:'kupon', detay:{kod} });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ hata: 'Bu kod zaten kullanılıyor' });
    res.status(500).json({ hata: e.message });
  }
});
app.put('/admin/api/paket-kuponlari/:id/toggle', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE paket_kuponlari SET aktif = NOT aktif WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ hata: e.message }); }
});

// ── ABONELİKLER (liste) ────────────────────────────────────────────────
app.get('/admin/api/abonelikler', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.*, k.ad as kullanici_ad, k.email, p.isim as paket_isim
       FROM abonelikler a JOIN users k ON k.id=a.kullanici_id
       JOIN paketler p ON p.id=a.paket_id ORDER BY a.created_at DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ hata: e.message }); }
});


// ── MÜŞTERİLER: Kundenliste + Kundenakte (v1.25/v1.26, admin/musteri.js) ──
require('./musteri')(app, { db, adminAuth, auditAdmin, clientIp, arsivZeile, olayLib });

// ── ADMIN UI (Single Page) ─────────────────────────────────────────────

app.get('/admin*', (req, res) => {
  if (req.path.startsWith('/admin/api')) return res.status(404).json({ hata: 'Endpoint yok' });
  // Statt sendFile: die Seite wird gelesen, damit die Versionsnummer aus
  // VERSION eingesetzt werden kann. Schlaegt das Lesen fehl, wird die Datei
  // wie zuvor unveraendert ausgeliefert — die Oberflaeche faellt nie aus.
  const datei = path.join(__dirname, 'public', 'index.html');
  fs.readFile(datei, 'utf8', (err, html) => {
    if (err) return res.sendFile(datei);
    // KAPBENI_ORTAM: 'staging' (Standard) oder 'prod' -> steuert das Staging-Banner.
    const ortam = process.env.KAPBENI_ORTAM === 'prod' ? 'prod' : 'staging';
    res.type('html').send(html.split('__APP_VERSION__').join(APP_VERSION).split('__APP_ORTAM__').join(ortam));
  });
});

const PORT = process.env.ADMIN_PORT || 3002;
app.listen(PORT, () => console.log(`✓ kapbeni Admin Port ${PORT}`));
