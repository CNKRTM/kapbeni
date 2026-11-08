// ════════════════════════════════════════════════════════════════════════════
//  Cookie-Einwilligung (Arbeitspaket D, Texte aus legal-entwurf/cookie-banner-texte.json).
//
//  Gespeichert in localStorage['kapbeni_cookie_consent'] als
//    { v, zorunlu: true, analitik, pazarlama, zaman }
//  v = Textversion des Banners. Ein Versionswechsel (oder Ablauf nach 12 Monaten,
//  Çerez Politikası Abschnitt 6) gilt als „keine Entscheidung“ → Banner fragt neu.
//  Heute gibt es keine Analyse-/Marketing-Werkzeuge; wer später eines einbaut,
//  fragt analitikIzinli()/pazarlamaIzinli() ab und erhöht CEREZ_SURUM.
// ════════════════════════════════════════════════════════════════════════════

export const CEREZ_ANAHTAR = 'kapbeni_cookie_consent'
export const CEREZ_SURUM = '1.0'
const GECERLILIK_MS = 365 * 24 * 60 * 60 * 1000
const AC_OLAYI = 'kapbeni:cerez-tercihleri'

export interface CerezOnay {
  v: string
  zorunlu: true
  analitik: boolean
  pazarlama: boolean
  zaman: string   // ISO-Zeitpunkt der Entscheidung
}

/** Gültige Entscheidung oder null (keine, alte Version, abgelaufen, unlesbar). */
export function onayOku(): CerezOnay | null {
  try {
    const roh = localStorage.getItem(CEREZ_ANAHTAR)
    if (!roh) return null
    const o = JSON.parse(roh)
    if (!o || o.v !== CEREZ_SURUM || typeof o.analitik !== 'boolean' || typeof o.pazarlama !== 'boolean') return null
    const t = Date.parse(o.zaman)
    if (!Number.isFinite(t) || Date.now() - t > GECERLILIK_MS) return null
    return { v: o.v, zorunlu: true, analitik: o.analitik, pazarlama: o.pazarlama, zaman: o.zaman }
  } catch {
    return null
  }
}

export function onayYaz(analitik: boolean, pazarlama: boolean): CerezOnay {
  const o: CerezOnay = { v: CEREZ_SURUM, zorunlu: true, analitik, pazarlama, zaman: new Date().toISOString() }
  try { localStorage.setItem(CEREZ_ANAHTAR, JSON.stringify(o)) } catch { /* Speicher gesperrt: gilt nur für diese Sitzung */ }
  return o
}

export const analitikIzinli = () => !!onayOku()?.analitik
export const pazarlamaIzinli = () => !!onayOku()?.pazarlama

/** Footer-Link „Çerez Tercihleri“: Banner mit geöffneten Tercihler erneut zeigen. */
export function cerezTercihleriniAc() {
  window.dispatchEvent(new Event(AC_OLAYI))
}

export function cerezAcDinle(fn: () => void): () => void {
  window.addEventListener(AC_OLAYI, fn)
  return () => window.removeEventListener(AC_OLAYI, fn)
}

// Banner-Texte (cookie-banner-texte.json v1.0; Knopfnamen nach Auftrag: Tümünü kabul et / Reddet / Tercihler)
export const CEREZ_METIN = {
  baslik: 'Çerez Tercihleriniz',
  aciklama:
    'Kapbeni, sitenin çalışması ve güvenliğiniz için zorunlu çerezler ile benzeri teknolojiler (ör. tarayıcı yerel depolaması) kullanır. Analiz ve pazarlama çerezlerini yalnızca onay vermeniz hâlinde kullanırız; şu an bu tür çerez kullanmıyoruz. Tercihinizi dilediğiniz zaman sayfanın altındaki “Çerez Tercihleri” bağlantısından değiştirebilirsiniz.',
  politikaLink: { metin: 'Çerez Politikası', href: '/#/cerez-politikasi' },
  kvkkLink: { metin: 'KVKK Aydınlatma Metni', href: '/#/kvkk' },
  tumunuKabul: 'Tümünü kabul et',
  reddet: 'Reddet',
  tercihler: 'Tercihler',
  kaydet: 'Tercihleri kaydet',
  kapat: 'Kapat',
  kapatIpucu: 'Paneli kapatırsanız yalnızca zorunlu çerezler kullanılır.',
  herZaman: 'Her zaman etkin',
  acik: 'Açık',
  kapali: 'Kapalı',
  kaydedildi: 'Çerez tercihleriniz kaydedildi.',
  aracYok: 'Bu kategoride şu an kullanılan bir araç bulunmamaktadır.',
  kategoriler: {
    zorunlu: {
      baslik: 'Zorunlu çerezler',
      aciklama:
        'Oturum açmanız, oturumunuzun güvenle sürdürülmesi, ilan verme ve mesajlaşma gibi temel işlevler ile çerez tercihinizin hatırlanması için gereklidir. Bu çerezler olmadan site çalışmaz; bu nedenle kapatılamaz.',
      araclar: ['sg_token', 'kapbeni_cookie_consent', 'kapbeni_listings', 'kapbeni_chats'],
    },
    analitik: {
      baslik: 'Analiz çerezleri',
      aciklama:
        'Sitenin nasıl kullanıldığını istatistiksel olarak ölçmemize, hataları ve performans sorunlarını tespit etmemize yardımcı olur. Yalnızca onayınızla etkinleşir. Kullanılan araçlar ve varsa yurt dışı aktarım bilgisi Çerez Politikası’nda belirtilir.',
      araclar: [] as string[],
    },
    pazarlama: {
      baslik: 'Pazarlama çerezleri',
      aciklama:
        'İlgi alanlarınıza uygun reklam ve kampanyalar göstermek ve reklam etkinliğini ölçmek için kullanılır. Yalnızca onayınızla etkinleşir. Kullanılan araçlar ve varsa yurt dışı aktarım bilgisi Çerez Politikası’nda belirtilir.',
      araclar: [] as string[],
    },
  },
}
