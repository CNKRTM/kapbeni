// Alle KI-Funktionen laufen seit v1.8.0 ueber Claude (Anthropic). Der fruehere
// NVIDIA-Zugang (OpenAI-kompatibel) ist entfernt — Endpunkt seit 26.08.2026 tot.
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const parseJSON = (raw) => {
  try { return JSON.parse(raw.replace(/```json|```/g,'').trim()); }
  catch { return null; }
};

// AI çağrısını güvenli sarmalar: hata/olmayan anahtar durumunda fallback döner, isteği bozmaz.
const guvenli = async (fn, fallback) => {
  try { return await fn(); }
  catch (e) { console.warn('[ai.service] AI atlandı:', e.message); return fallback; }
};

// ── İlan moderasyonu — Claude Haiku (seit v1.7.0) ─────────────────────────
// Vorher NVIDIA: das Modell wurde am 26.08.2026 abgeschaltet (410), und der
// Rueckfall {onaylandi:true, skor:70} schaltete jedes Inserat ungeprueft frei.
//
// Regeln:
// - `skor` ist GUEVEN (Vertrauen): 100 = unbedenklich, 0 = sicher Betrug/Spam.
//   Die alte Fassung liess die Richtung offen; Modelle lieferten teils einen
//   Risikowert (98 = Betrug), der dann als "unbedenklich" durchging.
// - Faellt die Pruefung aus (kein Schluessel, Zeitueberschreitung, Fehler,
//   Ablehnung), kommt `hata: true` zurueck -> das Inserat geht auf
//   'moderasyonda' und wartet auf Freigabe im Admin. Nie automatisch aktiv.
const MOD_MODEL = process.env.KAPBENI_MOD_MODEL || 'claude-haiku-5-5';
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
const MOD_AKTIF = /^sk-ant-/.test(anthropicKey);
const anthropic = MOD_AKTIF
  ? new Anthropic({ apiKey: anthropicKey, timeout: 20_000, maxRetries: 1 })
  : null;

const MOD_SYSTEM = `Sen kapbeni.com (Türkiye'de ikinci el ve sıfır ürün ilan sitesi) için ilan moderatörüsün.
Bir ilanın yayına alınıp alınamayacağına karar ver.

Reddet / incelemeye al (onaylandi=false, düşük skor):
- peşin ödeme, kapora, IBAN/havale isteği, "önce para gönderin"
- açıklamada telefon numarası, e-posta, WhatsApp/Telegram yönlendirmesi
- piyasa değerinin çok altında fiyat (ör. sıfır iPhone 4.500 TL)
- anlamsız, test amaçlı veya başlıkla ilgisiz metin
- yasa dışı ürün (silah, uyuşturucu, sahte belge, çalıntı mal), yetişkin içerik, hakaret

Normal ilanlar (kısa veya yazım hatalı olsa bile) onaylanır.

skor = güven puanı: 100 tamamen güvenli, 0 kesin dolandırıcılık/spam. Şüphe varsa 40'ın altı.
sebep: tek cümle Türkçe. kategori_onerisi: "Ana>Alt" biçiminde tahmin.`;

const MOD_SCHEMA = {
  type: 'object',
  properties: {
    onaylandi: { type: 'boolean' },
    skor: { type: 'integer' },
    sebep: { type: 'string' },
    kategori_onerisi: { type: 'string' },
  },
  required: ['onaylandi', 'skor', 'sebep', 'kategori_onerisi'],
  additionalProperties: false,
};

const modFehler = (grund) => ({
  onaylandi: false, skor: null, hata: true,
  sebep: `Otomatik kontrol yapılamadı (${grund}) — manuel inceleme`,
  kategori_onerisi: '',
});

exports.MOD_MODEL = MOD_MODEL;
exports.moderasyonYap = async (baslik, aciklama, fiyat) => {
  if (!MOD_AKTIF) return modFehler('anahtar yok');
  try {
    const msg = await anthropic.messages.create({
      model: MOD_MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: MOD_SCHEMA } },
      system: MOD_SYSTEM,
      messages: [{
        role: 'user',
        content: `<ilan>\nBaşlık: ${baslik}\nAçıklama: ${aciklama}\nFiyat: ${fiyat} TL\n</ilan>`,
      }],
    });
    if (msg.stop_reason === 'refusal') return modFehler('model reddetti');
    if (msg.stop_reason === 'max_tokens') return modFehler('yanıt kesildi');
    const text = msg.content.find((b) => b.type === 'text');
    const r = text ? parseJSON(text.text) : null;
    if (!r || typeof r.onaylandi !== 'boolean' || !Number.isFinite(r.skor)) return modFehler('geçersiz yanıt');
    return { ...r, skor: Math.max(0, Math.min(100, Math.round(r.skor))), hata: false };
  } catch (e) {
    const grund = e instanceof Anthropic.APIConnectionTimeoutError ? 'zaman aşımı'
      : e instanceof Anthropic.RateLimitError ? 'limit'
      : e instanceof Anthropic.AuthenticationError ? 'anahtar geçersiz'
      : e instanceof Anthropic.APIError ? `API ${e.status ?? ''}`.trim()
      : 'hata';
    console.warn('[ai.service] Moderasyon başarısız:', grund, e.message);
    return modFehler(grund);
  }
};

// ── Weitere KI-Funktionen — ebenfalls Claude Haiku (seit v1.8.0) ──────────
// Anders als die Moderation blockieren sie nichts: Faellt der Aufruf aus,
// gilt der bisherige Rueckfall (Nachricht "temiz", kein Vorschlag). Eine
// Chatnachricht darf nie an einer KI-Stoerung scheitern.

// Ein Aufruf mit erzwungenem JSON-Schema; wirft bei jedem Fehler (guvenli faengt).
const claudeJSON = async (system, user, schema, { timeout = 8_000, maxTokens = 512 } = {}) => {
  if (!MOD_AKTIF) throw new Error('ANTHROPIC_API_KEY fehlt');
  const msg = await anthropic.messages.create({
    model: MOD_MODEL,
    max_tokens: maxTokens,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  }, { timeout, maxRetries: 0 });
  if (msg.stop_reason !== 'end_turn') throw new Error(`stop_reason ${msg.stop_reason}`);
  const text = msg.content.find((b) => b.type === 'text');
  const r = text ? parseJSON(text.text) : null;
  if (!r) throw new Error('geçersiz yanıt');
  return r;
};

const MESAJ_TURLER = ['pesin_odeme', 'iletisim_yonlendirme', 'sahte_acele', 'sahte_odeme', 'temiz'];
const MESAJ_SYSTEM = `kapbeni.com (Türkiye ilan sitesi) alıcı-satıcı sohbetinde tek bir mesajı dolandırıcılık açısından değerlendir.
tehlikeli=true yalnızca açık belirti varsa:
- pesin_odeme: kapora, IBAN, havale/EFT, "önce para gönder", hediye kartı
- iletisim_yonlendirme: WhatsApp/Telegram/telefon/e-posta ile site dışına taşıma
- sahte_acele: "hemen karar ver, başka alıcı var" baskısı, yurt dışından kargo hikâyesi
- sahte_odeme: sahte dekont, "ödeme yaptım, linke tıkla", kargo/ödeme linki
Normal pazarlık, selamlaşma, ürün sorusu, buluşma yeri ayarlamak tehlikeli DEĞİLDİR → tur "temiz".`;
const MESAJ_SCHEMA = {
  type: 'object',
  properties: { tehlikeli: { type: 'boolean' }, tur: { type: 'string', enum: MESAJ_TURLER } },
  required: ['tehlikeli', 'tur'],
  additionalProperties: false,
};

// Mesaj dolandırıcı tespiti — mesajlar yazıldığında tetiklenir (routes/mesajlar.js)
exports.mesajKontrol = async (metin) => {
  const fallback = { tehlikeli: false, tur: 'temiz' };
  if (!metin || !String(metin).trim()) return fallback;
  return guvenli(async () => {
    const r = await claudeJSON(MESAJ_SYSTEM, `<mesaj>\n${String(metin).slice(0, 2000)}\n</mesaj>`, MESAJ_SCHEMA);
    if (typeof r.tehlikeli !== 'boolean' || !MESAJ_TURLER.includes(r.tur)) return fallback;
    return r.tehlikeli ? r : fallback;
  }, fallback);
};

// Satıcıya açıklama önerisi
exports.aciklamaOner = async (baslik, durum, fiyat) => {
  return guvenli(async () => {
    const r = await claudeJSON(
      `kapbeni.com için kısa Türkçe ürün açıklaması yaz. 3-4 cümle, dürüst, ikna edici. Uydurma teknik özellik ekleme; telefon, e-posta veya ödeme bilgisi yazma.`,
      `Ürün: ${baslik}\nDurum: ${durum}\nFiyat: ${fiyat} TL`,
      { type: 'object', properties: { aciklama: { type: 'string' } }, required: ['aciklama'], additionalProperties: false },
      { timeout: 15_000 },
    );
    return typeof r.aciklama === 'string' ? r.aciklama.trim() : '';
  }, '');
};

// Fiyat önerisi
exports.fiyatOner = async (urun, durum) => {
  return guvenli(async () => {
    const r = await claudeJSON(
      `Türkiye ikinci el piyasası için TL cinsinden tahmini fiyat aralığı ver. Emin değilsen aralığı geniş tut ve not alanında belirt. not: kısa Türkçe.`,
      `${urun} - ${durum}`,
      {
        type: 'object',
        properties: { min: { type: 'integer' }, max: { type: 'integer' }, orta: { type: 'integer' }, not: { type: 'string' } },
        required: ['min', 'max', 'orta', 'not'],
        additionalProperties: false,
      },
      { timeout: 15_000 },
    );
    return [r.min, r.max, r.orta].every(Number.isFinite) ? r : null;
  }, null);
};
