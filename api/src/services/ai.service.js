const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const apiKey = process.env.NVIDIA_API_KEY || '';
// AI sadece geçerli bir NVIDIA anahtarı varsa aktif.
const AI_AKTIF = /^nvapi-/.test(apiKey) && !/DEIN_KEY|HIER_EINTRAGEN|xxx/i.test(apiKey);
const client = AI_AKTIF ? new OpenAI({
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  apiKey,
}) : null;

const chat = async (system, user, model = null, maxTokens = 800) => {
  if (!AI_AKTIF) throw new Error('AI devre dışı');
  const m = model || process.env.NVIDIA_MODEL_STANDARD || 'meta/llama-3.1-70b-instruct';
  const r = await client.chat.completions.create({
    model: m, max_tokens: maxTokens, temperature: 0.15,
    messages: [{ role:'system', content: system }, { role:'user', content: user }]
  });
  return r.choices[0].message.content.trim();
};

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

// Mesaj dolandırıcı tespiti — mesajlar yazıldığında tetiklenir
exports.mesajKontrol = async (metin) => {
  const fallback = { tehlikeli: false, tur: 'temiz' };
  return guvenli(async () => {
    const sys = `Dolandırıcılık tespiti. Tehlikeli: havale/IBAN iste, WhatsApp'a yönlendir,
acele karar ver baskısı, yurt dışı gönderim.
JSON: {"tehlikeli":bool,"tur":"pesin_odeme|iletisim_yonlendirme|sahte_acele|temiz"}`;
    const raw = await chat(sys, metin, process.env.NVIDIA_MODEL_FAST || 'mistralai/mistral-7b-instruct-v0.3', 200);
    return parseJSON(raw) || fallback;
  }, fallback);
};

// Satıcıya açıklama önerisi
exports.aciklamaOner = async (baslik, durum, fiyat) => {
  return guvenli(async () => {
    const sys = `kapbeni.com için kısa Türkçe ürün açıklaması yaz. 3-4 cümle, dürüst, ikna edici.`;
    return await chat(sys, `Ürün:${baslik} Durum:${durum} Fiyat:${fiyat}TL`, process.env.NVIDIA_MODEL_FAST || 'mistralai/mistral-7b-instruct-v0.3', 300);
  }, '');
};

// Fiyat önerisi
exports.fiyatOner = async (urun, durum) => {
  return guvenli(async () => {
    const sys = `Türkiye 2024-2025 ikinci el fiyatları. JSON: {"min":sayi,"max":sayi,"orta":sayi,"not":"kısa"}`;
    const raw = await chat(sys, `${urun} - ${durum}`);
    return parseJSON(raw) || null;
  }, null);
};
