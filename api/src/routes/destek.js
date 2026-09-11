const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { authMiddleware: authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { sendWhatsApp } = require('../utils/whatsapp');

function normalize(s) {
  return (s || '').toLowerCase()
    .replace(/ı/g,'i').replace(/İ/g,'i').replace(/ş/g,'s').replace(/Ş/g,'s')
    .replace(/ğ/g,'g').replace(/Ğ/g,'g').replace(/ü/g,'u').replace(/Ü/g,'u')
    .replace(/ö/g,'o').replace(/Ö/g,'o').replace(/ç/g,'c').replace(/Ç/g,'c');
}

const FAQ = [
  { keywords: ['ilan ver','nasil ilan','ilan nasil','ilan olustur','satis yap','nasil satarim','ilan ekle'],
    cevap: 'İlan vermek çok kolay!\n\n1. Sağ üstteki "+İlan Ver" butonuna tıklayın\n2. Kategori seçin ve fotoğraf ekleyin\n3. Başlık, açıklama ve fiyat belirleyin\n4. "Yayınla" butonuna basın – ilanınız dakikalar içinde aktif olur!\n\nÜcretsiz plan: Ayda 5 ilan. Daha fazlası için paket satın alabilirsiniz.' },
  { keywords: ['ilan suresi','ne kadar sure','kac gun','uzat','bitis tarihi','sure uzat','ilan bitis'],
    cevap: 'İlan süreleri:\n\n• Bireysel kullanıcılar: 30 gün (en fazla 10 kez uzatılabilir)\n• Kurumsal kullanıcılar: 60 gün (abonelik aktif olduğu sürece)\n\nİlanınız bitmeden 3 gün önce e-posta ile bilgilendirme yapılır. "İlanlarım" sayfasından "Süreyi Uzat" butonuyla kolayca uzatabilirsiniz.' },
  { keywords: ['guvenli','odeme','dolandiricilik','nasil guvenli','emniyetli','para gonder','transfer','aldatma'],
    cevap: 'Kap Beni\'de güvenli alışveriş için:\n\n• Ürünü teslim almadan ödeme yapmayın\n• Halka açık yerlerde buluşun (AVM, kafe...)\n• Banka havalesi gibi izlenebilir ödeme kullanın\n• Sohbette "Anlaşma Notu" ile fiyat/ürünü belgeleyin\n\nKap Beni ödeme sürecine dahil olmaz. Şüpheli durumları hemen bildirin!' },
  { keywords: ['kimlik','kyc','dogrulama','kimlik dogrula','hesap dogrula','verification'],
    cevap: 'KYC (Kimlik Doğrulama) nedir?\n\nGüvenilir satıcı rozeti kazanmak için kimliğinizi doğrulayabilirsiniz.\n\nProfilinizdeki "Satıcı Doğrulama" bölümünden:\n1. Kimlik fotoğrafı yükleyin\n2. Selfie çekin\n3. Onay 1-2 iş günü içinde yapılır\n\nDoğrulanmış satıcılar daha fazla güven kazanır.' },
  { keywords: ['mesaj','sohbet','chat','nasil mesaj','iletisim kur','yazis','konusma'],
    cevap: 'Mesajlaşma nasıl çalışır?\n\nİlan sayfasındaki "Mesaj Gönder" butonuna tıklayarak satıcıyla iletişime geçebilirsiniz.\n\n• İlk mesajınızda güvenli alışveriş hatırlatması görünür\n• "Anlaşma Notu" ile fiyat/ürün/teslimat bilgilerini sohbete sabitleyebilirsiniz\n• Tüm sohbet geçmişiniz her iki tarafça görülebilir' },
  { keywords: ['sikayet','bildir','sorun','uygunsuz','kotu ilan','yaniltici'],
    cevap: 'Sorunlu bir ilan mı gördünüz?\n\nİlan sayfasının altındaki "İlanla ilgili şikayetim var" linkine tıklayın.\n\nŞikayet kategorileri: Platformda olmamalı, Yasa dışı içerik, Dolandırıcılık, Mükerrer ilan, Yanıltıcı içerik, Diğer.\n\n3 farklı kullanıcı şikayet ettiğinde ilan otomatik askıya alınır.' },
  { keywords: ['favori','kaydet','begeni','listeme ekle','istek listesi'],
    cevap: 'İlanları favorilere eklemek için:\n\nHerhangi bir ilan kartındaki kalp ikonuna veya ilan sayfasındaki "Favorilere Ekle" butonuna tıklayın.\n\nFavorilerinize "Favorilerim" sekmesinden ulaşabilirsiniz. Üye olmanız gereklidir.' },
  { keywords: ['paket','abonelik','ucret','fiyat','ne kadar tutar','plan','premium','kurumsal paket'],
    cevap: 'Paket ve Abonelik Fiyatları:\n\nBireysel:\n• Ücretsiz: Ayda 5 ilan\n• 10\'lu Paket: 50₺ (10 ilan hakkı)\n\nKurumsal:\n• 1 Ay: 150₺ / 25 ilan / 60 gün\n• 3 Ay: 380₺ / 75 ilan\n• 6 Ay: 680₺ / 150 ilan\n• 12 Ay: 1000₺ / 100 ilan\n\nİlk 3 ay tüm yeni üyeler için ücretsiz! KDV dahildir.' },
  { keywords: ['sifre','sifre unuttum','sifre degistir','giris yapamiyorum','hesabim kapali'],
    cevap: 'Şifrenizi mi unuttunuz?\n\nGiriş ekranındaki "Şifremi Unuttum" linkine tıklayın. E-posta adresinize sıfırlama bağlantısı gönderilir.\n\nBağlantı 1 saat geçerlidir. Spam/Junk klasörünüzü de kontrol edin.' },
  { keywords: ['hesap sil','sil beni unut','hesabimi kapat','kayit sil','gdpr'],
    cevap: 'Hesabınızı silmek için:\n\nAyarlar → Hesap İşlemleri → "Hesabımı Sil ve Beni Unut" seçeneğine gidin.\n\n• İsteğinizden itibaren 30 gün süre verilir\n• Bu sürede giriş yaparak iptal edebilirsiniz\n• 30 gün sonra tüm verileriniz kalıcı olarak silinir\n• Aktif ilanlarınız hemen yayından kaldırılır' },
  { keywords: ['google','sosyal giris','gmail ile','google hesap','google login'],
    cevap: 'Google ile giriş yapabilirsiniz!\n\nGiriş ekranındaki "Google ile Giriş Yap" butonuna tıklayın. Google hesabınızla hızlıca üye olabilir veya giriş yapabilirsiniz.' },
  { keywords: ['kurumsal','firma','isletme','sirket','vkn','vergi','ticari','b2b'],
    cevap: 'Kurumsal Hesap nedir?\n\nFirmalar için özel avantajlar:\n• 60 güne kadar ilan süresi\n• Daha fazla ilan hakkı\n• "Kurumsal Satıcı" rozeti ile güven kazanma\n• VKN ile tescilli firma bilgisi\n• TKHK m.48 kapsamında 14 gün cayma hakkı\n\nKayıt sırasında "Kurumsal" seçeneğini işaretleyin.' },
  { keywords: ['fotograf','resim','gorsel','foto yukle','kac fotograf','resim ekle'],
    cevap: 'İlan fotoğrafları hakkında:\n\n• Bir ilana en fazla 8 fotoğraf ekleyebilirsiniz\n• İlk fotoğraf kapak görseli olarak görünür\n• Desteklenen formatlar: JPG, PNG, WEBP\n• Net, iyi aydınlatılmış fotoğraflar daha fazla alıcı çeker' },
  { keywords: ['nasil calisir','platform nasil','kap beni nedir','ne yapabilirim','satmak icin','almak icin'],
    cevap: 'Kap Beni Nasıl Çalışır?\n\n1. İlan Ver – Fotoğraf çek, başlık/fiyat gir, yayınla\n2. Mesajlaş – Alıcılarla platform üzerinden güvenle yazış\n3. Anlaş – Anlaşma Notu ile fiyatı belgele\n4. Teslim Et – Kargo veya elden teslim\n5. Değerlendir – İşlem sonrası karşılıklı puan ver' },
];

router.post('/bot', async (req, res) => {
  const { soru } = req.body;
  const norm = normalize(soru || '');
  let best = null, bestScore = 0;
  for (const faq of FAQ) {
    let score = 0;
    for (const kw of faq.keywords) if (norm.includes(normalize(kw))) score++;
    if (score > bestScore) { bestScore = score; best = faq; }
  }
  if (best && bestScore > 0) return res.json({ cevap: best.cevap, bulundu: true });
  res.json({ cevap: 'Bu konuda size yardımcı olamadım. Destek ekibimiz size daha detaylı yardımcı olabilir. Aşağıdan destek talebi oluşturabilirsiniz.', bulundu: false });
});

router.post('/ticket', async (req, res) => {
  const { isim, email, konu, mesaj, bot_cevap } = req.body;
  if (!email || !konu || !mesaj) return res.status(400).json({ error: 'Eksik alanlar' });
  try {
    const auth = req.headers.authorization; let uid = null;
    if (auth) { try { const jwt = require('jsonwebtoken'); const d = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); uid = d.id; } catch {} }
    const r = await pool.query(`INSERT INTO support_tickets (user_id,isim,email,konu,mesaj,bot_cevap,durum) VALUES ($1,$2,$3,$4,$5,$6,'acik') RETURNING ticket_no`,
      [uid, isim, email, konu, mesaj, bot_cevap]);
    const ticketNo = r.rows[0].ticket_no;
    await sendMail({ to: email, subject: `Destek Talebiniz Alındı – ${ticketNo}`,
      html: `<p>Merhaba ${isim || ''},</p><p>Destek talebiniz alındı. Talep numaranız: <strong>${ticketNo}</strong></p><p>En kısa sürede size dönüş yapacağız.</p><p>Kap Beni Destek</p>` });
    await sendMail({ to: process.env.ADMIN_EMAIL || 'destek@kapbeni.com', subject: `[Yeni Ticket] ${ticketNo}: ${konu}`, html: `<p>${isim} (${email}): ${mesaj}</p>` });
    await sendWhatsApp(`Yeni destek talebi: ${ticketNo} - ${konu} (${isim})`);
    res.json({ ok: true, ticket_no: ticketNo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ticket/benim', authenticateToken, async (req, res) => {
  const r = await pool.query('SELECT * FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json(r.rows);
});
router.get('/ticket/admin', requireAdmin, async (req, res) => {
  const r = await pool.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
  res.json(r.rows);
});
router.patch('/ticket/:id', requireAdmin, async (req, res) => {
  const { admin_cevap, durum } = req.body;
  await pool.query('UPDATE support_tickets SET admin_cevap=$1, durum=$2, updated_at=NOW() WHERE id=$3', [admin_cevap, durum, req.params.id]);
  if (admin_cevap) {
    const t = await pool.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
    if (t.rows[0]?.email) await sendMail({ to: t.rows[0].email, subject: `Destek Talebiniz Yanıtlandı – ${t.rows[0].ticket_no}`,
      html: `<p>Merhaba,</p><p>Talebiniz (${t.rows[0].ticket_no}) yanıtlandı:</p><p><em>${admin_cevap}</em></p><p>Kap Beni Destek</p>` });
  }
  res.json({ ok: true });
});

router.post('/oneri', async (req, res) => {
  const { konu, mesaj, kullanici_id } = req.body;
  if (!konu || !mesaj) return res.status(400).json({ error: 'Eksik' });
  await pool.query('INSERT INTO oneriler (kullanici_id,konu,mesaj) VALUES ($1,$2,$3)', [kullanici_id || null, konu, mesaj]);
  res.json({ ok: true });
});
router.get('/oneri/admin', requireAdmin, async (req, res) => {
  const r = await pool.query(`SELECT o.*, k.ad as kullanici_ad FROM oneriler o LEFT JOIN users k ON k.id=o.kullanici_id ORDER BY o.created_at DESC`);
  res.json(r.rows);
});
module.exports = router;
