import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Headphones,
  ChevronRight,
  Heart,
  ChevronUp,
  CheckCircle,
  Grid3X3,
  List,
  Send,
  Check,
  Lightbulb,
} from 'lucide-react'
import { ve, ilanZuListing, ilanlarApi as ilanlarApiEdit } from './api'

import Navbar from './components/Navbar'
import CategoryNav from './components/CategoryNav'
import BottomNav from './components/BottomNav'
import HeroSlider from './components/HeroSlider'
import TrendKategoriler from './components/TrendKategoriler'
import FeatureKacheln from './components/FeatureKacheln'
import { BoostedSuperSlider, OneCikanMiniSlider } from './components/OneCikanSliders'
import Footer from './components/Footer'
import ProductCard from './components/ProductCard'
import Reviews from './components/Reviews'
import Chatbot from './components/Chatbot'

import Discover from './pages/Discover'
import Messages from './pages/Messages'
import Details from './pages/Details'
import SellerProfile from './pages/SellerProfile'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

import SellModal from './components/SellModal'
import type { IlanVorgabe, IlanAenderung } from './components/SellModal'
import AuthModal from './components/AuthModal'
import DestekMerkezi from './components/DestekMerkezi'
import KYCModal from './modals/KYCModal'
import GSMModal from './modals/GSMModal'
import EditProfileModal from './modals/EditProfileModal'
import PackagesModal from './modals/PackagesModal'

import KullarimKosullari from './pages/legal/KullarimKosullari'
import GizlilikPolitikasi from './pages/legal/GizlilikPolitikasi'
import MesafeliSatis from './pages/legal/MesafeliSatis'
import CerezPolitikasi from './pages/legal/CerezPolitikasi'
import Hakkimizda from './pages/legal/Hakkimizda'
import NasilCalisir from './pages/legal/NasilCalisir'
import GuvenliAlisveris from './pages/legal/GuvenliAlisveris'
import IadePolitikasi from './pages/legal/IadePolitikasi'

import { useAuth } from './context/AuthContext'
import { ilanlarApi, favorilerApi } from './api'
import { useKategoriAgac, dbIdVonSlug, invalidateKategoriAgac } from './data/kategoriAgac'
import { navZuHash, hashZuNav, navSchluessel, LEGAL_HASHES, type NavState } from './navigation'
import type { Listing } from './api'
import { MOCK_LISTINGS, MOCK_CHATS } from './data/mockData'
import type { AppChat } from './data/mockData'

function DestekSection({ onOpen }: { onOpen?: (tab: 'taleplerim' | 'oneriler') => void }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Güvenli Alışveriş Kachel (2 Spalten) */}
      <div
        className="md:col-span-2 rounded-3xl text-white flex flex-col justify-between relative overflow-hidden group shadow-md"
        style={{
          backgroundImage: 'url(/guvenli-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: 280,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/35 to-transparent rounded-3xl" />
        <div className="relative z-10 p-8 space-y-4 max-w-md">
          <span className="inline-block bg-white/20 backdrop-blur-md text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded">
            GÜVENLİ ALTYAPI
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight drop-shadow-md">
            Güvenli Alışverişin Adresi
          </h2>
          <p className="text-xs md:text-sm text-white/90 leading-relaxed font-medium drop-shadow">
            Ürünü teslim aldıktan sonra kontrol edin, her şey yolundaysa satıcıya ödeme yapın. KapBeni güvencesiyle alışveriş yapın.
          </p>
          <a
            href="#/nasil-calisir"
            className="inline-block bg-white hover:bg-gray-100 text-primary px-6 py-2.5 rounded-full font-bold text-xs md:text-sm shadow-md transition-all active:scale-95"
          >
            Nasıl Çalışır?
          </a>
        </div>
      </div>

      {/* Destek-Foto-Kachel (Live 1:1) — öffnet das Destek-Merkezi */}
      <div
        className="rounded-3xl relative overflow-hidden cursor-pointer group shadow-sm"
        style={{
          backgroundImage: 'url(/kacheln/destek.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: 260,
        }}
        onClick={() => onOpen?.('taleplerim')}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20 transition-opacity group-hover:from-black/70" />
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full">Aç →</span>
        </div>
        <div className="absolute bottom-5 left-4 right-4 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen?.('taleplerim') }}
            className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-extrabold py-2.5 px-3 rounded-full transition-all shadow-lg backdrop-blur-sm"
          >
            Destek
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen?.('oneriler') }}
            className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-extrabold py-2.5 px-3 rounded-full transition-all shadow-lg backdrop-blur-sm"
          >
            Önerileriniz
          </button>
        </div>
      </div>
    </section>
  )
}

// Einzelnes Inserat aus der API in die Listing-Form bringen — wird gebraucht,
// wenn eine Detail-URL direkt aufgerufen oder mitten in der Navigation neu
// geladen wird und das Inserat noch nicht in der Liste steht.
// Die Abbildung selbst liegt in api/index.ts, damit "Benzer Ilanlar" dieselbe nutzt.
const einzelnesIlanZuListing = ilanZuListing

export default function App() {
  const [listings, setListings] = useState<Listing[]>(() => {
    const saved = localStorage.getItem('kapbeni_listings')
    return saved ? JSON.parse(saved) : MOCK_LISTINGS
  })
  const [chats, setChats] = useState<AppChat[]>(() => {
    const saved = localStorage.getItem('kapbeni_chats')
    return saved ? JSON.parse(saved) : MOCK_CHATS
  })
  const { kategoriler: kategorilerRef } = useKategoriAgac()
  // Anfangszustand synchron aus der URL ableiten. Wuerde das erst ein Effect
  // tun, rendert React zuerst mit tab='home' — der Push-Effect sieht diesen
  // Zwischenstand und schiebt einen erfundenen '#/'-Eintrag in die Historie.
  const initialNav = typeof window !== 'undefined' ? hashZuNav(window.location.hash) : null
  const [activeTab, setActiveTab] = useState(initialNav?.tab || 'home')
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [sellerProfileId, setSellerProfileId] = useState<string | null>(initialNav?.saticiId ?? null)
  const [dashboardTab, setDashboardTab] = useState<string | undefined>(initialNav?.panelTab ?? undefined)
  const [boostedIlanlar, setBoostedIlanlar] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/ilanlar/boosted', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBoostedIlanlar(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])
  const [searchTerm, setSearchTerm] = useState(initialNav?.q ?? '')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialNav?.kategori ?? null)
  const [showSellModal, setShowSellModal] = useState(false)
  // Bearbeiten benutzt dieselbe Maske; gesetzte Vorgabe = Bearbeiten-Modus.
  const [bearbeiteVorgabe, setBearbeiteVorgabe] = useState<IlanVorgabe | null>(null)
  // Wird nach Bearbeiten/Loeschen erhoeht; Ansichten mit eigener Liste
  // (Dashboard) laden daraufhin neu.
  const [listenSignal, setListenSignal] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [destekOpen, setDestekOpen] = useState(false)
  const [destekTab, setDestekTab] = useState<'taleplerim' | 'yeni' | 'oneriler'>('taleplerim')
  const [showKYCModal, setShowKYCModal] = useState(false)
  const [showGSMModal, setShowGSMModal] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPackages, setShowPackages] = useState(false)
  const { isLoggedIn, user } = useAuth()
  const openSell = () => (isLoggedIn ? setShowSellModal(true) : setShowAuthModal(true))
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialNav?.sohbetId ?? null)
  // Vorformulierter Chat-Text aus "Hemen Al" — wird einmalig ins Eingabefeld
  // uebernommen und dann geleert. Kein Checkout, keine Zahlung.
  const [chatVorlage, setChatVorlage] = useState<string | null>(null)
  const [isGridView, setIsGridView] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    localStorage.setItem('kapbeni_listings', JSON.stringify(listings))
  }, [listings])

  useEffect(() => {
    localStorage.setItem('kapbeni_chats', JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fetchListings = () => {
    ilanlarApi
      .getAll()
      .then((data: any) => {
        const items = (data && data.ilanlar) || []
        if (!items.length) return
        const condMap: Record<string, string> = {
          sifir: 'Sıfır Ayarında',
          az_kullanilmis: 'Az Kullanılmış',
          ikinci_el: 'İkinci El',
        }
        setListings(
          items.map((item: any, idx: number) => ({
            id: item.uuid,
            title: item.baslik,
            price: Number(item.fiyat) || 0,
            category: item.kategori_ad || '', categorySlug: item.kategori_slug || '',
            location: [item.ilce, item.sehir].filter(Boolean).join(', '),
            date: 'Yeni',
            image: item.ana_foto || item.foto_url || MOCK_LISTINGS[idx % MOCK_LISTINGS.length].image,
            description: item.aciklama || '',
            sellerName: [item.ad, item.soyad].filter(Boolean).join(' ') || 'Satıcı',
            sellerPhone: item.phone || '',
            isFavorite: false,
            condition: condMap[item.durum] || 'İkinci El',
          })),
        )
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchListings()
  }, [])

  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '')
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // ══ Browser-History ══════════════════════════════════════════════════════
  // Jede sichtbare Ansicht bekommt einen eigenen History-Eintrag, damit der
  // native Zurueck-Button durch die App laeuft statt kapbeni.com zu verlassen.
  // Modals (Sat, Giris, KYC, GSM, Paketler, Destek, Filter) bleiben bewusst
  // aussen vor — sie sind keine eigene Route.
  const legalAktiv = LEGAL_HASHES.includes(hash)
  const navAktuell: NavState = {
    tab: activeTab,
    ilanId: activeTab === 'details' ? (selectedListing?.id ?? null) : null,
    kategori: activeTab === 'discover' ? selectedCategory : null,
    saticiId: activeTab === 'satici' ? sellerProfileId : null,
    panelTab: activeTab === 'dashboard' ? (dashboardTab ?? null) : null,
    sohbetId: activeTab === 'messages' ? selectedChatId : null,
    q: activeTab === 'discover' && !selectedCategory ? (searchTerm || null) : null,
  }
  const vonPopstate = useRef(false)
  const letzterSchluessel = useRef<string | null>(null)
  // Bei einer Detail-URL kann selectedListing nicht synchron gesetzt werden.
  // Bis der Initial-Restore es nachgeholt hat, darf der Push-Effect nichts
  // schreiben — sonst landet der Zwischenstand "details ohne ilanId" als
  // zusaetzlicher Eintrag mit Startseiten-URL in der Historie.
  const initialBereitRef = useRef(!(initialNav?.tab === 'details' && !!initialNav?.ilanId))
  // Position im App-eigenen History-Stack. Nur wenn sie > 0 ist, existiert ein
  // eigener Eintrag davor — sonst wuerde history.back() die Seite verlassen
  // (z.B. wenn jemand direkt auf einer Detail-URL eingestiegen ist).
  const navIdxRef = useRef(0)
  const ladeZielRef = useRef<string | null>(null)
  const listingsRef = useRef(listings)
  listingsRef.current = listings

  // Zustand aus einem History-Eintrag (oder einer Deep-Link-URL) herstellen
  const navAnwenden = useCallback((z: NavState) => {
    setActiveTab(z.tab)
    setSelectedCategory(z.kategori ?? null)
    setSellerProfileId(z.saticiId ?? null)
    setDashboardTab(z.panelTab ?? undefined)
    setSelectedChatId(z.sohbetId ?? null)
    setSearchTerm(z.q ?? '')
    if (z.tab === 'details' && z.ilanId) {
      const vorhanden = listingsRef.current.find((l) => l.id === z.ilanId)
      if (vorhanden) setSelectedListing(vorhanden)
      else {
        // Direktaufruf oder Reload: Inserat steht noch nicht in der Liste.
        // Sofort einen Platzhalter mit der richtigen ID setzen, damit gar kein
        // Zwischenzustand "tab=details ohne ilanId" entsteht (der wuerde als
        // Startseiten-URL in die Historie wandern).
        const ziel = z.ilanId
        ladeZielRef.current = ziel
        setSelectedListing({ id: ziel, title: '', price: 0, category: '', categorySlug: '',
          location: '', date: '', image: '', description: '', sellerName: '', sellerPhone: '',
          isFavorite: false, condition: '' } as Listing)
        ve.get<any>(`/ilanlar/${ziel}`)
          .then((d) => {
            // Spaet eintreffende Antwort einer inzwischen verlassenen Ansicht verwerfen
            if (ladeZielRef.current !== ziel) return
            // Form pruefen, nicht nur Truthiness: /ilanlar/boosted etwa liefert
            // ein Array mit 200 und erzeugte sonst ein Geisterinserat unter
            // #/ilan/undefined.
            ladeZielRef.current = null
            if (d && !Array.isArray(d) && (d.uuid || d.id)) setSelectedListing(einzelnesIlanZuListing(d))
            else { setActiveTab('home'); setSelectedListing(null) }
          })
          .catch(() => {
            if (ladeZielRef.current !== ziel) return
            ladeZielRef.current = null
            setActiveTab('home'); setSelectedListing(null)
          })
      }
    } else if (z.tab !== 'details') {
      setSelectedListing(null)
    }
  }, [])

  // Eingebaute "Geri Dön"-Knoepfe sollen sich wie der Browser-Zurueck verhalten
  // und tatsaechlich eine Station zurueckgehen, statt eine neue anzulegen. Nur
  // wenn es keinen eigenen Eintrag davor gibt (Direkteinstieg per Link), greift
  // das uebergebene Ziel.
  const zurueck = useCallback((fallback: () => void) => {
    if (navIdxRef.current > 0) window.history.back()
    else fallback()
  }, [])

  // Beim ersten Rendern die URL auswerten (Deep-Link / Reload)
  useEffect(() => {
    const ziel = hashZuNav(window.location.hash)
    if (ziel) {
      letzterSchluessel.current = navSchluessel(ziel)
      // Tab/Kategorie/… stehen dank initialNav schon richtig; nachzuladen ist
      // nur das Inserat einer Detail-URL.
      if (ziel.tab === 'details' && ziel.ilanId) navAnwenden(ziel)
      window.history.replaceState({ nav: ziel, idx: 0 }, '', navZuHash(ziel))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zustandswechsel → History-Eintrag
  useEffect(() => {
    if (legalAktiv) return
    if (!initialBereitRef.current) {
      if (navAktuell.tab === 'details' && !navAktuell.ilanId) return
      initialBereitRef.current = true
    }
    const schluessel = navSchluessel(navAktuell)
    const vorher = letzterSchluessel.current
    // Das Flag MUSS vor dem Gleichheits-Guard konsumiert werden: onPop setzt
    // letzterSchluessel bereits auf das Ziel, der Effect kehrt sonst frueh
    // zurueck und laesst vonPopstate auf true stehen — die naechste echte
    // Navigation wuerde dann verschluckt.
    const warPopstate = vonPopstate.current
    vonPopstate.current = false
    if (vorher === schluessel) return
    letzterSchluessel.current = schluessel
    if (warPopstate) return

    // Reines Weitertippen in der Suche ersetzt den Eintrag, statt ihn zu stapeln —
    // sonst entstuende pro Tastendruck ein History-Schritt.
    const nurSuchtext =
      vorher !== null &&
      vorher.split('|').slice(0, 6).join('|') === schluessel.split('|').slice(0, 6).join('|')

    const url = navZuHash(navAktuell)
    if (vorher === null || nurSuchtext) {
      window.history.replaceState({ nav: navAktuell, idx: navIdxRef.current }, '', url)
    } else {
      navIdxRef.current += 1
      window.history.pushState({ nav: navAktuell, idx: navIdxRef.current }, '', url)
    }
    // pushState loest kein hashchange aus — den Hash-State selbst nachziehen,
    // sonst haelt App.tsx weiter einen veralteten Wert (Legal-Seiten-Weiche).
    setHash(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedListing, selectedCategory, sellerProfileId, dashboardTab, selectedChatId, searchTerm, legalAktiv])

  // Sicherheitsnetz: 'details' ohne Listing rendert einen leeren Inhaltsbereich
  // (App.tsx-Renderweiche verlangt beides). Kann z.B. entstehen, wenn ein
  // Nachladen fehlschlaegt. Dann zurueck auf die Startseite.
  useEffect(() => {
    // Nur greifen, wenn gerade KEIN Inserat nachgeladen wird und der
    // Anfangszustand steht — sonst wuerde ein Deep-Link auf #/ilan/<uuid>
    // abgebrochen, bevor die Antwort da ist.
    if (ladeZielRef.current || !initialBereitRef.current) return
    if (activeTab === 'details' && !selectedListing) setActiveTab('home')
  }, [activeTab, selectedListing])

  // Zurueck/Vorwaerts im Browser
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // Eintraege ohne eigenen nav-State stammen nicht von uns: die Legal-Seiten
      // navigieren per window.location.hash = '…' bzw. '' und erzeugen dabei
      // einen Eintrag mit state=null. Den Ansichtszustand dann NICHT anfassen —
      // sonst wirft jeder Ausstieg aus den AGB den Nutzer auf die Startseite,
      // statt ihn dorthin zurueckzubringen, wo er herkam.
      if (!e.state || !e.state.nav) { setHash(window.location.hash); return }
      navIdxRef.current = typeof e.state.idx === 'number' ? e.state.idx : 0
      const ziel: NavState | null = e.state.nav
      if (!ziel) return   // Legal-Seite — darum kuemmert sich der hashchange-Handler
      vonPopstate.current = true
      letzterSchluessel.current = navSchluessel(ziel)
      // Offene Overlays gehoeren zur verlassenen Ansicht — sonst bleiben sie
      // ueber der neuen stehen. Modals haben bewusst keine eigene Route.
      setShowSellModal(false); setShowAuthModal(false); setShowKYCModal(false)
      setShowGSMModal(false); setShowEditProfile(false); setShowPackages(false)
      setDestekOpen(false); setShowFilters(false)
      navAnwenden(ziel)
      setHash(window.location.hash)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [navAnwenden])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const submitListing = async (listing: Listing, files?: File[], video?: File | null) => {
    try {
      const condMap: Record<string, string> = {
        Sıfır: 'sifir',
        'Sıfır Ayarında': 'sifir',
        'İkinci El - Az Kullanılmış': 'az_kullanilmis',
        'İkinci El - Çok Temiz': 'ikinci_el',
        'İkinci El': 'ikinci_el',
      }
      const [sehir, ilce] = (listing.location || '').split(',').map((s: string) => s.trim())
      const form = new FormData()
      form.append('baslik', listing.title)
      form.append('aciklama', listing.description)
      form.append('fiyat', String(listing.price))
      form.append('durum', condMap[listing.condition] || 'ikinci_el')
      form.append('sehir', sehir || '')
      form.append('ilce', ilce || '')
      // Ohne kategori_id landet das Inserat mit NULL in der DB und taucht in
      // keinem Kategorie-Filter auf. SellModal liefert den Slug, hier wird die
      // numerische ID daraus aufgeloest.
      const katId = dbIdVonSlug(kategorilerRef, (listing as any).categorySlug || null)
      if (katId != null) form.append('kategori_id', String(katId))
      if (files && files.length > 0) {
        // Reihenfolge des Formulars = Reihenfolge der Galerie, erstes Bild = Titelbild
        files.forEach((f) => form.append('fotograflar', f))
      } else {
        form.append('foto_url', listing.image)
      }
      if (video) form.append('video', video)
      await ilanlarApi.create(form)
      setShowSellModal(false)
      showToast('İlanınız başarıyla yayınlandı!')
      fetchListings()
      invalidateKategoriAgac()   // Kategorie-Zaehler sofort aktualisieren
      setActiveTab('home')
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        setShowSellModal(false)
        setShowAuthModal(true)
      } else {
        showToast('İlan verilemedi: ' + (err.message || ''))
      }
    }
  }

  /**
   * Bearbeiten oeffnen. Die Anfangswerte kommen aus GET /api/ilanlar/:uuid und
   * NICHT aus der Liste: nur der Detailaufruf liefert kategori_slug, den
   * Zustandscode und die vollstaendige Fotoliste. Seit dem Eigentuemer-Fix
   * zaehlt dieser Aufruf die eigene Ansicht nicht mehr mit.
   */
  const oeffneBearbeiten = async (ilanId: string) => {
    if (!isLoggedIn) { setShowAuthModal(true); return }
    try {
      const d = await ilanlarApiEdit.getOne(ilanId)
      if (!d || !d.uuid) { showToast('İlan yüklenemedi.'); return }
      setBearbeiteVorgabe({
        uuid: d.uuid,
        baslik: d.baslik || '',
        aciklama: d.aciklama || '',
        fiyat: d.fiyat ?? '',
        kategoriSlug: d.kategori_slug || null,
        durum: d.durum || 'ikinci_el',
        sehir: d.sehir || '',
        ilce: d.ilce || '',
        fotograflar: (d.fotograflar || []).map((f: any) => f.url).filter(Boolean),
        videoUrl: d.video_url || null,
      })
    } catch (err: any) {
      showToast(err?.message === 'Unauthorized' ? 'Lütfen giriş yapın.' : (err?.message || 'İlan yüklenemedi.'))
    }
  }

  const speichereAenderung = async (a: IlanAenderung) => {
    try {
      const condMap: Record<string, string> = {
        Sıfır: 'sifir', 'Sıfır Ayarında': 'sifir',
        'İkinci El - Az Kullanılmış': 'az_kullanilmis',
        'İkinci El - Çok Temiz': 'ikinci_el', 'İkinci El': 'ikinci_el',
      }
      const form = new FormData()
      form.append('baslik', a.baslik)
      form.append('aciklama', a.aciklama)
      form.append('fiyat', String(a.fiyat))
      form.append('durum', condMap[a.durum] || 'ikinci_el')
      form.append('sehir', a.sehir)
      form.append('ilce', a.ilce)
      const katId = dbIdVonSlug(kategorilerRef, a.kategoriSlug || null)
      if (katId != null) form.append('kategori_id', String(katId))
      form.append('sirala', JSON.stringify(a.sirala))
      a.neueDateien.forEach((f) => form.append('fotograflar', f))
      if (a.video) form.append('video', a.video)
      if (a.videoEntfernen) form.append('video_kaldir', '1')

      await ilanlarApiEdit.update(a.uuid, form)
      setBearbeiteVorgabe(null)
      showToast('İlan güncellendi!')
      fetchListings()
      setListenSignal((n) => n + 1)
      invalidateKategoriAgac()
      // Steht die Detailansicht offen, muss sie die neuen Werte zeigen.
      if (selectedListing && selectedListing.id === a.uuid) {
        try { setSelectedListing(ilanZuListing(await ilanlarApiEdit.getOne(a.uuid))) } catch { /* Liste reicht */ }
      }
    } catch (err: any) {
      // Weiterwerfen: die Maske faengt es, zeigt den Grund im Formular und
      // gibt den Knopf wieder frei. Sie bleibt dabei offen, die Eingaben
      // bleiben erhalten.
      throw new Error(err?.message === 'Unauthorized'
        ? 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.'
        : (err?.message || 'İlan güncellenemedi.'))
    }
  }

  /** Endgueltiges Loeschen. Die Bestaetigung hat der Aufrufer schon eingeholt. */
  const loescheIlan = async (uuid: string) => {
    try {
      await ilanlarApiEdit.delete(uuid)
      setBearbeiteVorgabe(null)
      // Sofort aus der lokalen Liste nehmen: fetchListings() laeuft zwar
      // gleich, bricht aber bei leerer Antwort ab — ohne das Filtern bliebe
      // das geloeschte Inserat sichtbar und das Loeschen saehe wirkungslos aus.
      setListings((prev) => prev.filter((l) => l.id !== uuid))
      if (selectedListing && selectedListing.id === uuid) {
        setSelectedListing(null)
        setActiveTab('home')
      }
      showToast('İlan silindi.')
      fetchListings()
      setListenSignal((n) => n + 1)
      invalidateKategoriAgac()
    } catch (err: any) {
      showToast(err?.message === 'Unauthorized' ? 'Lütfen giriş yapın.' : (err?.message || 'İlan silinemedi.'))
    }
  }

  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoggedIn) {
      setShowAuthModal(true)
      return
    }
    const listing = listings.find((l) => l.id === id)
    const newFav = !(listing?.isFavorite)
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, isFavorite: newFav } : l)))
    if (selectedListing && selectedListing.id === id) {
      setSelectedListing((prev) => (prev ? { ...prev, isFavorite: newFav } : null))
    }
    try {
      newFav ? await favorilerApi.add(id) : await favorilerApi.remove(id)
    } catch {}
    showToast(newFav ? 'Favorilere eklendi!' : 'Favorilerden çıkarıldı')
  }

  const startChat = (listing: Listing) => {
    const existing = chats.find((c) => c.listingId === listing.id)
    if (existing) {
      setSelectedChatId(existing.id)
    } else {
      const chatId = `chat_${Date.now()}`
      const newChat: AppChat = {
        id: chatId,
        listingId: listing.id,
        listingTitle: listing.title,
        listingPrice: listing.price,
        listingImage: listing.image,
        sellerName: listing.sellerName,
        messages: [
          {
            id: 'init_1',
            sender: 'seller',
            text: `Merhaba! ${listing.title} ilanımla ilgilendiğiniz için teşekkürler. Nasıl yardımcı olabilirim?`,
            timestamp: 'Şimdi',
          },
        ],
        unread: false,
      }
      setChats((prev) => [newChat, ...prev])
      setSelectedChatId(chatId)
    }
    setActiveTab('messages')
  }

  const selectProduct = (listing: Listing) => {
    setSelectedListing(listing)
    setActiveTab('details')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // "Hemen Al" ist ein Kontakt-Shortcut, kein Kaufvorgang: die Route legt die
  // Konversation an oder liefert die bestehende zurueck (idempotent), danach
  // springen wir in den Chat und schlagen den Text vor.
  const HEMEN_AL_TEXT = 'Bu ürünü hemen satın almak istiyorum.'
  const hemenAl = async (listing: Listing) => {
    if (!isLoggedIn) { setShowAuthModal(true); return }
    try {
      const k = await ve.post<any>('/mesajlar/konusma', { ilan_uuid: listing.id })
      if (k && k.id != null) {
        setSelectedChatId(String(k.id))
        setChatVorlage(HEMEN_AL_TEXT)
        setActiveTab('messages')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch {
      showToast('Sohbet açılamadı. Lütfen tekrar deneyin.')
    }
  }

  const unreadCount = useMemo(() => chats.filter((c) => c.unread).length, [chats])

  const filteredListings = useMemo(() => {
    let result = [...listings]
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(lower) ||
          l.category.toLowerCase().includes(lower),
      )
    }
    if (selectedCategory) {
      result = result.filter((l) => l.category === selectedCategory)
    }
    return result
  }, [listings, searchTerm, selectedCategory])

  // Boosted nach Typ splitten (wie Live-Bundle): büyük/super → blauer Slider, Rest → türkiser Slider
  const boostedBuyuk = useMemo(
    () => boostedIlanlar.filter((z: any) => z.boost_type === 'buyuk_ilan' || z.boost_type === 'super'),
    [boostedIlanlar]
  )
  const boostedKucuk = useMemo(
    () => boostedIlanlar.filter((z: any) => z.boost_type !== 'buyuk_ilan' && z.boost_type !== 'super'),
    [boostedIlanlar]
  )

  const favoriteListings = useMemo(() => listings.filter((l) => l.isFavorite), [listings])

  const legalPages: Record<string, React.ReactNode> = {
    '#/kullanim-kosullari': <KullarimKosullari />,
    '#/gizlilik-politikasi': <GizlilikPolitikasi />,
    '#/mesafeli-satis': <MesafeliSatis />,
    '#/cerez-politikasi': <CerezPolitikasi />,
    '#/iade-politikasi': (
      <IadePolitikasi
        onBack={() => {
          window.location.hash = ''
        }}
      />
    ),
    '#/hakkimizda': <Hakkimizda />,
    '#/nasil-calisir': (
      <NasilCalisir
        onBack={() => {
          window.location.hash = ''
        }}
      />
    ),
    '#/guvenli-alisveris': (
      <GuvenliAlisveris
        onBack={() => {
          window.location.hash = ''
        }}
      />
    ),
  }

  if (legalPages[hash]) {
    const handleTabFromLegal = (tab: string) => {
      window.location.hash = ''
      setActiveTab(tab)
    }
    const handleProfileClickFromLegal = (action?: string) => {
      window.location.hash = ''
      if (action === 'login' || !isLoggedIn) {
        setShowAuthModal(true)
        return
      }
      if (action === 'kyc') { setShowKYCModal(true); return }
      if (action === 'gsm') { setShowGSMModal(true); return }
      if (action === 'profil') { setShowEditProfile(true); return }
      setActiveTab(
        ({ favoriler: 'favorites', mesajlar: 'messages' } as Record<string, string>)[action ?? ''] ||
          'profile',
      )
    }
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleTabFromLegal}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onOpenSellModal={openSell}
          unreadCount={unreadCount}
          onToggleFilters={() => handleTabFromLegal('discover')}
          showFilters={false}
          onProfileClick={handleProfileClickFromLegal}
          user={user}
        />
        <main className="flex-grow">{legalPages[hash]}</main>
        <Footer />
      </div>
    )
  }

  const handleProfileClick = (action?: string) => {
    if (action === 'login') { setShowAuthModal(true); return }
    if (!isLoggedIn) { setShowAuthModal(true); return }
    if (action === 'kyc') { setShowKYCModal(true); return }
    if (action === 'gsm') { setShowGSMModal(true); return }
    if (action === 'profil') { setShowEditProfile(true); return }
    if (action === 'ayarlar') { setActiveTab('ayarlar'); return }
    if (action === 'kampanyalar' || action === 'paketler') { setShowPackages(true); return }
    if (action === 'hesabim') { setDashboardTab(undefined); setActiveTab('dashboard'); return }
    if (action === 'admin') { setActiveTab('admin'); return }
    // overnight8-fix: Profil-Menü-Einträge aufs Sidebar-Dashboard umleiten (passender Tab vorgewählt)
    const dashMap: Record<string, string> = {
      ilanlarim: 'ilanlarim', tekliflerim: 'tekliflerim', degerlendirmeler: 'degerlendirmeler',
      aramalar: 'aramalar', favoriler: 'favorilerim',
    }
    if (dashMap[action ?? '']) { setDashboardTab(dashMap[action as string]); setActiveTab('dashboard'); return }
    setActiveTab(
      ({
        favoriler: 'favorites',
        mesajlar: 'messages',
        ilanlarim: 'profile',
        profil: 'profile',
        islemlerim: 'profile',
        tekliflerim: 'profile',
        degerlendirmeler: 'profile',
        aramalar: 'profile',
        kampanyalar: 'profile',
        ayarlar: 'profile',
        yardim: 'profile',
      } as Record<string, string>)[action ?? ''] || 'profile',
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col pb-16 md:pb-0">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenSellModal={openSell}
        unreadCount={unreadCount}
        onToggleFilters={() => {
          setActiveTab('discover')
          setShowFilters((prev) => !prev)
        }}
        showFilters={showFilters}
        onProfileClick={handleProfileClick}
        user={user}
      />

      {/* Category Navigation Bar — sticky below navbar */}
      {activeTab === 'home' || activeTab === 'discover' ? (
        <CategoryNav
          selectedCategory={selectedCategory}
          onSelectCategory={(catId) => {
            setSelectedCategory(catId)
            if (catId) setActiveTab('discover')
          }}
        />
      ) : null}

      <main className="max-w-7xl mx-auto px-4 w-full flex-grow">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 pb-12"
            >
              <HeroSlider
                onOpenSellModal={openSell}
                onExplore={() => {
                  setActiveTab('discover')
                  window.scrollTo({ top: 500, behavior: 'smooth' })
                }}
              />
              {boostedIlanlar.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    <i className="ti ti-star-filled" style={{ color: '#e53935', marginRight: 6 }} />Öne Çıkan İlanlar
                  </h2>
                  <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }} className="hide-scrollbar">
                    {boostedIlanlar.map((b: any) => (
                      <div
                        key={b.id}
                        onClick={() => selectProduct({ id: String(b.uuid || b.id), title: b.baslik, price: Number(b.fiyat) || 0, category: '', location: b.sehir || '', date: 'Yeni', image: b.ana_foto || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70', description: '', sellerName: b.satici_ad || '', sellerPhone: '', isFavorite: false, condition: 'İkinci El' })}
                        style={{ flexShrink: 0, width: b.boost_type === 'buyuk_ilan' ? 240 : 190, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '2px solid #e53935', background: '#fff', boxShadow: '0 2px 10px rgba(229,57,53,0.12)' }}
                      >
                        <div style={{ height: 130, background: '#f5f5f5', overflow: 'hidden' }}>
                          {b.ana_foto
                            ? <img src={b.ana_foto} alt={b.baslik} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-photo" style={{ fontSize: '2rem', color: '#ccc' }} /></div>}
                        </div>
                        <div style={{ padding: 10 }}>
                          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a2e4a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{b.baslik}</p>
                          <p style={{ margin: '0 0 4px', color: '#e53935', fontWeight: 700, fontSize: '0.95rem' }}>{b.fiyat ? `${Number(b.fiyat).toLocaleString('tr-TR')} TL` : 'Fiyat sorulur'}</p>
                          {b.sehir && <p style={{ margin: 0, color: '#888', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-map-pin" style={{ fontSize: '0.7rem' }} />{b.sehir}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <TrendKategoriler
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat)
                  setActiveTab('discover')
                }}
                onViewAllCategories={() => {
                  setSelectedCategory(null)
                  setActiveTab('discover')
                }}
              />
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    Öne Çıkan İlanlar
                  </h2>
                  <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-2xs">
                    <button
                      onClick={() => setIsGridView(true)}
                      className={`p-2 rounded-lg transition-all cursor-pointer ${isGridView ? 'bg-primary text-white shadow-2xs' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Kılavuz Görünümü"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setIsGridView(false)}
                      className={`p-2 rounded-lg transition-all cursor-pointer ${isGridView ? 'text-gray-400 hover:text-gray-600' : 'bg-primary text-white shadow-2xs'}`}
                      title="Liste Görünümü"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <BoostedSuperSlider
                  listings={filteredListings}
                  rawBoosted={boostedBuyuk}
                  isGridView={isGridView}
                  onSelect={selectProduct}
                  onToggleFavorite={toggleFavorite}
                />
                <OneCikanMiniSlider
                  listings={filteredListings}
                  rawBoosted={boostedKucuk}
                  onSelect={selectProduct}
                  onToggleFavorite={toggleFavorite}
                />
              </section>


              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Son İlanlar</h2>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
                  >
                    Tümünü Gör <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {listings.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {listings.slice(0, 8).map((listing) => (
                      <ProductCard
                        key={listing.id}
                        listing={listing}
                        isGridView={true}
                        onSelect={() => selectProduct(listing)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </section>

              <FeatureKacheln />

              <DestekSection
                onOpen={(tab) => {
                  if (isLoggedIn) { setDestekTab(tab); setDestekOpen(true) }
                  else setShowAuthModal(true)
                }}
              />

              <Reviews />
            </motion.div>
          )}

          {activeTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Discover
                listings={listings}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onSelectProduct={selectProduct}
                onToggleFavorite={toggleFavorite}
                searchTerm={searchTerm}
              />
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Messages
                initialChatId={selectedChatId}
                onChatChange={setSelectedChatId}
                onCloseChat={() => zurueck(() => setSelectedChatId(null))}
                initialText={chatVorlage}
                onTextUebernommen={() => setChatVorlage(null)}
              />
            </motion.div>
          )}

          {activeTab === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    Favori İlanlarım
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {favoriteListings.length} kaydedilmiş ilan
                  </p>
                </div>
                {favoriteListings.length > 0 && (
                  <button
                    onClick={() => {
                      setListings((prev) => prev.map((l) => ({ ...l, isFavorite: false })))
                      showToast('Tüm favoriler temizlendi!')
                    }}
                    className="text-primary hover:text-primary-container text-xs font-bold cursor-pointer"
                  >
                    Tümünü Temizle
                  </button>
                )}
              </div>

              {favoriteListings.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {favoriteListings.map((listing) => (
                    <ProductCard
                      key={listing.id}
                      listing={listing}
                      isGridView={true}
                      onSelect={() => selectProduct(listing)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-2xs max-w-lg mx-auto space-y-4">
                  <div className="w-16 h-16 bg-red-50 text-primary rounded-full flex items-center justify-center mx-auto">
                    <Heart className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Favori İlanınız Yok</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Gezinirken beğendiğiniz ilanların üzerindeki kalp ikonuna tıklayarak
                    favorilerinize ekleyebilirsiniz!
                  </p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="bg-primary hover:bg-primary/95 text-white font-bold text-xs py-2.5 px-6 rounded-full shadow-sm cursor-pointer"
                  >
                    İlanları Keşfet
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'details' && selectedListing && (
            <motion.div
              key="details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Details
                listing={selectedListing}
                onBack={() => zurueck(() => { setActiveTab('home'); setSelectedListing(null) })}
                onToggleFavorite={toggleFavorite}
                onStartChat={startChat}
                onHemenAl={hemenAl}
                onViewSeller={(id) => { setSellerProfileId(id); setActiveTab('satici') }}
                onSelectListing={selectProduct}
                onEdit={oeffneBearbeiten}
                onDeleted={(id) => {
                  setListings((prev) => prev.filter((l) => l.id !== id))
                  setSelectedListing(null)
                  setActiveTab('home')
                  fetchListings()
                  setListenSignal((n) => n + 1)
                }}
                onSelectCategory={(slug) => {
                  setSelectedCategory(slug)
                  setSelectedListing(null)
                  setActiveTab('discover')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </motion.div>
          )}

          {activeTab === 'satici' && sellerProfileId && (
            <motion.div key="satici" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SellerProfile
                sellerId={sellerProfileId}
                onBack={() => zurueck(() => setActiveTab(selectedListing ? 'details' : 'home'))}
                onSelectProduct={selectProduct}
              />
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Dashboard
                onSelectProduct={selectProduct}
                onOpenKyc={() => setShowKYCModal(true)}
                onOpenGsm={() => setShowGSMModal(true)}
                onNavigateMessages={() => setActiveTab('messages')}
                onNavigateSettings={() => setActiveTab('ayarlar')}
                initialTab={dashboardTab}
                onTabChange={setDashboardTab}
                onEditListing={oeffneBearbeiten}
                refreshSignal={listenSignal}
              />
            </motion.div>
          )}

          {activeTab === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AdminPanel />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Profile
                onOpenKyc={() => setShowKYCModal(true)}
                onOpenGsm={() => setShowGSMModal(true)}
                onEditProfile={() => setShowEditProfile(true)}
                onSelectProduct={selectProduct}
              />
            </motion.div>
          )}

          {activeTab === 'ayarlar' && (
            <motion.div
              key="ayarlar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pb-12"
            >
              <Settings onBack={() => zurueck(() => setActiveTab('profile'))} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSellModal={openSell}
        unreadCount={unreadCount}
      />

      {showSellModal && (
        <SellModal onClose={() => setShowSellModal(false)} onAddListing={submitListing} />
      )}

      {/* Dieselbe Maske im Bearbeiten-Modus. Eigene Instanz statt eines
          Umschalters, damit die Anfangswerte beim Oeffnen frisch gesetzt
          werden — die Maske liest sie nur einmal beim Mounten. */}
      {bearbeiteVorgabe && (
        <SellModal
          key={bearbeiteVorgabe.uuid}
          onClose={() => setBearbeiteVorgabe(null)}
          onAddListing={submitListing}
          vorgabe={bearbeiteVorgabe}
          onSave={speichereAenderung}
          onDelete={loescheIlan}
        />
      )}
      {destekOpen && (
        <DestekMerkezi
          onClose={() => setDestekOpen(false)}
          musteriNo={(user as any)?.musteri_no}
          initialTab={destekTab}
        />
      )}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <KYCModal isOpen={showKYCModal} onClose={() => setShowKYCModal(false)} />
      {showGSMModal && <GSMModal onClose={() => setShowGSMModal(false)} />}
      {showEditProfile && (
        <EditProfileModal
          onClose={() => setShowEditProfile(false)}
          onOpenKyc={() => {
            setShowEditProfile(false)
            setShowKYCModal(true)
          }}
          onOpenGsm={() => {
            setShowEditProfile(false)
            setShowGSMModal(true)
          }}
        />
      )}
      {showPackages && <PackagesModal onClose={() => setShowPackages(false)} />}

      <Chatbot />

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-12 h-12 bg-primary text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-30 cursor-pointer"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-22 md:bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 z-50 text-xs font-semibold"
          >
            <CheckCircle className="h-4.5 w-4.5 text-green-500 flex-shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
