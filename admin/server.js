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
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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

// Admin JWT — kaynak: 'admin' (API'nin 'api' kaynağından farklı)
const adminToken = (user) => jwt.sign(
  { id: user.id, email: user.email, rol: user.rol, kaynak: 'admin' },
  process.env.JWT_SECRET, { expiresIn: '8h' }
);

const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.admin_token;
  if (!token) return res.status(401).json({ hata: 'Giriş gerekli' });
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    if (d.kaynak !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
    req.admin = d;
    next();
  } catch { res.status(401).json({ hata: 'Geçersiz token' }); }
};

const auditAdmin = async (olay, admin_id, opts = {}) => {
  await db.query(
    `INSERT INTO audit_log(olay,kaynak,admin_id,hedef_tip,hedef_id,detay) VALUES($1,'admin',$2,$3,$4,$5)`,
    [olay, admin_id, opts.hedefTip||null, opts.hedefId||null, opts.detay ? JSON.stringify(opts.detay) : null]
  );
};

// ── ADMIN AUTH ──────────────────────────────────────────────────────────

app.post('/admin/api/giris', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query('SELECT * FROM admin_users WHERE email=$1 AND aktif=true', [email]);
  if (!rows[0] || !await bcrypt.compare(password, rows[0].password_hash))
    return res.status(401).json({ hata: 'Hatalı giriş' });
  await db.query('UPDATE admin_users SET son_giris=NOW() WHERE id=$1', [rows[0].id]);
  res.json({ token: adminToken(rows[0]), admin: { id: rows[0].id, email: rows[0].email, rol: rows[0].rol } });
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
    `SELECT i.*, u.email, u.ad, u.soyad, k.ad as kategori_ad,
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

app.post('/admin/api/ilanlar/:id/reddet', adminAuth, async (req, res) => {
  const { sebep } = req.body;
  await db.query("UPDATE ilanlar SET ilan_durum='reddedildi', ai_not=$1 WHERE id=$2", [sebep, req.params.id]);
  await auditAdmin('ilan.reddet', req.admin.id, { hedefTip:'ilan', hedefId:+req.params.id, detay:{sebep} });
  res.json({ mesaj: 'İlan reddedildi' });
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
    `SELECT k.*, u.email, u.ad, u.soyad, u.phone FROM kyc_results k
     JOIN users u ON u.id=k.user_id WHERE k.durum=$1 ORDER BY k.created_at ASC`, [durum]
  );
  res.json(rows);
});

app.post('/admin/api/kyc/:id/onayla', adminAuth, async (req, res) => {
  await db.query("UPDATE kyc_results SET durum='onaylandi',manuel_onay_by=$1 WHERE id=$2", [req.admin.id, req.params.id]);
  await auditAdmin('kyc.manuel_onayla', req.admin.id, { hedefTip:'kyc', hedefId:+req.params.id });
  res.json({ mesaj: 'KYC onaylandı' });
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
            ug.email as gonderen_email
     FROM mesajlar m
     JOIN konusmalar k ON k.id=m.konusma_id
     JOIN ilanlar il ON il.id=k.ilan_id
     JOIN users ug ON ug.id=m.gonderen_id
     WHERE m.tehlikeli=true ORDER BY m.created_at DESC LIMIT 50`
  );
  res.json(rows);
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



// AUFGABE 13: API Bağlantılar
app.get('/admin/api/api-durum', adminAuth, (req,res)=>{
  const has=(v,bad)=> v && !(bad&&new RegExp(bad,'i').test(v));
  res.json([
    { ad:'Param', aciklama:'Ödeme altyapısı', env_key:'PARAM_TEST_MODE', test_mode:process.env.PARAM_TEST_MODE==='true', url:process.env.PARAM_API_BASE, durum: has(process.env.PARAM_CLIENT_CODE,'TEST_CLIENT')?'bagli':'test' },
    { ad:'KolayBi', aciklama:'e-Fatura', env_key:'KOLAYBI_TEST_MODE', test_mode:process.env.KOLAYBI_TEST_MODE==='true', url:'efatura.kolaybi.com', durum: has(process.env.KOLAYBI_API_KEY)?'bagli':'hata' },
    { ad:'Google', aciklama:'OAuth Giriş', env_key:'GOOGLE_AUTH', test_mode:false, url:'accounts.google.com', durum: has(process.env.GOOGLE_CLIENT_ID)?'bagli':'hata' },
    { ad:'NVIDIA', aciklama:'AI Moderasyon', env_key:'NVIDIA_API_KEY', test_mode:false, url:process.env.NVIDIA_BASE_URL, durum: has(process.env.NVIDIA_API_KEY,'DEIN_KEY|HIER')?'bagli':'hata' },
    { ad:'e-Devlet', aciklama:'Kimlik Doğrulama', env_key:'EDEVLET', test_mode:true, url:'giris.turkiye.gov.tr', durum:'test' },
  ]);
});
app.get('/admin/api/api-test', adminAuth, async (req,res)=>{
  const { servis } = req.query;
  try{
    if(String(servis).toLowerCase()==='nvidia'){
      // openai ist keine eigene admin-dependency, sondern wird aus dem
      // Nachbarpaket api/ mitgenutzt. Relativ zu __dirname (= admin/), damit
      // ein Verschieben des gesamten kapbeni-Baums den Pfad nicht bricht.
      const OpenAI=require('../api/node_modules/openai');
      const client=new OpenAI({apiKey:process.env.NVIDIA_API_KEY, baseURL:process.env.NVIDIA_BASE_URL});
      await client.chat.completions.create({model:process.env.NVIDIA_MODEL_STANDARD||'meta/llama-3.1-70b-instruct',messages:[{role:'user',content:'test'}],max_tokens:3});
      return res.json({ok:true});
    }
    res.json({ok:false, hata:`${servis} testi için gerçek credentials gerekli`});
  }catch(e){ res.json({ok:false, hata:e.message}); }
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
      `SELECT s.*, k.ad as sikayet_eden_ad, i.baslik as ilan_baslik, i.ilan_no
       FROM sikayet s LEFT JOIN users k ON k.id=s.sikayet_eden
       LEFT JOIN ilanlar i ON i.uuid=s.ilan_uuid ORDER BY s.created_at DESC`);
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
      `SELECT id, ad, soyad, email, firma_adi, vkn, mersis_no, ticari_adres, yetkili_kisi, sektor, created_at
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


// ── ADMIN UI (Single Page) ─────────────────────────────────────────────

app.get('/admin*', (req, res) => {
  if (req.path.startsWith('/admin/api')) return res.status(404).json({ hata: 'Endpoint yok' });
  // Statt sendFile: die Seite wird gelesen, damit die Versionsnummer aus
  // VERSION eingesetzt werden kann. Schlaegt das Lesen fehl, wird die Datei
  // wie zuvor unveraendert ausgeliefert — die Oberflaeche faellt nie aus.
  const datei = path.join(__dirname, 'public', 'index.html');
  fs.readFile(datei, 'utf8', (err, html) => {
    if (err) return res.sendFile(datei);
    res.type('html').send(html.split('__APP_VERSION__').join(APP_VERSION));
  });
});

const PORT = process.env.ADMIN_PORT || 3002;
app.listen(PORT, () => console.log(`✓ kapbeni Admin Port ${PORT}`));
