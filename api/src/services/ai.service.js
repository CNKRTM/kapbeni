const OpenAI = require('openai');
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

// İlan moderasyonu — API → bu fonksiyon → NVIDIA → sonuç ilanlar tablosuna yazılır
exports.moderasyonYap = async (baslik, aciklama, fiyat) => {
  const fallback = { onaylandi: true, skor: 70, sebep: 'Manuel inceleme', kategori_onerisi: 'Diğer' };
  return guvenli(async () => {
    const sys = `Sen kapbeni.com ilan moderatörsün. Şüpheli ilanları tespit et.
Kriterler: stok fotoğraf benzeri açıklama, aşırı düşük fiyat, peşin ödeme talebi,
kişisel iletişim bilgisi içeriyor, anlamsız açıklama.
JSON döndür: {"onaylandi":bool,"skor":0-100,"sebep":"1 cümle Türkçe","kategori_onerisi":"Ana>Alt"}`;
    const raw = await chat(sys, `Başlık:${baslik}\nAçıklama:${aciklama}\nFiyat:${fiyat}TL`);
    return parseJSON(raw) || fallback;
  }, fallback);
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
