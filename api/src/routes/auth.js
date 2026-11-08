const router = require('express').Router();
const { girisKaydet } = require('../services/geoService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, auditLog } = require('../db/pool');
require('dotenv').config({ path: '/etc/kapbeni.env' });
const { telefonNormalize, vergiNoGecerli, TELEFON_HATA, VKN_HATA } = require('../lib/dogrula');
const hesapSilme = require('../lib/hesapSilme');
const entegrasyon = require('../lib/entegrasyon');

// Turnstile (Admin → Entegrasyonlar): live = siteverify, test/disabled = keine Pruefung.
async function turnstileKontrol(req, res) {
  const r = await entegrasyon.turnstileDogrula(req.body?.turnstile, req.headers['x-real-ip'] || req.ip);
  if (r.ok) return true;
  res.status(400).json({ hata: r.hata || 'Güvenlik doğrulaması başarısız', alan: 'turnstile' });
  return false;
}

// Oeffentlich: Turnstile-Site-Key und Google-Status fuer AuthModal (keine Geheimnisse).
router.get('/yapilandirma', async (req, res) => {
  let turnstile = { aktif: false, mod: 'disabled', siteKey: null }, google = { aktif: false };
  try { turnstile = await entegrasyon.turnstileGenel(); } catch {}
  try { google = { aktif: !!(await entegrasyon.googleAyar('musteri')) }; } catch {}
  res.json({ turnstile, google });
});

const token = (user) => jwt.sign(
  { id: user.id, uuid: user.uuid, rol: user.rol, kaynak: 'api' },
  process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN }
);

// Gemeinsamer Kern fuer Bireysel- und Kurumsal-Registrierung.
// Telefon wird hier auf E.164 gebracht (lib/dogrula.js) — vorher landete jede
// Schreibweise ungeprueft in users.phone, und der Dublettencheck verglich roh.
async function kayitOlustur(req, res, ekstra = {}) {
  const { email, phone, password, ad, soyad, sehir, ilce } = req.body;
  if (!email || !phone || !password) return res.status(400).json({ hata: 'Gerekli alanlar eksik' });
  const np = telefonNormalize(phone);
  if (!np) return res.status(400).json({ hata: TELEFON_HATA, alan: 'phone' });
  const mail = String(email).trim().toLowerCase();
  const mevcut = await query('SELECT id FROM users WHERE lower(email)=$1 OR phone=$2', [mail, np]);
  if (mevcut.rows[0]) return res.status(409).json({ hata: 'Email veya telefon zaten kayıtlı' });
  const hash = await bcrypt.hash(password, 12);
  const sp = Object.keys(ekstra);
  const { rows } = await query(
    `INSERT INTO users(email,phone,password_hash,ad,soyad,sehir,ilce${sp.map(k => ',' + k).join('')})
     VALUES($1,$2,$3,$4,$5,$6,$7${sp.map((_, i) => ',$' + (8 + i)).join('')}) RETURNING *`,
    [mail, np, hash, ad, soyad, sehir, ilce, ...sp.map(k => ekstra[k])]
  );
  // musteri_no (KP-JJJJ-NNNNNNN) vergibt der DB-Trigger trg_musteri_no beim INSERT.
  await auditLog('user.kayit', 'api', { userId: rows[0].id, ip: req.ip, detay: ekstra.hesap_tipi ? { hesap_tipi: ekstra.hesap_tipi } : undefined });
  await query("UPDATE users SET kullanici_no='SG-'||LPAD(id::TEXT,8,'0') WHERE id=$1",[rows[0].id]);
  girisKaydet(query, rows[0].id, req, true);
  res.status(201).json({ token: token(rows[0]),
    user: { id: rows[0].id, email: mail, ad, soyad, musteri_no: rows[0].musteri_no || null } });
}

// Kayıt
router.post('/kayit', async (req, res) => {
  try { if (!await turnstileKontrol(req, res)) return; await kayitOlustur(req, res); }
  catch(e) { console.error('[auth/kayit]', e.message); res.status(500).json({ hata: 'Kayıt olunamadı. Lütfen tekrar deneyin.' }); }
});

// Kurumsal kayıt — AuthModal rief diese Route schon auf, sie fehlte aber (404).
// VKN (10) oder TCKN (11, Şahıs şirketi) mit Pruefziffer.
router.post('/kurumsal-kayit', async (req, res) => {
  try {
    if (!await turnstileKontrol(req, res)) return;
    const b = req.body || {};
    const vkn = String(b.vkn || '').replace(/\D/g, '');
    if (!String(b.firma_adi || '').trim()) return res.status(400).json({ hata: 'Firma adı zorunludur.', alan: 'firma_adi' });
    if (!vergiNoGecerli(vkn)) return res.status(400).json({ hata: VKN_HATA, alan: 'vkn' });
    const mersis = String(b.mersis_no || '').replace(/\D/g, '');
    if (mersis && mersis.length !== 16) return res.status(400).json({ hata: 'MERSİS No 16 haneli olmalıdır.', alan: 'mersis_no' });
    const yetkili = String(b.yetkili_kisi || '').trim();
    // Name des Ansprechpartners als ad/soyad uebernehmen, damit Listen nicht leer sind.
    const teile = yetkili.split(/\s+/).filter(Boolean);
    req.body.ad = req.body.ad || teile.slice(0, -1).join(' ') || teile[0] || null;
    req.body.soyad = req.body.soyad || (teile.length > 1 ? teile[teile.length - 1] : null);
    await kayitOlustur(req, res, {
      hesap_tipi: 'kurumsal', firma_adi: String(b.firma_adi).trim().slice(0, 255), vkn,
      vergi_dairesi: String(b.vergi_dairesi || '').trim().slice(0, 120) || null,
      mersis_no: mersis || null, yetkili_kisi: yetkili.slice(0, 255) || null,
      sektor: String(b.sektor || '').trim().slice(0, 100) || null,
      ticari_adres: String(b.ticari_adres || '').trim() || null,
    });
  } catch(e) { console.error('[auth/kurumsal-kayit]', e.message); res.status(500).json({ hata: 'Kurumsal kayıt olunamadı. Lütfen tekrar deneyin.' }); }
});

// Giriş
router.post('/giris', async (req, res) => {
  try {
    if (!await turnstileKontrol(req, res)) return;
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE lower(email)=lower($1)', [String(email || '').trim()]);
    if (!rows[0] || rows[0].durum === 'silindi') return res.status(401).json({ hata: 'Kullanıcı bulunamadı' });
    // silme_bekliyor darf sich anmelden — die Anmeldung widerruft den Antrag (s. u.).
    if (!['aktif', 'silme_bekliyor'].includes(rows[0].durum))
      return res.status(403).json({ hata: 'Hesabınız askıya alındı', sebep: rows[0].ban_sebebi });
    if (!await bcrypt.compare(password, rows[0].password_hash))
      return res.status(401).json({ hata: 'Şifre hatalı' });
    // Auftragssammlung H: Anmeldung innerhalb der 30 Tage hebt die Loeschung auf.
    let bilgi = null;
    if (rows[0].durum === 'silme_bekliyor' && await hesapSilme.silmeIptal(rows[0].id, { ip: req.ip })) {
      bilgi = 'Hesap silme talebiniz iptal edildi. Hesabınız ve ilanlarınız yeniden aktif.';
    }
    await auditLog('user.giris', 'api', { userId: rows[0].id, ip: req.ip });
    girisKaydet(query, rows[0].id, req, true);
    res.json({ token: token(rows[0]), bilgi, silme_iptal: !!bilgi,
      user: { id: rows[0].id, email: rows[0].email, ad: rows[0].ad, musteri_no: rows[0].musteri_no } });
  } catch(e) { res.status(500).json({ hata: e.message }); }
});

// Profil (token ile)
router.get('/ben', require('../middleware/auth').authMiddleware, async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, k.durum as kyc_durum FROM users u
     LEFT JOIN kyc_results k ON k.user_id=u.id AND k.id=(SELECT MAX(id) FROM kyc_results WHERE user_id=u.id)
     WHERE u.id=$1`, [req.user.id]
  );
  const u = rows[0];
  delete u.password_hash;
  res.json(u);
});

// ── Google ile giriş (Geruest, v1.21) ────────────────────────────────────
// Freigegeben nur, wenn Admin → Entegrasyonlar → „Google ile Giriş (Müşteri)“ live
// und vollstaendig ist. Bis dahin 404. Neue Konten bekommen ihre musteri_no vom
// DB-Trigger trg_musteri_no. OFFEN (Burak): users.phone ist NOT NULL — Google liefert
// keine Telefonnummer; vorlaeufig Platzhalter „g-<hash>“, Abfrage nach dem ersten Login fehlt noch.
router.get('/google/baslat', async (req, res) => {
  const cfg = await entegrasyon.googleAyar('musteri').catch(() => null);
  if (!cfg) return res.status(404).json({ hata: 'Google ile giriş henüz aktif değil' });
  const state = jwt.sign({ t: 'google-musteri', n: require('crypto').randomBytes(8).toString('hex') }, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.redirect(entegrasyon.googleAuthUrl(cfg, state));
});
router.get('/google/callback', async (req, res) => {
  const cfg = await entegrasyon.googleAyar('musteri').catch(() => null);
  if (!cfg) return res.status(404).json({ hata: 'Google ile giriş henüz aktif değil' });
  const geri = (h) => res.redirect('/#/' + h);
  try {
    const st = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (st.t !== 'google-musteri') throw new Error('state');
    const g = await entegrasyon.googleCodeTausch(cfg, req.query.code);
    let { rows } = await query('SELECT * FROM users WHERE google_id=$1 OR lower(email)=$2 ORDER BY (google_id=$1) DESC LIMIT 1', [g.sub, g.email]);
    let u = rows[0];
    if (u && !['aktif', 'silme_bekliyor'].includes(u.durum)) return geri('?giris_hata=hesap');
    if (!u) {
      const ph = 'g-' + require('crypto').createHash('sha1').update(g.sub).digest('hex').slice(0, 17);
      const hash = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 12);
      ({ rows } = await query(
        `INSERT INTO users(email,phone,password_hash,ad,soyad,google_id,email_dogrulandi) VALUES($1,$2,$3,$4,$5,$6,true) RETURNING *`,
        [g.email, ph, hash, g.ad, g.soyad, g.sub]));
      u = rows[0];
      await query("UPDATE users SET kullanici_no='SG-'||LPAD(id::TEXT,8,'0') WHERE id=$1", [u.id]);
      await auditLog('user.kayit', 'api', { userId: u.id, ip: req.ip, detay: { yontem: 'google' } });
    } else if (!u.google_id) {
      await query('UPDATE users SET google_id=$1 WHERE id=$2', [g.sub, u.id]);
    }
    if (u.durum === 'silme_bekliyor') await hesapSilme.silmeIptal(u.id, { ip: req.ip });
    await auditLog('user.giris', 'api', { userId: u.id, ip: req.ip, detay: { yontem: 'google' } });
    girisKaydet(query, u.id, req, true);
    geri('google-giris?token=' + encodeURIComponent(token(u)));
  } catch (e) {
    console.error('[auth/google]', e.message);
    geri('?giris_hata=google');
  }
});

// KYC webhook için /api/kyc/webhook kullanılır (routes/kyc.js)
// Tüm cihazlardan çıkış (basit: istemci token'ı siler; sunucu audit)
router.post('/logout-all', require('../middleware/auth').authMiddleware, async (req, res) => {
  await auditLog('user.logout_all','api',{userId:req.user.id});
  res.json({ ok:true });
});

module.exports = router;
