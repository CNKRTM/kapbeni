import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { ArrowLeft, Heart, Trash2, X, MapPin, MessageSquare, Phone, ShieldCheck, Check, Mail, ChevronDown, AlertTriangle } from 'lucide-react'
import { Listing, ve } from '../api'
import { invalidateKategoriAgac } from '../data/kategoriAgac'
import { useAuth } from '../context/AuthContext'
import BenzerIlanlar from '../components/BenzerIlanlar'
import PaylasMenu from '../components/PaylasMenu'
import OnayModal from '../components/OnayModal'

interface Props {
  listing: Listing
  onBack: () => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  onStartChat: (listing: Listing) => void
  /** Kontakt-Shortcut: oeffnet den Chat mit vorformulierter Kaufabsicht. Kein Checkout. */
  onHemenAl?: (listing: Listing) => void
  onViewSeller?: (id: string) => void
  /** Ein Inserat aus "Benzer Ilanlar" oeffnen — erzeugt eine eigene History-Station. */
  onSelectListing?: (listing: Listing) => void
  /** Kategorie-Chip unter "Benzer Ilanlar" — wechselt in die Kategorieansicht. */
  onSelectCategory?: (slug: string) => void
  /** Bearbeiten — nur fuer den Ersteller sichtbar, siehe isOwner. */
  onEdit?: (ilanId: string) => void
  /** Nach erfolgreichem Loeschen: Liste bereinigen und Ansicht verlassen. */
  onDeleted?: (ilanId: string) => void
}

// Gleiche Status-Farben und Etiketten wie im Panel (pages/Dashboard.tsx),
// damit ein Gebot ueberall identisch aussieht.
const TEKLIF_DURUM_RENK: Record<string, [string, string]> = {
  bekliyor: ['#92400e', '#fef3c7'], kabul: ['#15803d', '#f0fdf4'],
  reddedildi: ['#dc2626', '#fef2f2'], suresi_doldu: ['#6b7280', '#f3f4f6'],
}
const TEKLIF_DURUM_ETIKET: Record<string, string> = {
  bekliyor: 'Cevap Bekliyor', kabul: 'Kabul Edildi',
  reddedildi: 'Reddedildi', suresi_doldu: 'Süresi Doldu',
}

const REPORT_TYPES = [
  { v: 'platformda_olmamali', l: 'Bu ilan platformda olmamalı' },
  { v: 'yasa_disi', l: 'Yasa dışı ürün veya içerik' },
  { v: 'dolandiricilik', l: 'Dolandırıcılık şüphesi' },
  { v: 'yaniltici_ilan', l: 'Yanıltıcı veya eksik ilan bilgisi' },
  { v: 'spam', l: 'Spam veya tekrarlayan ilan' },
  { v: 'diger', l: 'Diğer' },
]

export default function Details({ listing, onBack, onToggleFavorite, onStartChat, onHemenAl, onViewSeller, onSelectListing, onSelectCategory, onEdit, onDeleted }: Props) {
  const [showPhone, setShowPhone] = useState(false)
  const { user } = useAuth()
  const [isOwner, setIsOwner] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sellerAvatar, setSellerAvatar] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [ilanNo, setIlanNo] = useState<string | null>(null)
  const [kurumsal, setKurumsal] = useState<any>(null)
  const [sellerUuid, setSellerUuid] = useState<string | null>(null)
  const [ilanNumId, setIlanNumId] = useState<number | null>(null)
  const [takip, setTakip] = useState(false)
  const [takipSayisi, setTakipSayisi] = useState(0)
  const [teslimat, setTeslimat] = useState<{ elden: boolean; kargo: boolean }>({ elden: false, kargo: false })
  const [teklifModal, setTeklifModal] = useState(false)
  const [teklifFiyat, setTeklifFiyat] = useState('')
  const [teklifMesaj, setTeklifMesaj] = useState('')
  const [teklifGonderildi, setTeklifGonderildi] = useState(false)
  // Verlauf der eigenen Gebote zu diesem Inserat. Die API kennt keine
  // Gegenangebote — es gibt eine Zeile je abgegebenem Gebot, chronologisch.
  const [teklifGecmisi, setTeklifGecmisi] = useState<any[]>([])
  const [showReport, setShowReport] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportDesc, setReportDesc] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  // Galerie: Fotos und optionales Video kommen aus derselben Detail-Antwort,
  // die weiter unten ohnehin geholt wird — keine zusaetzliche Anfrage.
  const [medien, setMedien] = useState<{ fotos: string[]; video: string | null }>({ fotos: [], video: null })
  const [aktiv, setAktiv] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  // Stationen der Galerie: erst die Fotos, dann das Video (es gibt hoechstens
  // eines). Solange die Detail-Antwort unterwegs ist, steht das Titelbild aus
  // der Liste da, damit kein leerer Rahmen entsteht.
  //
  // Das stand frueher in einer sofort ausgefuehrten Funktion mitten im JSX.
  // Dort war es aus einem useEffect (Tastatur) und aus einem ausserhalb
  // gerenderten Modal nicht erreichbar — deshalb jetzt auf Komponentenebene.
  const stationen = useMemo(() => {
    const fotos = medien.fotos.length ? medien.fotos : (listing.image ? [listing.image] : [])
    return [
      ...fotos.map((u) => ({ art: 'foto' as const, url: u })),
      ...(medien.video ? [{ art: 'video' as const, url: medien.video }] : []),
    ]
  }, [medien, listing.image])

  const i = Math.min(aktiv, Math.max(0, stationen.length - 1))
  const jetzt = stationen[i]
  // Vom GEKLAMMERTEN Index aus weiterzaehlen, nicht vom rohen `aktiv`: liefert
  // die Detail-Antwort weniger Stationen als vorher, stuende `aktiv` sonst
  // ausserhalb und der Pfeil spraenge von einer unsichtbaren Position aus.
  const springe = useCallback(
    (d: number) => setAktiv(() => {
      if (!stationen.length) return 0
      const jetztIdx = Math.min(aktiv, stationen.length - 1)
      return (jetztIdx + d + stationen.length) % stationen.length
    }),
    [aktiv, stationen.length]
  )

  // Tastatur — nur solange die Lightbox offen ist, damit die Pfeiltasten sonst
  // das normale Scrollen nicht stoeren.
  useEffect(() => {
    if (!lightbox) return
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      else if (e.key === 'ArrowLeft') springe(-1)
      else if (e.key === 'ArrowRight') springe(1)
    }
    document.addEventListener('keydown', taste)
    return () => document.removeEventListener('keydown', taste)
  }, [lightbox, springe])

  // Hintergrund nicht mitscrollen lassen, solange die Lightbox offen ist.
  useEffect(() => {
    if (!lightbox) return
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = vorher }
  }, [lightbox])

  // Wischen auf dem Telefon. Es gibt im Projekt noch keine Geste, deshalb
  // bewusst schlicht: nur die waagerechte Strecke zaehlt, und erst ab 50 px.
  const wischStart = useRef<{ x: number; y: number } | null>(null)
  const wischAnfang = (e: React.TouchEvent) => {
    const t = e.touches[0]
    wischStart.current = { x: t.clientX, y: t.clientY }
  }
  const wischEnde = (e: React.TouchEvent) => {
    const a = wischStart.current
    wischStart.current = null
    if (!a) return
    const t = e.changedTouches[0]
    const dx = t.clientX - a.x
    const dy = t.clientY - a.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    springe(dx < 0 ? 1 : -1)
  }

  useEffect(() => {
    let active = true
    setIsOwner(false)
    setSellerAvatar(null)
    setIlanNo(null)
    setKurumsal(null)
    setMedien({ fotos: [], video: null })
    setAktiv(0)
    if (!listing?.id) return
    // Ueber den Client `ve`, NICHT ueber rohes fetch: die API kennt keinen
    // Cookie-Pfad, `credentials:'include'` schickt also keinen Token mit. Ohne
    // Authorization-Header greift die Eigentuemer-Ausnahme der Detail-Route
    // nicht — der Eigentuemer bekaeme fuer sein eigenes zurueckgezogenes
    // Inserat 404 und damit weder Düzenle noch Sil zu sehen.
    ve.get<any>(`/ilanlar/${listing.id}`)
      .then((data: any) => {
        if (!active || !data) return
        setSellerAvatar(data.avatar_url || null)
        setIsVerified(data.satici_kyc === 'onaylandi')
        setIlanNo(data.ilan_no || null)
        setKurumsal({ hesap_tipi: data.hesap_tipi, firma_adi: data.firma_adi, vkn: data.vkn })
        setSellerUuid(data.satici_uuid || (data.user_id != null ? String(data.user_id) : null))
        setIlanNumId(data.id != null ? Number(data.id) : null)
        setTeslimat({ elden: !!data.teslimat_elden, kargo: !!data.teslimat_kargo })
        // sira kommt sortiert aus der API; ana_foto nach vorn, falls doch nicht.
        const fotos = (Array.isArray(data.fotograflar) ? data.fotograflar : [])
          .slice()
          .sort((a: any, b: any) => (b.ana_foto ? 1 : 0) - (a.ana_foto ? 1 : 0) || (a.sira ?? 0) - (b.sira ?? 0))
          .map((f: any) => f.url)
          .filter(Boolean)
        setMedien({ fotos, video: data.video_url || null })
        if (user) setIsOwner(data.satici_id === user.id || data.user_id === user.id)
      })
      .catch(() => {})
    return () => { active = false }
  }, [user, listing?.id])

  // overnight5: Görüntülenme sayacı (öffentlich) + Takip durumu (Token-Auth über ve)
  useEffect(() => {
    if (!ilanNumId) return
    fetch(`/api/ilanlar/${ilanNumId}/view`, { method: 'POST' }).catch(() => {})
    if (!user) { setTakip(false); return }
    let active = true
    ve.get<{ takip: boolean; sayi: number }>(`/ilanlar/${ilanNumId}/takip`)
      .then((d) => { if (active && d) { setTakip(!!d.takip); setTakipSayisi(d.sayi || 0) } })
      .catch(() => {})
    return () => { active = false }
  }, [ilanNumId, user])

  const handleTakip = async () => {
    if (!ilanNumId || !user) return
    try {
      const d = await ve.post<{ takip: boolean }>(`/ilanlar/${ilanNumId}/takip`)
      setTakip(!!d.takip)
      setTakipSayisi((p) => (d.takip ? p + 1 : Math.max(0, p - 1)))
    } catch {
      alert('İşlem tamamlanamadı. Lütfen tekrar deneyin.')
    }
  }

  const teklifGecmisiYukle = () => {
    if (!user) return
    ve.get<any[]>(`/teklifler?rol=alici&ilan_uuid=${listing.id}`)
      .then((d) => setTeklifGecmisi(Array.isArray(d) ? d : []))
      .catch(() => setTeklifGecmisi([]))
  }

  // overnight6 Phase 3c: Teklif gönder (echtes Backend erwartet ilan_uuid = listing.id, Token-Auth über ve)
  const handleTeklifGonder = async () => {
    if (!teklifFiyat || parseFloat(teklifFiyat) <= 0) return
    try {
      await ve.post('/teklifler', {
        ilan_uuid: listing.id,
        teklif_fiyat: parseFloat(teklifFiyat),
        mesaj: teklifMesaj,
      })
      setTeklifGonderildi(true)
      teklifGecmisiYukle()
      setTimeout(() => { setTeklifModal(false); setTeklifGonderildi(false); setTeklifFiyat(''); setTeklifMesaj('') }, 1800)
    } catch {
      alert('Teklif gönderilemedi. Lütfen tekrar deneyin.')
    }
  }

  const [loeschFrage, setLoeschFrage] = useState(false)

  const handleDelete = async () => {
    // Bestaetigung laeuft ueber OnayModal, nicht ueber window.confirm() —
    // siehe components/OnayModal.tsx.
    setIsDeleting(true)
    try {
      await ve.del(`/ilanlar/${listing.id}`)
      invalidateKategoriAgac()   // Kategorie-Zaehler nach dem Loeschen auffrischen
      // onDeleted nimmt das Inserat aus der Liste und geht zurueck. Frueher
      // lief nur onBack() — die Startseite laedt ihre Liste aber nicht neu,
      // das geloeschte Inserat stand danach weiter da und das Loeschen sah
      // wirkungslos aus.
      if (onDeleted) onDeleted(listing.id)
      else onBack()
    } catch (err: any) {
      // Die API schreibt den Grund nach `hata`; der Client liest ihn seit dem
      // Fix in api/index.ts auch aus, statt immer 'Hata oluştu' zu melden.
      setLoeschFrage(false)
      alert(err?.message === 'Unauthorized'
        ? 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.'
        : (err?.message || 'İlan silinemedi. Lütfen tekrar deneyin.'))
      setIsDeleting(false)
    }
  }

  const handleReport = async () => {
    if (!reportType) return
    try {
      await ve.post('/sikayet', {
        ilan_uuid: listing.id,
        sikayet_tipi: reportType,
        aciklama: reportDesc,
      })
      setReportSent(true)
    } catch {
      alert('Şikayet gönderilemedi. Lütfen tekrar deneyin.')
    }
  }

  const price = `₺${listing.price.toLocaleString('tr-TR')}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="py-6 max-w-5xl mx-auto"
    >
      {/* Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-primary font-bold transition-colors cursor-pointer group"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          Geri Dön
        </button>
        <div className="flex items-center gap-3">
          <PaylasMenu ilanId={listing.id} baslik={listing.title} fiyat={listing.price} />
          <button
            onClick={(e) => onToggleFavorite(listing.id, e)}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-all shadow-xs cursor-pointer"
          >
            <Heart className={`h-4.5 w-4.5 ${listing.isFavorite ? 'fill-primary text-primary' : 'text-gray-500'}`} />
          </button>
          {isOwner && onEdit && (
            <button
              onClick={() => onEdit(listing.id)}
              className="h-10 px-3 rounded-full border border-gray-200 bg-white flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary hover:border-primary transition-all shadow-xs cursor-pointer"
            >
              <i className="ti ti-pencil" style={{ fontSize: 16 }} /> Düzenle
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setLoeschFrage(true)}
              disabled={isDeleting}
              className="h-10 px-3 rounded-full border border-red-200 bg-white flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:border-red-400 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Sil
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Image + safety tip */}
        <div className="lg:col-span-7 space-y-4">
          {/* Galerie — Fotos plus optionales Video. Solange die Detail-Antwort
              noch unterwegs ist, steht hier das Titelbild aus der Liste, damit
              es keinen leeren Rahmen und kein Springen gibt. */}
          <div
            className={`relative bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm aspect-square md:aspect-video lg:aspect-square flex items-center justify-center ${
              jetzt?.art === 'foto' ? 'cursor-zoom-in' : ''
            }`}
            onTouchStart={wischAnfang}
            onTouchEnd={wischEnde}
          >
            {jetzt?.art === 'video' ? (
              <video src={jetzt.url} controls playsInline className="w-full h-full object-contain bg-black" />
            ) : (
              // Nur Fotos oeffnen die Lightbox. Beim Video wuerde der Klick mit
              // den eingebauten Bedienelementen kollidieren.
              <img
                alt={listing.title}
                className="w-full h-full object-cover"
                src={jetzt?.url || listing.image}
                referrerPolicy="no-referrer"
                onClick={() => setLightbox(true)}
              />
            )}
            <span className="absolute top-4 left-4 text-xs font-extrabold tracking-wide uppercase px-3 py-1 bg-primary text-white rounded shadow-sm pointer-events-none">
              {listing.condition}
            </span>
            {stationen.length > 1 && (
              <>
                <button
                  onClick={() => springe(-1)}
                  aria-label="Önceki"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 border border-gray-100 shadow-sm flex items-center justify-center text-gray-600 hover:text-primary transition-colors cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </button>
                <button
                  onClick={() => springe(1)}
                  aria-label="Sonraki"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 border border-gray-100 shadow-sm flex items-center justify-center text-gray-600 hover:text-primary transition-colors cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </button>
                <span className="absolute bottom-4 right-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/60 text-white pointer-events-none">
                  {i + 1} / {stationen.length}
                </span>
              </>
            )}
          </div>

          {stationen.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {stationen.map((st, idx) => (
                <button
                  key={st.url + idx}
                  onClick={() => setAktiv(idx)}
                  aria-label={st.art === 'video' ? 'Video' : `Fotoğraf ${idx + 1}`}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors cursor-pointer ${
                    idx === i ? 'border-primary' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  {st.art === 'video' ? (
                    <span className="w-full h-full bg-gray-900 flex items-center justify-center">
                      <i className="ti ti-player-play-filled" style={{ color: '#fff', fontSize: 18 }} />
                    </span>
                  ) : (
                    <img src={st.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                </button>
              ))}
            </div>
          )}
          {/* İlan Özellikleri */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <i className="ti ti-list-details" style={{ color: '#e53935', fontSize: 18 }} />
              <span className="font-bold text-gray-900 text-sm">İlan Özellikleri</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ilanNo && (
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-gray-500 font-medium">İlan No</span>
                  <span className="text-xs font-bold text-gray-800 font-mono">#{ilanNo}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-gray-500 font-medium">Durum</span>
                <span className="text-xs font-bold text-gray-800">{listing.condition}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-gray-500 font-medium">Kategori</span>
                <span className="text-xs font-bold text-gray-800">{listing.category}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-gray-500 font-medium">Konum</span>
                <span className="text-xs font-bold text-gray-800">{listing.location}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-xs text-gray-500 font-medium">Yayın Tarihi</span>
                <span className="text-xs font-bold text-gray-800">{listing.date}</span>
              </div>
            </div>
          </div>

          {/* Konumu Haritada Gör */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setMapOpen(p => !p)}
              className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Konumu Haritada Gör</p>
                  <p className="text-xs text-gray-500">{listing.location}</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${mapOpen ? 'rotate-180' : ''}`} />
            </button>
            {mapOpen && (
              <div className="px-5 pb-4">
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(listing.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-primary border border-primary/20 hover:bg-primary/5 transition-colors"
                >
                  <MapPin className="h-4 w-4" /> Google Maps'te Aç
                </a>
              </div>
            )}
          </div>

          {/* Güvenli Alışveriş */}
          <div className="bg-gradient-to-br from-primary/5 to-red-500/5 rounded-2xl p-5 border border-primary/10 flex gap-4 items-start">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex-shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm mb-1">Kap Beni Güvenli Alışveriş Tavsiyesi</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Yüz yüze görüşerek ürünü deneyerek satın almanızı tavsiye ederiz. Uzaktan alışverişlerde güvenmediğiniz para transferi taleplerine karşı dikkatli olunuz.
              </p>
              <a href="/#/iade-politikasi" className="text-xs text-primary font-semibold hover:underline mt-1.5 inline-block">İade ve Geri Ödeme Politikası</a>
            </div>
          </div>
        </div>

        {/* Right: Info + Seller */}
        <div className="lg:col-span-5 space-y-6">
          {/* Listing details */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <div>
              {ilanNo && <p className="text-xs text-gray-400 mb-1 font-mono">İlan No: #{ilanNo}</p>}
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-primary bg-primary/5 px-2.5 py-1 rounded">
                {listing.category}
              </span>
              <h1 className="text-2xl font-black text-gray-900 leading-tight mt-3">{listing.title}</h1>
              <p className="text-3xl font-black text-primary tracking-tight mt-2">{price}</p>
            </div>
            <hr className="border-gray-100" />
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-2">Açıklama</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                {listing.description}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400 font-semibold pt-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gray-400" />
                {listing.location}
              </span>
              <span>Yayınlanma: {listing.date}</span>
            </div>
          </div>

          {/* Seller info */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Satıcı Bilgileri</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center text-primary font-bold text-base shadow-inner overflow-hidden">
                {sellerAvatar ? (
                  <img src={sellerAvatar} alt={listing.sellerName} className="w-full h-full object-cover" />
                ) : listing.sellerName.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">{listing.sellerName}</h4>
                <p className="text-xs text-gray-500">Üyelik Tarihi: 2024</p>
                {sellerUuid && onViewSeller && !isOwner && (
                  <button
                    onClick={() => onViewSeller(sellerUuid)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#e53935', fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, textDecoration: 'underline' }}
                  >
                    Satıcı Profilini Gör
                  </button>
                )}
              </div>
              {isVerified && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                  <ShieldCheck className="h-3 w-3" /> Onaylı Satıcı
                </span>
              )}
            </div>

            {kurumsal?.hesap_tipi === 'kurumsal' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">Kurumsal Satıcı</span>
                </div>
                {kurumsal.firma_adi && <p className="text-sm font-semibold text-blue-900">{kurumsal.firma_adi}</p>}
                {kurumsal.vkn && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    VKN: {String(kurumsal.vkn).slice(0, 3)}{'*'.repeat(Math.max(0, String(kurumsal.vkn).length - 5))}{String(kurumsal.vkn).slice(-2)}
                  </p>
                )}
                <p className="text-xs text-blue-400 mt-1.5 leading-relaxed">
                  TKHK m.48 kapsamında satın almadan itibaren 14 gün cayma hakkınız bulunmaktadır.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onStartChat(listing)}
                  className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <MessageSquare className="h-4.5 w-4.5" /> Mesaj Gönder
                </button>
                {onHemenAl && !isOwner && (
                  <button
                    onClick={() => onHemenAl(listing)}
                    className="w-full bg-tertiary hover:bg-tertiary/95 text-white py-3 rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <i className="ti ti-shopping-cart" style={{ fontSize: 17 }} /> Hemen Al
                  </button>
                )}
                <button
                  onClick={() => setShowPhone(!showPhone)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Phone className="h-4.5 w-4.5 text-gray-500" />
                  {showPhone ? listing.sellerPhone : 'Numarayı Göster'}
                </button>
              </div>
              {!isOwner && (
                <a
                  href="mailto:destek@kapbeni.com"
                  className="w-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer no-underline"
                >
                  <Mail className="h-4.5 w-4.5 text-gray-500" /> E-Posta ile İletişim
                </a>
              )}
            </div>

            {user && !isOwner && ilanNumId && (
              <button
                onClick={handleTakip}
                className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border"
                style={{
                  border: takip ? '1.5px solid #e53935' : '1.5px solid #e5e7eb',
                  background: takip ? '#fff5f5' : '#fff',
                  color: takip ? '#e53935' : '#374151',
                }}
              >
                <i className={`ti ${takip ? 'ti-heart-filled' : 'ti-heart'}`} style={{ fontSize: 16 }} />
                {takip ? 'Takip Ediliyor' : 'Takip Et'}{takipSayisi > 0 ? ` · ${takipSayisi}` : ''}
              </button>
            )}

            {user && !isOwner && (
              <button
                onClick={() => { setTeklifModal(true); teklifGecmisiYukle() }}
                className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer text-white"
                style={{ background: '#1a2e4a' }}
              >
                <i className="ti ti-tag" style={{ fontSize: 16 }} /> Teklif Yap
              </button>
            )}

            {(teslimat.elden || teslimat.kargo) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {teslimat.elden && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                    <i className="ti ti-hand-stop" /> Elden Teslim
                  </span>
                )}
                {teslimat.kargo && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                    <i className="ti ti-package" /> Kargo ile Gönderilir
                  </span>
                )}
              </div>
            )}

            {!isOwner && (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => setShowReport(true)}
                  className="w-full border border-red-200 bg-white hover:bg-red-50 text-red-500 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <AlertTriangle className="h-4.5 w-4.5" /> Şikayet Et
                </button>
                <a href="/#/iade-politikasi" className="text-center text-xs text-gray-400 hover:text-primary transition-colors underline-offset-2 hover:underline">
                  İade ve Geri Ödeme Politikası
                </a>
              </div>
            )}
          </div>


        </div>
      </div>

      {/* Bilder-Modal (Lightbox).
          Dieselbe Datenquelle wie die Galerie auf der Seite (stationen) — es
          gibt bewusst keine zweite Liste, sonst liefen beide auseinander.
          Ueber createPortal an document.body, wie die uebrigen Overlays des
          Projekts; sonst haengt es im Detail-Container mit seinen Radien und
          overflow-hidden fest. */}
      {lightbox && jetzt && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Fotoğraflar"
          onClick={() => setLightbox(false)}
        >
          {/* Kopfzeile: Zaehler links, Schliessen rechts */}
          <div className="flex items-center justify-between px-4 py-3 text-white/90 flex-shrink-0">
            <span className="text-sm font-bold">
              {stationen.length > 1 ? `${i + 1} / ${stationen.length}` : ''}
            </span>
            <button
              onClick={() => setLightbox(false)}
              aria-label="Kapat"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Bildflaeche. stopPropagation, damit ein Klick auf das Bild selbst
              nicht schliesst — daneben schon. */}
          <div
            className="flex-1 min-h-0 relative flex items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={wischAnfang}
            onTouchEnd={wischEnde}
          >
            {jetzt.art === 'video' ? (
              <video src={jetzt.url} controls playsInline autoPlay className="max-w-full max-h-full" />
            ) : (
              <img
                src={jetzt.url}
                alt={listing.title}
                className="max-w-full max-h-full object-contain select-none"
                referrerPolicy="no-referrer"
                draggable={false}
              />
            )}

            {stationen.length > 1 && (
              <>
                <button
                  onClick={() => springe(-1)}
                  aria-label="Önceki"
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronDown className="h-5 w-5 rotate-90" />
                </button>
                <button
                  onClick={() => springe(1)}
                  aria-label="Sonraki"
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronDown className="h-5 w-5 -rotate-90" />
                </button>
              </>
            )}
          </div>

          {/* Vorschaukacheln — gleiche Form wie auf der Seite, nur auf dunklem Grund */}
          {stationen.length > 1 && (
            <div
              className="flex gap-2 overflow-x-auto px-4 py-3 flex-shrink-0 justify-start md:justify-center"
              style={{ scrollbarWidth: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {stationen.map((st, idx) => (
                <button
                  key={st.url + idx}
                  onClick={() => setAktiv(idx)}
                  aria-label={st.art === 'video' ? 'Video' : `Fotoğraf ${idx + 1}`}
                  className={`relative w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors cursor-pointer ${
                    idx === i ? 'border-primary' : 'border-white/25 hover:border-white/60'
                  }`}
                >
                  {st.art === 'video' ? (
                    <span className="w-full h-full bg-gray-900 flex items-center justify-center">
                      <i className="ti ti-player-play-filled" style={{ color: '#fff', fontSize: 16 }} />
                    </span>
                  ) : (
                    <img src={st.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

      <OnayModal
        offen={loeschFrage}
        titel="İlanı sil"
        text="Bu ilan kalıcı olarak silinecek. Fotoğrafları ve videosu da kaldırılacak. Emin misiniz?"
        bestaetigen="Evet, sil"
        gefaehrlich
        icon="trash"
        laeuft={isDeleting}
        onBestaetigen={handleDelete}
        onAbbrechen={() => setLoeschFrage(false)}
      />

      {/* Benzer İlanlar — Auswahl kommt vom Server, siehe components/BenzerIlanlar.tsx */}
      {onSelectListing && onSelectCategory && listing.id && (
        <BenzerIlanlar
          ilanId={listing.id}
          onSelect={onSelectListing}
          onToggleFavorite={onToggleFavorite}
          onSelectCategory={onSelectCategory}
        />
      )}

      {/* Teklif modal (overnight6 Phase 3c) */}
      {teklifModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setTeklifModal(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 'min(400px, 90vw)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {teklifGonderildi ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#15803d' }}>
                <i className="ti ti-circle-check" style={{ fontSize: '3rem' }} />
                <p style={{ margin: '12px 0 0', fontWeight: 600 }}>Teklifiniz iletildi!</p>
              </div>
            ) : (
              <>
                <h3 style={{ margin: '0 0 20px', color: '#1a2e4a', fontSize: '1.2rem', fontWeight: 700 }}>Teklif Yap</h3>

                {teklifGecmisi.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>
                      Önceki tekliflerin
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 132, overflowY: 'auto' }}>
                      {teklifGecmisi.map((t: any) => {
                        const [renk, arka] = TEKLIF_DURUM_RENK[t.status] || TEKLIF_DURUM_RENK.bekliyor
                        return (
                          <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                            <span style={{ fontWeight: 700, color: '#1a2e4a', fontSize: '0.9rem' }}>
                              ₺{Number(t.teklif_fiyat).toLocaleString('tr-TR')}
                            </span>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs"
                              style={{ background: arka, color: renk, fontWeight: 700 }}>
                              {TEKLIF_DURUM_ETIKET[t.status] || 'Cevap Bekliyor'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Teklif Tutarı (TL)</label>
                <input
                  type="number" value={teklifFiyat} onChange={(e) => setTeklifFiyat(e.target.value)}
                  placeholder={listing.price ? `İlan fiyatı: ${Number(listing.price).toLocaleString('tr-TR')} TL` : 'Tutar girin'}
                  style={{ width: '100%', padding: 11, border: '1px solid #ddd', borderRadius: 8, marginBottom: 14, fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Mesaj (isteğe bağlı)</label>
                <textarea
                  value={teklifMesaj} onChange={(e) => setTeklifMesaj(e.target.value)} rows={3}
                  placeholder="Kısa bir not ekleyebilirsiniz..."
                  style={{ width: '100%', padding: 11, border: '1px solid #ddd', borderRadius: 8, marginBottom: 18, fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleTeklifGonder} disabled={!teklifFiyat || parseFloat(teklifFiyat) <= 0}
                    style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: teklifFiyat && parseFloat(teklifFiyat) > 0 ? '#e53935' : '#ccc', color: '#fff', fontWeight: 700, cursor: teklifFiyat ? 'pointer' : 'not-allowed', fontSize: '0.95rem' }}
                  >Gönder</button>
                  <button
                    onClick={() => setTeklifModal(false)}
                    style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer', fontSize: '0.95rem' }}
                  >İptal</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[80] p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {reportSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">Şikayetiniz Alındı</h3>
                <p className="text-sm text-gray-500 mb-4">Ekibimiz en kısa sürede inceleyecektir.</p>
                <button
                  onClick={() => { setShowReport(false); setReportSent(false); setReportType(''); setReportDesc('') }}
                  className="bg-primary text-white px-5 py-2 rounded-xl text-sm"
                >
                  Kapat
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-gray-900 mb-4">İlan Şikayet Et</h3>
                <div className="space-y-2 mb-4">
                  {REPORT_TYPES.map((rt) => (
                    <label key={rt.v} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="report"
                        value={rt.v}
                        checked={reportType === rt.v}
                        onChange={() => setReportType(rt.v)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-gray-700">{rt.l}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  placeholder="Ek açıklama (isteğe bağlı)..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReport(false)}
                    className="flex-1 bg-gray-100 text-gray-800 py-2.5 rounded-xl font-semibold text-sm"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportType}
                    className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    Şikayet Gönder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
