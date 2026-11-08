// ════════════════════════════════════════════════════════════════════════════
//  Rechtsseiten (Arbeitspaket D, Entwurf v1.0 vom 08.11.2026).
//
//  Die 15 Texte liegen als reine HTML-Fragmente unter ./metinler/<slug>.html
//  (aufbereitet aus kapbeni/legal-entwurf: interne Prüfmarken entfernt,
//  Firmendaten als {{token}}). Firmendaten werden zur Laufzeit ausschließlich
//  aus SIRKET gefüllt — nie von Hand in einen Text schreiben. Leere SIRKET-
//  Felder erscheinen dezent als „(eklenecek)“, nie als rohe Klammer.
//
//  Die Fragmente werden erst beim Öffnen einer Rechtsseite nachgeladen
//  (import.meta.glob, je Text ein eigener Chunk) — das Hauptbundle bleibt klein.
// ════════════════════════════════════════════════════════════════════════════
import { SIRKET, tamAdres } from '../../data/sirket'

export interface HukukMetni {
  slug: string
  baslik: string      // kurzer Titel für Footer, Seitentitel, Links
}

// Reihenfolge = Reihenfolge im Block „İlgili Metinler“ der Texte
export const HUKUK_METINLERI: HukukMetni[] = [
  { slug: 'kvkk', baslik: 'KVKK Aydınlatma Metni' },
  { slug: 'acik-riza', baslik: 'Açık Rıza Metni' },
  { slug: 'cerez-politikasi', baslik: 'Çerez Politikası' },
  { slug: 'gizlilik-politikasi', baslik: 'Gizlilik Politikası' },
  { slug: 'kullanim-kosullari', baslik: 'Kullanım Koşulları' },
  { slug: 'uyelik-sozlesmesi', baslik: 'Üyelik Sözleşmesi' },
  { slug: 'ilan-verme-kurallari', baslik: 'İlan Verme Kuralları' },
  { slug: 'yasakli-urunler', baslik: 'Yasaklı ve Kısıtlı Ürünler' },
  { slug: 'guvenli-alisveris', baslik: 'Güvenli Alışveriş Rehberi' },
  { slug: 'hak-ihlali-bildirimi', baslik: 'Hak İhlali ve Şikâyet Bildirimi' },
  { slug: 'kurumsal-satici-sozlesmesi', baslik: 'Kurumsal Satıcı Sözleşmesi' },
  { slug: 'mesafeli-satis', baslik: 'Mesafeli Satış Sözleşmesi' },
  { slug: 'on-bilgilendirme', baslik: 'Ön Bilgilendirme Formu' },
  { slug: 'iade-politikasi', baslik: 'İade ve İptal Politikası' },
  { slug: 'kunye', baslik: 'Künye ve İletişim' },
]

export const HUKUK_SLUGS = HUKUK_METINLERI.map((m) => m.slug)

// Ältere oder naheliegende Adressen → neue Route (location.replace, kein toter Eintrag)
export const HUKUK_ALIAS: Record<string, string> = {
  'kvkk-aydinlatma-metni': 'kvkk',
  'kvkk-aydinlatma': 'kvkk',
  'gizlilik': 'gizlilik-politikasi',
  'cerez': 'cerez-politikasi',
  'cerezler': 'cerez-politikasi',
  'kullanim-sartlari': 'kullanim-kosullari',
  'mesafeli-satis-sozlesmesi': 'mesafeli-satis',
  'on-bilgilendirme-formu': 'on-bilgilendirme',
  'iade': 'iade-politikasi',
  'iade-iptal-politikasi': 'iade-politikasi',
  'impressum': 'kunye',
  'yasakli-ve-kisitli-urunler': 'yasakli-urunler',
}

// Inkrafttreten: erst nach der juristischen Prüfung setzen (Burak)
const YURURLUK_TARIHI = ''

const EKLENECEK = '<span class="hukuk-eksik">(eklenecek)</span>'

const kacir = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const mail = (a: string) => `<a href="mailto:${kacir(a)}">${kacir(a)}</a>`

/** {{token}} → Wert aus SIRKET (HTML-sicher). Leere Werte → „(eklenecek)“. */
function tokenWert(t: string): string {
  const roh: Record<string, string> = {
    unvan: SIRKET.unvan,
    adres: tamAdres(),
    telefon: SIRKET.telefon,
    vkn: SIRKET.vkn,
    vergiDairesi: SIRKET.vergiDairesi,
    mersis: SIRKET.mersis,
    kep: SIRKET.kep,
    ticaretSicilNo: SIRKET.ticaretSicilNo,
    odaAdi: SIRKET.odaAdi,
    yururluk: YURURLUK_TARIHI,
  }
  if (t === 'eposta') return mail(SIRKET.eposta)
  if (t === 'destekEposta') return mail(SIRKET.destekEposta)
  if (t === 'web') return `<a href="${kacir(SIRKET.web)}" target="_blank" rel="noopener noreferrer">${kacir(SIRKET.web)}</a>`
  if (t === 'etbis') {
    return SIRKET.etbisKayitNo
      ? kacir(SIRKET.etbisKayitNo)
      : 'ETBİS kaydı yapılmaktadır; kayıt tamamlandığında kayıt bilgileri bu sayfada yayımlanacaktır.'
  }
  if (!(t in roh)) return EKLENECEK
  const v = roh[t]
  return v ? kacir(v) : EKLENECEK
}

/** Fragment → anzeigefertiges HTML (Token gefüllt, Tabellen scrollbar umhüllt). */
export function metniHazirla(html: string): string {
  return html
    .replace(/\{\{([a-zA-Z]+)\}\}/g, (_, t: string) => tokenWert(t))
    // breite Tabellen scrollen innerhalb der Karte statt die Seite zu verbreitern
    .replace(/<table>/g, '<div class="hukuk-tablo"><table>')
    .replace(/<\/table>/g, '</table></div>')
    // Inhaltsverzeichnis als eigener Block (Gestaltung in index.css)
    .replace(
      /<p><strong>İçindekiler<\/strong><\/p>\s*<ul>([\s\S]*?)<\/ul>/,
      '<nav class="hukuk-icindekiler" aria-label="İçindekiler"><p><strong>İçindekiler</strong></p><ul>$1</ul></nav>',
    )
}

const YUKLEYICILER = import.meta.glob('./metinler/*.html', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>

export async function metniYukle(slug: string): Promise<string> {
  const f = YUKLEYICILER[`./metinler/${slug}.html`]
  if (!f) throw new Error('metin yok: ' + slug)
  return metniHazirla(await f())
}
