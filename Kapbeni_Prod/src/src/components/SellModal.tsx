import { useEffect, useRef, useState } from 'react'
import OnayModal from './OnayModal'
import { X, Sparkles, ChevronDown } from 'lucide-react'
import { Listing, ve, DURUM_SECENEKLERI, DURUM_ETIKET } from '../api'
import { useKategoriAgac, mitAnzahl, dbIdVonSlug } from '../data/kategoriAgac'
import Combobox from './Combobox'
import IlIlceAlanlari from './IlIlceAlanlari'
import { illerYukle, ilcelerYukle, tuerkischGleich } from '../data/iller'
import { useGeriKapat } from '../lib/geriTusu'



// Grenzen bewusst hier als Konstanten: dieselben Zahlen stehen in
// api/src/routes/ilanlar.js. Weichen sie ab, laeuft der Verkaeufer erst beim
// Absenden in eine Fehlermeldung statt beim Auswaehlen.
const FOTO_MAX = 8
const FOTO_BYTE = 10 * 1024 * 1024
// Bis zu dieser Groesse nimmt der Server ein Video an; alles ueber
// VIDEO_ZIEL_BYTE rechnet er auf 720p herunter, statt es abzulehnen.
// Dieselben Zahlen stehen in api/src/routes/ilanlar.js und api/src/lib/video.js.
const VIDEO_BYTE = 100 * 1024 * 1024
// (VIDEO_ZIEL_BYTE entfallen: seit v1.28 wird jedes Video umgerechnet.)
const VIDEO_TYPEN = ['video/mp4', 'video/webm', 'video/quicktime']
// Hoechstens 60 s (Auftragssammlung J). Der Server prueft per ffprobe erneut.
const VIDEO_MAX_SN = 60

/** Laenge eines gewaehlten Videos ueber HTML5 lesen; NaN, wenn der Browser
 *  das Format nicht kennt (z. B. MOV in Firefox) — dann entscheidet der Server. */
function videoDauer(url: string): Promise<number> {
  return new Promise((fertig) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    const uhr = window.setTimeout(() => fertig(NaN), 8000)
    v.onloadedmetadata = () => { window.clearTimeout(uhr); fertig(v.duration) }
    v.onerror = () => { window.clearTimeout(uhr); fertig(NaN) }
    v.src = url
  })
}

/**
 * Ein Bild in der Maske ist entweder ein Bestandsbild (liegt schon auf dem
 * Server, nur als URL bekannt) oder eine neu gewaehlte Datei.
 *
 * Frueher lagen Dateien und Vorschauen in ZWEI Feldern (images: File[],
 * previews: string[]), die stillschweigend gleich lang sein mussten. Fuer das
 * Bearbeiten geht das nicht auf: Bestandsbilder haben keine Datei. Die Folge
 * waeren versetzte Felder — der Zaehler zeigte 0/8 bei acht Bildern, Entfernen
 * traefe das falsche Bild, und die Sortierpfeile funktionierten gar nicht.
 * Deshalb jetzt EINE Liste, in der beide Arten nebeneinander stehen koennen.
 */
type Bild =
  | { art: 'bestand'; url: string }
  | { art: 'neu'; datei: File; vorschau: string }

/** Anfangswerte fuer den Bearbeiten-Modus. Kommt aus GET /api/ilanlar/:uuid. */
export interface IlanVorgabe {
  uuid: string
  baslik: string
  aciklama: string
  fiyat: number | string
  kategoriSlug: string | null
  durum: string            // Code: sifir | yeni_gibi | az_kullanilmis | kullanilmis
  sehir: string
  ilce: string
  fotograflar: string[]    // URLs in Anzeigereihenfolge
  videoUrl: string | null
  /** Kategorie-Merkmale { tanim_id: wert } aus GET /api/ilanlar/:uuid */
  ozellikler?: Record<string, string>
}

/** Was die Maske zusaetzlich zum Listing an App.tsx gibt (Neu anlegen). */
export interface IlanEkstra {
  durum: string
  ozellikler: Record<string, string>
}

/** Ein Merkmal-Feld aus GET /api/ilanlar/ozellikler/:kategori_id */
interface OzellikTanim {
  id: number
  alan_adi: string
  etiket: string
  zorunlu: boolean
  tip: 'secim' | 'metin' | 'sayi' | string
  secenekler: string[]
  serbest: boolean
}

/** Was die Maske beim Speichern eines bearbeiteten Inserats zurueckgibt. */
export interface IlanAenderung {
  uuid: string
  baslik: string
  aciklama: string
  fiyat: number
  kategoriSlug: string
  durum: string
  sehir: string
  ilce: string
  /** Vollstaendige Wunschreihenfolge: Bestands-URL oder "#yeni:N". */
  sirala: string[]
  ozellikler: Record<string, string>
  neueDateien: File[]
  video: File | null
  videoEntfernen: boolean
}

interface Props {
  onClose: () => void
  onAddListing: (listing: Listing, images?: File[], video?: File | null, ekstra?: IlanEkstra) => void
  /** Gesetzt = Bearbeiten-Modus. Die Maske bleibt dieselbe, nur vorbefuellt. */
  vorgabe?: IlanVorgabe | null
  /** Muss werfen, wenn das Speichern scheitert — die Maske faengt das ab. */
  onSave?: (aenderung: IlanAenderung) => Promise<void> | void
  /** Darf werfen — die Maske zeigt den Grund dann im Formular. */
  onDelete?: (uuid: string) => Promise<void> | void
}

/** Alter Code aus der Zeit vor v1.12 -> neuer Code (die DB ist umgeschluesselt). */
const DURUM_ALT: Record<string, string> = { ikinci_el: 'kullanilmis' }

export default function SellModal({ onClose: onCloseProp, onAddListing, vorgabe, onSave, onDelete }: Props) {
  // Browser-Zurück schließt das Fenster; X/Escape gehen per history.back() (K, v1.30)
  const onClose = useGeriKapat(true, onCloseProp, { escape: true })
  const bearbeiten = !!vorgabe
  const { kategoriler: ALL_CATEGORIES } = useKategoriAgac()

  const [title, setTitle] = useState(vorgabe?.baslik || '')
  const [price, setPrice] = useState(vorgabe ? String(vorgabe.fiyat ?? '') : '')
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [city, setCity] = useState(vorgabe?.sehir || 'İstanbul')
  const [district, setDistrict] = useState(vorgabe?.ilce || '')
  // Zustand als Code (Auftragssammlung M). Neu: bewusst leer, der Verkaeufer waehlt.
  const [condition, setCondition] = useState(
    vorgabe ? (DURUM_ALT[vorgabe.durum] || vorgabe.durum || '') : ''
  )
  // Kategorie-Merkmale (Marke, Modell, Yıl, KM …) je gewaehlter Kategorie.
  const [tanimlar, setTanimlar] = useState<OzellikTanim[]>([])
  const [ozellikDeger, setOzellikDeger] = useState<Record<string, string>>(vorgabe?.ozellikler || {})
  const [kiOneri, setKiOneri] = useState<string | null>(null)
  const [kiLaeuft, setKiLaeuft] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState(vorgabe?.aciklama || '')
  const [bilder, setBilder] = useState<Bild[]>(
    () => (vorgabe?.fotograflar || []).map((url) => ({ art: 'bestand' as const, url }))
  )
  const [video, setVideo] = useState<File | null>(null)
  const [videoVorschau, setVideoVorschau] = useState<string | null>(vorgabe?.videoUrl || null)
  const [videoBestand, setVideoBestand] = useState<boolean>(!!vorgabe?.videoUrl)
  const [videoHinweis, setVideoHinweis] = useState<string | null>(null)
  const [konumLaeuft, setKonumLaeuft] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [speichert, setSpeichert] = useState(false)

  // Die Kategorie kommt als EIN Slug zurueck; ob er eine Haupt- oder eine
  // Unterkategorie meint, steht nicht dabei. Der Baum wird deshalb einmal
  // rueckwaerts durchsucht, sobald er geladen ist. Ein Effect ist noetig, weil
  // useKategoriAgac() asynchron nachliefert — beim ersten Rendern ist er leer.
  useEffect(() => {
    if (!vorgabe?.kategoriSlug || !ALL_CATEGORIES.length || categoryId) return
    const haupt = ALL_CATEGORIES.find((k) => k.id === vorgabe.kategoriSlug)
    if (haupt) { setCategoryId(haupt.id); return }
    const eltern = ALL_CATEGORIES.find((k) => k.sub.some((x) => x.id === vorgabe.kategoriSlug))
    if (eltern) { setCategoryId(eltern.id); setSubCategoryId(vorgabe.kategoriSlug) }
  }, [vorgabe?.kategoriSlug, ALL_CATEGORIES, categoryId])

  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const selectedCat = ALL_CATEGORIES.find((c) => c.id === categoryId)

  // Merkmale der feinsten gewaehlten Kategorie laden. Die API haengt die Felder
  // der Elternkategorien an (Marke steht meist auf der Hauptkategorie).
  const kategorieDbId = dbIdVonSlug(ALL_CATEGORIES, subCategoryId || categoryId || null)
  useEffect(() => {
    if (!kategorieDbId) { setTanimlar([]); return }
    let aktiv = true
    ve.get<OzellikTanim[]>(`/ilanlar/ozellikler/${kategorieDbId}`)
      .then((t) => {
        if (!aktiv) return
        const liste = Array.isArray(t) ? t : []
        setTanimlar(liste)
        // Werte, die zur neuen Kategorie nicht gehoeren, verwerfen — sonst
        // gingen sie unsichtbar mit und die API wuerde sie ohnehin ignorieren.
        const ids = new Set(liste.map((x) => String(x.id)))
        setOzellikDeger((p) => Object.fromEntries(Object.entries(p).filter(([k]) => ids.has(k))))
      })
      .catch(() => { if (aktiv) setTanimlar([]) })
    return () => { aktiv = false }
  }, [kategorieDbId])

  const ozellikSetzen = (id: number, v: string) => {
    setOzellikDeger((p) => ({ ...p, [String(id)]: v }))
    setErrors((p) => { const { ozellik, ...rest } = p; return rest })
  }

  // Beschreibungsvorschlag ueber die vorhandene KI-Route (Claude, ai.service.js).
  const kiOner = async () => {
    if (!title.trim()) { setErrors((p) => ({ ...p, title: 'Öneri için önce başlık girin.' })); return }
    setKiLaeuft(true); setKiOneri(null)
    try {
      const marka = tanimlar.find((t) => t.alan_adi === 'marka')
      const d = await ve.post<{ aciklama: string }>('/ilanlar/ai/aciklama-oner', {
        baslik: [marka && ozellikDeger[String(marka.id)], title].filter(Boolean).join(' '),
        durum: DURUM_ETIKET[condition] || '',
        fiyat: price || '',
      })
      if (d?.aciklama) setKiOneri(d.aciklama)
      else setErrors((p) => ({ ...p, description: 'Şu anda öneri oluşturulamadı. Lütfen kendiniz yazın.' }))
    } catch (err: any) {
      setErrors((p) => ({ ...p, description: err?.message === 'Unauthorized' ? 'Lütfen giriş yapın.' : 'Şu anda öneri oluşturulamadı.' }))
    } finally { setKiLaeuft(false) }
  }

  const selectCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all'
  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all'
  const labelCls = 'block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5'

  // Bild-Nachweis fuer die Anzeige: Bestandsbild -> URL, neue Datei -> Vorschau.
  const quelle = (b: Bild) => (b.art === 'bestand' ? b.url : b.vorschau)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const gewaehlt = Array.from(e.target.files || [])
    if (e.target) e.target.value = ''
    const brauchbar = gewaehlt.filter((f) => f.type.startsWith('image/') && f.size <= FOTO_BYTE)
    const uebersprungen = gewaehlt.length - brauchbar.length
    const platz = Math.max(0, FOTO_MAX - bilder.length)
    const nehmen = brauchbar.slice(0, platz)
    const abgeschnitten = brauchbar.length - nehmen.length

    setErrors((p) => {
      const { foto, ...rest } = p
      if (uebersprungen > 0) return { ...rest, foto: `${uebersprungen} dosya atlandı (en fazla 10MB, sadece görsel).` }
      if (abgeschnitten > 0) return { ...rest, foto: `En fazla ${FOTO_MAX} fotoğraf eklenebilir.` }
      return rest
    })
    if (!nehmen.length) return
    // createObjectURL statt FileReader: kein Warten, und die Vorschau haengt
    // direkt am Eintrag — dadurch koennen Liste und Anzeige nicht auseinanderlaufen.
    setBilder((p) => [...p, ...nehmen.map((datei) => ({ art: 'neu' as const, datei, vorschau: URL.createObjectURL(datei) }))])
  }

  const removeImage = (idx: number) => {
    setBilder((p) => {
      const weg = p[idx]
      if (weg && weg.art === 'neu') URL.revokeObjectURL(weg.vorschau)
      return p.filter((_, i) => i !== idx)
    })
    setErrors((p) => { const { foto, ...rest } = p; return rest })
  }

  // Reihenfolge = Reihenfolge in der Galerie, das erste Bild wird das Titelbild.
  // Pfeile statt Ziehen: funktioniert auch auf dem Telefon und mit der Tastatur.
  const verschiebe = (idx: number, richtung: -1 | 1) => {
    setBilder((p) => {
      const ziel = idx + richtung
      if (ziel < 0 || ziel >= p.length) return p
      const k = [...p]
      ;[k[idx], k[ziel]] = [k[ziel], k[idx]]
      return k
    })
  }

  /**
   * Standort des Geraets ermitteln und Şehir/İlçe daraus vorbelegen.
   *
   * Die Umrechnung von Koordinaten in Namen macht der eigene Server
   * (GET /api/iller/konum) und nicht der Browser: so geht die Position des
   * Nutzers nicht direkt an einen Dritten, und der Server prueft das Ergebnis
   * gegen die Tabellen iller/ilceler.
   *
   * Verweigert der Nutzer die Freigabe, bleibt alles wie es ist — die Auswahl
   * von Hand funktioniert unveraendert weiter.
   */
  const konumuKullan = () => {
    if (!navigator.geolocation) {
      setErrors((p) => ({ ...p, konum: 'Tarayıcınız konum özelliğini desteklemiyor.' }))
      return
    }
    setKonumLaeuft(true)
    setErrors((p) => { const { konum, ...rest } = p; return rest })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const d = await ve.get<{ il: string; ilce: string | null }>(
            `/iller/konum?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          )
          // Server und Auswahlfeld lesen jetzt dieselben Tabellen (iller/ilceler).
          // Trotzdem vergleichend suchen: so bleibt es robust gegen Schreibweisen.
          const iller = await illerYukle()
          const il = iller.find((c) => tuerkischGleich(c.ad, d.il))
          if (!il) {
            setErrors((p) => ({ ...p, konum: `Konumunuz bulundu (${d.il}), ancak listede yok. Lütfen elle seçin.` }))
            return
          }
          const stadt = il.ad
          setCity(stadt)
          const bezirk = d.ilce ? (await ilcelerYukle(il.kod)).find((x) => tuerkischGleich(x, d.ilce!)) : null
          setDistrict(bezirk || '')
          setErrors((p) => {
            const { sehir, konum, ...rest } = p
            return d.ilce && !bezirk
              ? { ...rest, konum: `${stadt} seçildi. İlçe (${d.ilce}) listede bulunamadı, lütfen seçin.` }
              : rest
          })
        } catch (err: any) {
          setErrors((p) => ({ ...p, konum: err?.message || 'Konum belirlenemedi. Lütfen elle seçin.' }))
        } finally {
          setKonumLaeuft(false)
        }
      },
      (err) => {
        setKonumLaeuft(false)
        // Ausdrueckliche Meldung statt stillem Nichtstun — in Discover.tsx
        // merkt der Nutzer bis heute nicht, warum nichts passiert.
        setErrors((p) => ({
          ...p,
          konum: err.code === err.PERMISSION_DENIED
            ? 'Konum izni verilmedi. Şehir ve ilçeyi elle seçebilirsiniz.'
            : 'Konum alınamadı. Lütfen elle seçin.',
        }))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }

  const handleVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = (e.target.files || [])[0]
    if (e.target) e.target.value = ''
    if (!f) return
    if (!VIDEO_TYPEN.includes(f.type)) {
      setErrors((p) => ({ ...p, video: 'Sadece MP4, WebM veya MOV yükleyebilirsiniz.' }))
      return
    }
    if (f.size > VIDEO_BYTE) {
      setErrors((p) => ({ ...p, video: `Video en fazla 100MB olabilir (seçilen: ${(f.size / 1048576).toFixed(1)}MB).` }))
      return
    }
    const neueUrl = URL.createObjectURL(f)
    const dauer = await videoDauer(neueUrl)
    if (Number.isFinite(dauer) && dauer > VIDEO_MAX_SN + 0.5) {
      URL.revokeObjectURL(neueUrl)
      setErrors((p) => ({ ...p, video: `Video en fazla ${VIDEO_MAX_SN} saniye olabilir (seçilen: ${Math.round(dauer)} sn). Lütfen videoyu kısaltın.` }))
      return
    }
    setErrors((p) => { const { video, ...rest } = p; return rest })
    // Seit v1.28 wird jedes Video nach dem Speichern von der Medien-Engine
    // umgerechnet (720p) — das Inserat erscheint sofort, das Video kurz danach.
    setVideoHinweis('Video kaydettikten sonra otomatik olarak işlenir (720p). Bu sırada ilanda „Medya işleniyor…" görünür.')
    // Nur eigene Objekt-URLs freigeben; eine Server-URL darf nicht widerrufen werden.
    if (videoVorschau && !videoBestand) URL.revokeObjectURL(videoVorschau)
    setVideo(f)
    setVideoBestand(false)
    setVideoVorschau(neueUrl)
  }

  const removeVideo = () => {
    if (videoVorschau && !videoBestand) URL.revokeObjectURL(videoVorschau)
    setVideo(null)
    setVideoBestand(false)
    setVideoVorschau(null)
    setVideoHinweis(null)
    setErrors((p) => { const { video, ...rest } = p; return rest })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Bu alan zorunludur.'
    if (!price || parseFloat(price) <= 0) errs.price = 'Lütfen geçerli bir fiyat girin.'
    if (!categoryId) errs.kategori = 'Lütfen kategori seçin.'
    if (!city) errs.sehir = 'Lütfen şehir seçin.'
    if (!condition) errs.durum = 'Lütfen ürün durumunu seçin.'
    const fehlend = tanimlar.filter((t) => t.zorunlu && !String(ozellikDeger[String(t.id)] || '').trim())
    if (fehlend.length) errs.ozellik = `Zorunlu alan: ${fehlend.map((t) => t.etiket).join(', ')}`
    if (!description.trim() || description.trim().length < 10) errs.description = 'En az 10 karakter girin.'
    if (bilder.length === 0 && !(bearbeiten ? false : imageUrl.trim())) {
      errs.foto = bearbeiten ? 'En az 1 fotoğraf gerekli.' : 'En az 1 fotoğraf ekleyin veya görsel URL girin.'
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const slug = subCategoryId || categoryId
    // Nur Felder der aktuellen Kategorie und nur ausgefuellte Werte schicken.
    const ozellikler = Object.fromEntries(
      tanimlar.map((t) => [String(t.id), String(ozellikDeger[String(t.id)] || '').trim()]).filter(([, v]) => v)
    )

    // ── Bearbeiten ──
    if (bearbeiten && vorgabe && onSave) {
      // Wunschreihenfolge fuer die API: Bestandsbilder als URL, neue Dateien
      // als "#yeni:N" — N ist der Index in neueDateien. So kann ein neues Foto
      // auch VOR ein bestehendes rutschen und Titelbild werden.
      const neueDateien: File[] = []
      const sirala = bilder.map((b) => {
        if (b.art === 'bestand') return b.url
        neueDateien.push(b.datei)
        return `#yeni:${neueDateien.length - 1}`
      })
      setSpeichert(true)
      setErrors((prev) => { const { speichern, ...rest } = prev; return rest })
      // Ergebnis abwarten: scheitert das Speichern, muss der Knopf wieder
      // benutzbar werden. Sonst stuende er dauerhaft auf "Kaydediliyor…" und
      // der Nutzer koennte die Maske nur noch schliessen — und verloere genau
      // die Eingaben, die hier geschuetzt werden sollen.
      Promise.resolve(onSave({
        uuid: vorgabe.uuid,
        baslik: title,
        aciklama: description,
        fiyat: parseFloat(price),
        kategoriSlug: slug,
        durum: condition,
        sehir: city,
        ilce: district,
        sirala,
        ozellikler,
        neueDateien,
        video,
        // Nur melden, wenn wirklich ein Bestandsvideo weggenommen wurde —
        // sonst wuerde jedes Speichern ohne Video eines loeschen wollen.
        videoEntfernen: !!vorgabe.videoUrl && !videoVorschau,
      }))
        .catch((err: any) => {
          setErrors((prev) => ({ ...prev, speichern: err?.message || 'İlan güncellenemedi.' }))
        })
        .finally(() => setSpeichert(false))
      return
    }

    // ── Neu anlegen ──
    const subLabel = selectedCat?.sub?.find((x) => x.id === subCategoryId)?.label
    const categoryLabel = [selectedCat?.label, subLabel].filter(Boolean).join(' > ')
    const location = district ? `${city}, ${district}` : city
    const dateien = bilder.filter((b): b is Extract<Bild, { art: 'neu' }> => b.art === 'neu').map((b) => b.datei)

    const listing: Listing = {
      id: `listing_${Date.now()}`,
      title,
      price: parseFloat(price),
      category: categoryLabel,
      // Slug der feinsten gewaehlten Ebene — App.tsx loest daraus die
      // numerische kategori_id auf und sendet sie an die API.
      categorySlug: slug,
      location,
      date: 'Şimdi',
      image: (bilder[0] && quelle(bilder[0])) || imageUrl || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
      description,
      sellerName: 'Siz',
      sellerPhone: '',
      isFavorite: false,
      condition: DURUM_ETIKET[condition] || '',
    }
    onAddListing(listing, dateien.length ? dateien : undefined, video, { durum: condition, ozellikler })
  }

  // Bestaetigung ueber ein eigenes Modal statt window.confirm(): das native
  // Fenster sieht auf jedem Geraet anders aus, schreibt "kapbeni.com says…"
  // darueber und passt zu nichts auf dieser Seite.
  const [loeschFrage, setLoeschFrage] = useState(false)
  const [loescht, setLoescht] = useState(false)

  const handleDelete = async () => {
    if (!vorgabe || !onDelete) return
    setLoescht(true)
    try { await Promise.resolve(onDelete(vorgabe.uuid)) }
    catch (err: any) {
      setLoeschFrage(false)
      setErrors((prev) => ({ ...prev, speichern: err?.message || 'İlan silinemedi.' }))
    }
    finally { setLoescht(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-none md:rounded-3xl w-full max-w-xl shadow-2xl relative border border-gray-100 h-[100dvh] md:h-auto md:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{bearbeiten ? 'İlanı Düzenle' : 'Hemen İlan Verin'}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-4 flex-grow scrollbar-hide">
          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>
                Fotoğraf <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">{bilder.length}/{FOTO_MAX}</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFiles}
            />
            <div className="grid grid-cols-4 gap-2">
              {bilder.length < FOTO_MAX && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-red-50 transition-colors"
                >
                  <span className="text-2xl">📷</span>
                  <span className="text-[10px] text-gray-500">Ekle</span>
                </button>
              )}
              {bilder.map((b, idx) => (
                <div key={b.art === 'bestand' ? b.url : b.vorschau} className="aspect-square relative rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={quelle(b)} alt="" className="w-full h-full object-cover" />
                  {/* 28px statt 20px: auf einer 79px-Kachel am Telefon war das
                      alte Mass unter dem Mindestwert fuer Fingerbedienung. */}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label="Fotoğrafı kaldır"
                    className="absolute top-1 right-1 w-7 h-7 bg-black/60 text-white rounded-full text-sm flex items-center justify-center hover:bg-red-500"
                  >
                    ×
                  </button>
                  {/* Reihenfolge — das erste Bild ist das Titelbild */}
                  <div className="absolute inset-x-1 bottom-1 flex items-center gap-1">
                    {idx === 0 ? (
                      <span className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded">Kapak</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => verschiebe(idx, -1)}
                        aria-label="Öne al"
                        className="w-7 h-7 bg-black/60 text-white rounded-full text-sm leading-none flex items-center justify-center hover:bg-primary"
                      >
                        ‹
                      </button>
                    )}
                    {idx < bilder.length - 1 && (
                      <button
                        type="button"
                        onClick={() => verschiebe(idx, 1)}
                        aria-label="Geri al"
                        className="w-7 h-7 bg-black/60 text-white rounded-full text-sm leading-none flex items-center justify-center hover:bg-primary ml-auto"
                      >
                        ›
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">En az 1, en fazla {FOTO_MAX} fotoğraf. JPG, PNG, WebP. Maks 10MB/fotoğraf. İlk fotoğraf kapak olur, oklarla sıralayın.</p>
            {!bearbeiten && (
              <input
                type="text"
                placeholder="Veya görsel URL'si yapıştırın (opsiyonel)..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={inputCls + ' mt-2'}
              />
            )}
            {errors.foto && <span className="text-red-500 text-xs mt-1 block">{errors.foto}</span>}
          </div>

          {/* Video — optional, genau eines je Inserat */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>Video <span className="text-gray-400 normal-case font-semibold">(opsiyonel)</span></label>
              <span className="text-xs text-gray-400">{video ? '1/1' : '0/1'}</span>
            </div>
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={handleVideo}
            />
            {videoVorschau ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black">
                <video src={videoVorschau} controls playsInline className="w-full max-h-56 object-contain" />
                <button
                  type="button"
                  onClick={removeVideo}
                  aria-label="Videoyu kaldır"
                  className="absolute top-1 right-1 w-8 h-8 bg-black/60 text-white rounded-full text-base flex items-center justify-center hover:bg-red-500"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-5 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-red-50 transition-colors"
              >
                <span className="text-2xl">🎬</span>
                <span className="text-[11px] text-gray-500">Video ekle</span>
              </button>
            )}
            <p className="text-[11px] text-gray-400 mt-2">1 video, en fazla 60 saniye ve 100MB. MP4, WebM veya MOV. Her video otomatik olarak küçültülür.</p>
            {videoHinweis && (
              <p className="text-[11px] text-secondary mt-1 flex items-start gap-1">
                <i className="ti ti-info-circle" style={{ fontSize: 13, marginTop: 1 }} />
                {videoHinweis}
              </p>
            )}
            {errors.video && <span className="text-red-500 text-xs mt-1 block">{errors.video}</span>}
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>İlan Başlığı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Tertemiz Çiziksiz iPhone 15 Pro"
              className={inputCls}
            />
            {errors.title && <span className="text-red-500 text-xs mt-1 block">{errors.title}</span>}
          </div>

          {/* Category */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Kategori</label>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setSubCategoryId('') }}
                  className={selectCls}
                >
                  <option value="">Kategori seçin</option>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{mitAnzahl(c.label, c.adet)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>
              {errors.kategori && <span className="text-red-500 text-xs mt-1 block">{errors.kategori}</span>}
            </div>
            {selectedCat?.sub && selectedCat.sub.length > 0 && (
              <div>
                <label className={labelCls}>Alt Kategori</label>
                <div className="relative">
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Alt kategori seçin</option>
                    {selectedCat.sub.map((s) => (
                      <option key={s.id} value={s.id}>{mitAnzahl(s.label, s.adet)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Kategorie-Merkmale — dynamisch je Kategorie (Auftragssammlung M).
              Marke als Combobox (Liste + freie Eingabe), Auswahlfelder als
              Select, Zahlen numerisch. */}
          {tanimlar.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {tanimlar.map((t) => {
                const wert = ozellikDeger[String(t.id)] || ''
                const etikett = (
                  <label className={labelCls}>
                    {t.etiket}{t.zorunlu && <span className="text-red-500"> *</span>}
                  </label>
                )
                if (t.serbest) return (
                  <div key={t.id} className={t.alan_adi === 'marka' ? 'col-span-2 sm:col-span-1' : ''}>
                    {etikett}
                    <Combobox value={wert} onChange={(v) => ozellikSetzen(t.id, v)} secenekler={t.secenekler}
                      placeholder="Seçin veya yazın" className={inputCls} ariaLabel={t.etiket} />
                  </div>
                )
                if (t.tip === 'secim') return (
                  <div key={t.id}>
                    {etikett}
                    <div className="relative">
                      <select value={wert} onChange={(e) => ozellikSetzen(t.id, e.target.value)} className={selectCls} aria-label={t.etiket}>
                        <option value="">Seçin</option>
                        {t.secenekler.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                    </div>
                  </div>
                )
                return (
                  <div key={t.id}>
                    {etikett}
                    <input
                      type="text"
                      inputMode={t.tip === 'sayi' ? 'numeric' : undefined}
                      value={wert}
                      maxLength={t.tip === 'sayi' ? 9 : 120}
                      onChange={(e) => ozellikSetzen(t.id, t.tip === 'sayi' ? e.target.value.replace(/\D/g, '') : e.target.value)}
                      placeholder={t.alan_adi === 'yil' ? 'Örn: 2019' : t.alan_adi === 'km' ? 'Örn: 85000' : ''}
                      className={inputCls}
                      aria-label={t.etiket}
                    />
                  </div>
                )
              })}
              {errors.ozellik && <span className="col-span-2 text-red-500 text-xs -mt-2 block">{errors.ozellik}</span>}
            </div>
          )}

          {/* Price & Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fiyat (₺)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Örn: 45000"
                className={inputCls}
              />
              {errors.price && <span className="text-red-500 text-xs mt-1 block">{errors.price}</span>}
            </div>
            <div>
              <label className={labelCls}>Durum</label>
              <div className="relative">
                <select
                  value={condition}
                  onChange={(e) => { setCondition(e.target.value); setErrors((p) => { const { durum, ...rest } = p; return rest }) }}
                  className={selectCls}
                  aria-label="Durum"
                >
                  <option value="">Durum seçin</option>
                  {DURUM_SECENEKLERI.map((d) => <option key={d.kod} value={d.kod}>{d.etiket}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>
              {condition && (
                <span className="text-[11px] text-gray-400 mt-1 block">
                  {DURUM_SECENEKLERI.find((d) => d.kod === condition)?.aciklama}
                </span>
              )}
              {errors.durum && <span className="text-red-500 text-xs mt-1 block">{errors.durum}</span>}
            </div>
          </div>

          {/* City & District */}
          <div className="flex items-center justify-between mb-1.5">
            <label className={labelCls + ' mb-0'}>Konum</label>
            <button
              type="button"
              onClick={konumuKullan}
              disabled={konumLaeuft}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary border border-gray-200 hover:border-primary rounded-lg px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <i className="ti ti-current-location" style={{ fontSize: 14 }} />
              {konumLaeuft ? 'Alınıyor…' : 'Konumu Kullan'}
            </button>
          </div>
          {errors.konum && <span className="text-secondary text-xs mb-2 block">{errors.konum}</span>}
          {/* Combobox statt <select>: ein gespeicherter Bezirk, den die Liste
              nicht kennt, bleibt als freier Text erhalten statt zu verschwinden. */}
          <div className="grid grid-cols-2 gap-4">
            <IlIlceAlanlari
              il={city}
              ilce={district}
              onIl={setCity}
              onIlce={setDistrict}
              inputCls={inputCls}
              labelCls={labelCls}
              ilLabel="Şehir"
              ilHata={errors.sehir}
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>Açıklama</label>
              <button
                type="button"
                onClick={kiOner}
                disabled={kiLaeuft}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary border border-gray-200 hover:border-primary rounded-lg px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {kiLaeuft ? 'Hazırlanıyor…' : 'KI ile açıklama öner'}
              </button>
            </div>
            {kiOneri && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                <p className="text-xs text-gray-700 whitespace-pre-line">{kiOneri}</p>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => { setDescription(kiOneri); setKiOneri(null) }}
                    className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Kullan</button>
                  <button type="button" onClick={() => setKiOneri(null)}
                    className="bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg">Kapat</button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Öneriyi kontrol edin; telefon, IBAN veya WhatsApp bilgisi eklemeyin.</p>
              </div>
            )}
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürünün teknik özellikleri, kullanım ömrü, çizik veya deformasyon durumları hakkında detaylı bilgi verin..."
              className={`${inputCls} resize-none`}
            />
            {errors.description && <span className="text-red-500 text-xs mt-1 block">{errors.description}</span>}
          </div>

          {errors.speichern && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">
              {errors.speichern}
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-bold text-sm transition-all text-center cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={speichert}
              className="w-1/2 bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-95 text-center cursor-pointer disabled:opacity-50"
            >
              {bearbeiten ? (speichert ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet') : 'İlanı Yayınla'}
            </button>
          </div>

          {/* Loeschen steht bewusst abgesetzt unter den Hauptknoepfen und in
              der Umriss-Form der uebrigen Warnknoepfe (vgl. Details.tsx),
              damit es nicht neben "Speichern" wie eine gleichwertige Wahl wirkt. */}
          {bearbeiten && onDelete && (
            <button
              type="button"
              onClick={() => setLoeschFrage(true)}
              className="w-full mt-1 flex items-center justify-center gap-2 border border-red-200 bg-white text-red-500 hover:text-red-700 hover:border-red-400 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer"
            >
              <i className="ti ti-trash" style={{ fontSize: 16 }} /> İlanı Sil
            </button>
          )}
        </form>
      </div>

      <OnayModal
        offen={loeschFrage}
        titel="İlanı sil"
        text="Bu ilan kalıcı olarak silinecek. Fotoğrafları ve videosu da kaldırılacak. Emin misiniz?"
        bestaetigen="Evet, sil"
        gefaehrlich
        icon="trash"
        laeuft={loescht}
        onBestaetigen={handleDelete}
        onAbbrechen={() => setLoeschFrage(false)}
      />
    </div>
  )
}
