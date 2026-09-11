// Discover.tsx — KapBeni v15
// Zwei-Spalten-Layout: linke Sidebar (Subkategorien + Filter) | rechte Produktliste
// Süper İlanlar: hellrote quadratische Karten (bezahlter Feature)
// Sort: En Yeni / Fiyat Artan / Fiyat Azalan  (kein Akıllı Sıralama)
// Filter: Elden Teslim-Toggle, Kargo ile Yolla-Toggle, Süper İlanlar, Videolu İlanlar
// Arama Kaydet: für eingeloggte User

import { useState, useMemo, useEffect, useCallback } from 'react'
import { LayoutGrid, List, X, ChevronDown, Bookmark, BookmarkCheck, SlidersHorizontal, Navigation, Star } from 'lucide-react'
import { Listing, ve } from '../api'
import ProductCard from '../components/ProductCard'
import { useKategoriAgac, mitAnzahl, type Category } from '../data/kategoriAgac'
import { CITY_LIST } from '../data/cities'
import { useAuth } from '../context/AuthContext'

interface Props {
  listings: Listing[]
  selectedCategory: string | null
  onSelectCategory: (cat: string | null) => void
  onSelectProduct: (listing: Listing) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  searchTerm: string
}

// Hilfsfunktion: Findet die Hauptkategorie für eine gegebene Kategorie-ID (main oder sub)
function findMainCategory(catId: string | null, kats: Category[]) {
  if (!catId) return null
  const direct = kats.find(c => c.id === catId)
  if (direct) return direct
  return kats.find(c => c.sub.some(s => s.id === catId)) ?? null
}

// Süper İlan Karte — quadratisch, hellrot
function SuperIlanCard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff5f5',
        border: '2px solid #ffcdd2',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        aspectRatio: '1 / 1',
        position: 'relative',
        transition: 'box-shadow .15s, border-color .15s',
        boxShadow: '0 2px 10px rgba(229,57,53,0.10)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = '#e53935'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(229,57,53,0.22)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = '#ffcdd2'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(229,57,53,0.10)'
      }}
    >
      {/* Badge */}
      <div style={{
        position: 'absolute', top: 7, left: 7, zIndex: 2,
        background: '#e53935', color: '#fff',
        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
        padding: '2px 7px', borderRadius: 20,
        textTransform: 'uppercase',
        boxShadow: '0 1px 6px rgba(229,57,53,.35)',
      }}>
        ⭐ Süper İlan
      </div>
      {/* Foto */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#fce4e4', minHeight: 0 }}>
        {item.ana_foto
          ? <img src={item.ana_foto} alt={item.baslik} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-photo" style={{ fontSize: '2.5rem', color: '#ffab9f' }} />
            </div>
        }
      </div>
      {/* Info */}
      <div style={{ padding: '8px 10px', background: '#fff5f5' }}>
        <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '0.82rem', color: '#1a2e4a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.baslik}
        </p>
        <p style={{ margin: 0, color: '#e53935', fontWeight: 800, fontSize: '0.88rem' }}>
          {item.fiyat ? `${Number(item.fiyat).toLocaleString('tr-TR')} TL` : 'Fiyat sorulur'}
        </p>
        {item.sehir && (
          <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 2 }}>
            <i className="ti ti-map-pin" style={{ fontSize: '0.65rem' }} />{item.sehir}
          </p>
        )}
      </div>
    </div>
  )
}

// Toggle-Schalter Komponente
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '5px 0' }}>
      <span style={{ fontSize: 12.5, color: '#374151', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? '#e53935' : '#d1d5db',
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          transition: 'left .2s',
        }} />
      </div>
    </label>
  )
}

export default function Discover({
  listings,
  selectedCategory,
  onSelectCategory,
  onSelectProduct,
  onToggleFavorite,
  searchTerm,
}: Props) {
  const { isLoggedIn } = useAuth()
  const { kategoriler } = useKategoriAgac()

  // ── Filter-State ──────────────────────────────────────────────
  const [isGridView, setIsGridView] = useState(true)
  const [city, setCity] = useState('Tüm Şehirler')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('latest')
  const [eldenTeslim, setEldenTeslim] = useState(false)
  const [kargoIleYolla, setKargoIleYolla] = useState(false)
  const [nurSuperIlanlar, setNurSuperIlanlar] = useState(false)
  const [nurVideolu, setNurVideolu] = useState(false)
  const [mobilSidebarOpen, setMobilSidebarOpen] = useState(false)
  const [minPuan, setMinPuan] = useState<number | null>(null)
  const [ilce, setIlce] = useState('')
  const [kelimeFiltrele, setKelimeFiltrele] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)

  // ── Boosted/Süper İlanlar ─────────────────────────────────────
  const [superIlanlar, setSuperIlanlar] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/ilanlar/boosted', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setSuperIlanlar(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // ── "Konumumu Kullan" — Live-Logik: Nominatim Reverse Geocoding ──
  const konumuKullan = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=tr`,
            { headers: { 'User-Agent': 'KapBeni/1.0 (kapbeni.com)' } }
          )
          const data = await res.json()
          const il = data.address?.province || data.address?.city_district || data.address?.city || data.address?.state || ''
          const ilceGeo = data.address?.county || data.address?.suburb || data.address?.village || ''
          if (il) {
            const match = CITY_LIST.find(
              (ct) => ct.toLowerCase().includes(il.toLowerCase()) || il.toLowerCase().includes(ct.toLowerCase())
            )
            if (match) setCity(match)
          }
          if (ilceGeo) setIlce(ilceGeo)
        } catch { /* silent */ }
        setGeoLoading(false)
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    )
  }

  // ── Arama Kaydet ──────────────────────────────────────────────
  const [aramaSaved, setAramaSaved] = useState(false)
  const [aramaSaving, setAramaSaving] = useState(false)

  const saveSearch = useCallback(async () => {
    if (!isLoggedIn || aramaSaving) return
    setAramaSaving(true)
    try {
      await ve.post('/kayitli-aramalar', {
        arama_terimi: searchTerm || null,
        kategori_id: selectedCategory || null,
        fiyat_min: minPrice ? Number(minPrice) : null,
        fiyat_max: maxPrice ? Number(maxPrice) : null,
      })
      setAramaSaved(true)
      setTimeout(() => setAramaSaved(false), 3000)
    } catch { /* silent */ }
    finally { setAramaSaving(false) }
  }, [isLoggedIn, aramaSaving, searchTerm, selectedCategory, minPrice, maxPrice])

  // ── Kategorie-Logik ───────────────────────────────────────────
  const mainCat = findMainCategory(selectedCategory, kategoriler)
  const isSubSelected = selectedCategory && mainCat && mainCat.id !== selectedCategory

  // Gruppen der Subkategorien aufbauen
  const groupedSubs = useMemo(() => {
    if (!mainCat) return {}
    const grp: Record<string, typeof mainCat.sub> = {}
    mainCat.sub.forEach(s => {
      const g = s.group || mainCat.label
      if (!grp[g]) grp[g] = []
      grp[g].push(s)
    })
    return grp
  }, [mainCat])

  // ── Filtern ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = [...listings]

    // Textsuche
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      arr = arr.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      )
    }

    // Kelime Filtre (Live: Titel oder Verkäufername)
    if (kelimeFiltrele.trim()) {
      const kw = kelimeFiltrele.toLowerCase()
      arr = arr.filter(l =>
        l.title.toLowerCase().includes(kw) ||
        l.sellerName.toLowerCase().includes(kw)
      )
    }

    // Kategorie
    if (selectedCategory) {
      // Verglichen wird der DB-Slug (l.categorySlug), nicht der Anzeigename.
      // Vorher stand hier l.category — das ist "Araba", waehrend selectedCategory
      // "araba" ist; dadurch fand der Filter nie etwas.
      const mc = kategoriler.find(c => c.id === selectedCategory)
      const slugVon = (l: typeof arr[number]) => l.categorySlug || ''
      if (mc) {
        const subIds = new Set(mc.sub.map(s => s.id))
        arr = arr.filter(l => subIds.has(slugVon(l)) || slugVon(l) === selectedCategory)
      } else {
        arr = arr.filter(l => slugVon(l) === selectedCategory)
      }
    }

    // Stadt
    if (city !== 'Tüm Şehirler') arr = arr.filter(l => l.location.includes(city))
    if (ilce.trim()) arr = arr.filter(l => l.location.toLowerCase().includes(ilce.toLowerCase()))

    // Preis
    if (minPrice) arr = arr.filter(l => l.price >= parseFloat(minPrice))
    if (maxPrice) arr = arr.filter(l => l.price <= parseFloat(maxPrice))

    // Sortierung
    if (sort === 'priceAsc') arr.sort((a, b) => a.price - b.price)
    else if (sort === 'priceDesc') arr.sort((a, b) => b.price - a.price)
    else arr.sort((a, b) => b.id.localeCompare(a.id))

    return arr
  }, [listings, searchTerm, selectedCategory, city, ilce, minPrice, maxPrice, sort, kelimeFiltrele])

  // Süper İlanlar nach Kategorie filtern
  const filteredSuper = useMemo(() => {
    if (!mainCat) return superIlanlar.slice(0, 8)
    return superIlanlar.slice(0, 8)
  }, [superIlanlar, mainCat])

  const resetAll = () => {
    onSelectCategory(null)
    setCity('Tüm Şehirler')
    setMinPrice('')
    setMaxPrice('')
    setSort('latest')
    setEldenTeslim(false)
    setKargoIleYolla(false)
    setNurSuperIlanlar(false)
    setNurVideolu(false)
    setMinPuan(null)
    setIlce('')
    setKelimeFiltrele('')
  }

  const hasFilters = !!(selectedCategory || city !== 'Tüm Şehirler' || minPrice || maxPrice || sort !== 'latest' || searchTerm || eldenTeslim || kargoIleYolla || ilce || minPuan !== null || kelimeFiltrele)

  // ── Linke Sidebar Inhalt ──────────────────────────────────────
  const SidebarContent = () => (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Kategorie-Header */}
      {mainCat ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <i className={`ti ${mainCat.icon}`} style={{ fontSize: 18, color: '#e53935' }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#1a2e4a' }}>{mainCat.label}</span>
          </div>
          <button
            onClick={() => onSelectCategory(null)}
            style={{
              fontSize: 11, color: '#9ca3af', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: 10 }} />
            Tüm Kategoriler
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Tüm Kategoriler</span>
        </div>
      )}

      {/* Subkategorien der gewählten Hauptkategorie */}
      {mainCat && Object.keys(groupedSubs).length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          {/* "Tümü" Option */}
          <button
            onClick={() => onSelectCategory(mainCat.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 7, border: 'none',
              background: selectedCategory === mainCat.id ? '#fff5f5' : 'transparent',
              color: selectedCategory === mainCat.id ? '#e53935' : '#374151',
              fontSize: 12.5, fontWeight: selectedCategory === mainCat.id ? 700 : 500,
              cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
              marginBottom: 4,
            }}
          >
            <i className="ti ti-layout-grid" style={{ fontSize: 13, color: selectedCategory === mainCat.id ? '#e53935' : '#9ca3af' }} />
            Tüm {mainCat.label}
          </button>

          {/* Gruppen */}
          {Object.entries(groupedSubs).map(([groupName, subs]) => (
            <div key={groupName} style={{ marginBottom: 10 }}>
              {/* Gruppenüberschrift: bold, italic, +1 Schriftgröße */}
              <div style={{
                fontSize: 12, fontWeight: 800, fontStyle: 'italic',
                color: '#6b7280', paddingBottom: 4, marginBottom: 4, marginTop: 6,
                borderBottom: '1px solid #e8e8e8',
                letterSpacing: '0.01em',
              }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {subs.map(sub => {
                  const isActive = selectedCategory === sub.id
                  return (
                    <button
                      key={sub.id}
                      onClick={() => onSelectCategory(sub.id)}
                      style={{
                        width: '100%', padding: '4px 8px', borderRadius: 6,
                        border: 'none',
                        background: isActive ? '#fff5f5' : 'transparent',
                        color: isActive ? '#e53935' : '#4b5563',
                        fontSize: 12, fontWeight: isActive ? 700 : 400,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all .1s',
                        borderLeft: isActive ? '2px solid #e53935' : '2px solid transparent',
                        paddingLeft: isActive ? 10 : 8,
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          ;(e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'
                          ;(e.currentTarget as HTMLButtonElement).style.color = '#1a2e4a'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          ;(e.currentTarget as HTMLButtonElement).style.color = '#4b5563'
                        }
                      }}
                    >
                      {mitAnzahl(sub.label, sub.adet)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : !mainCat ? (
        /* Wenn keine Kategorie gewählt: kompakte Kategorieliste anzeigen */
        <div style={{ marginBottom: 18 }}>
          {kategoriler.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 7, border: 'none',
                background: 'transparent', color: '#374151',
                fontSize: 12.5, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left', transition: 'all .12s',
                marginBottom: 1,
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <i className={`ti ${cat.icon}`} style={{ fontSize: 13, color: '#9ca3af' }} />
              {mitAnzahl(cat.label, cat.adet)}
            </button>
          ))}
        </div>
      ) : null}

      {/* Trennlinie */}
      <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: 14 }} />

      {/* ── Konum (Live 1:1) ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Konum
          </span>
          <button
            onClick={konumuKullan}
            disabled={geoLoading}
            title="Mevcut konumu kullan"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '3px 8px', cursor: 'pointer', color: '#2563eb',
              fontSize: 11, fontWeight: 600,
            }}
          >
            <Navigation size={11} />
            {geoLoading ? 'Alınıyor...' : 'Konumumu Kullan'}
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            style={{
              width: '100%', background: '#fff', border: '1.5px solid #e5e7eb',
              borderRadius: 9, padding: '6px 28px 6px 10px',
              fontSize: 12, color: '#374151', appearance: 'none',
              fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="Tüm Şehirler">İl seçin</option>
            {CITY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} size={13} />
        </div>
        <input
          type="text"
          placeholder="İlçe seçin veya yazın"
          value={ilce}
          onChange={e => setIlce(e.target.value)}
          style={{
            width: '100%', background: '#fff', border: '1.5px solid #e5e7eb',
            borderRadius: 9, padding: '6px 10px', fontSize: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Trennlinie */}
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

      {/* ── Filter-Sektion ── */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filtreler
        </span>
      </div>

      {/* Elden Teslim */}
      <Toggle checked={eldenTeslim} onChange={setEldenTeslim} label="Elden Teslim" />

      {/* Kargo ile Yolla */}
      <Toggle checked={kargoIleYolla} onChange={setKargoIleYolla} label="Kargo ile Yolla" />

      <div style={{ height: 8 }} />

      {/* Süper İlanlar */}
      <Toggle
        checked={nurSuperIlanlar}
        onChange={setNurSuperIlanlar}
        label="⭐ Süper İlanlar"
      />

      {/* Videolu İlanlar */}
      <Toggle
        checked={nurVideolu}
        onChange={setNurVideolu}
        label="🎥 Videolu İlanlar"
      />

      {/* Trennlinie */}
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

      {/* ── Satıcı Puanı (Live 1:1 — Radios) ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Satıcı Puanı
        </div>
        {[
          { label: 'Tümü', value: null },
          { label: '3.0 ve Üstü', value: 3 },
          { label: '3.5 ve Üstü', value: 3.5 },
          { label: '4.0 ve Üstü', value: 4 },
          { label: '4.5 ve Üstü', value: 4.5 },
        ].map(opt => (
          <label key={String(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
            <input
              type="radio"
              name="satici_puani"
              checked={minPuan === opt.value}
              onChange={() => setMinPuan(opt.value)}
              style={{ accentColor: '#e53935', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12.5, color: '#374151', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 4 }}>
              {opt.value !== null && <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />}
              {opt.label}
            </span>
          </label>
        ))}
      </div>

      {/* Trennlinie */}
      <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

      {/* ── Kelime ile Filtrele (Live 1:1) ── */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 5 }}>
          Kelime ile Filtrele
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Kelime ile filtrele"
            value={kelimeFiltrele}
            onChange={e => setKelimeFiltrele(e.target.value)}
            style={{
              width: '100%', background: '#fff', border: '1.5px solid #e5e7eb',
              borderRadius: 9, padding: '6px 32px 6px 10px', fontSize: 12,
              fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>🔍</span>
        </div>
      </div>

      {/* Fiyat Aralığı */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 5 }}>Fiyat Aralığı (TL)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            style={{
              width: '50%', background: '#fff', border: '1.5px solid #e5e7eb',
              borderRadius: 9, padding: '6px 8px', fontSize: 12,
              fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none',
            }}
          />
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            style={{
              width: '50%', background: '#fff', border: '1.5px solid #e5e7eb',
              borderRadius: 9, padding: '6px 8px', fontSize: 12,
              fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Filter zurücksetzen */}
      {hasFilters && (
        <button
          onClick={resetAll}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 9,
            border: '1.5px solid #fca5a5', background: '#fff5f5',
            color: '#e53935', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all .12s',
            marginBottom: 8,
          }}
        >
          <X size={12} /> Filtreleri Sıfırla
        </button>
      )}

      {/* Arama Kaydet */}
      {isLoggedIn && (
        <button
          onClick={saveSearch}
          disabled={aramaSaving}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 9,
            border: '1.5px solid #1a2e4a', background: aramaSaved ? '#e8f5e9' : '#1a2e4a',
            color: aramaSaved ? '#2e7d32' : '#fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all .12s',
          }}
        >
          {aramaSaved
            ? <><BookmarkCheck size={13} /> Arama Kaydedildi!</>
            : <><Bookmark size={13} /> Aramayı Kaydet</>
          }
        </button>
      )}
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────
  return (
    <section style={{ paddingTop: 16, paddingBottom: 32 }}>
      {/* ── Mobil: Filter-Button ── */}
      <div className="md:hidden" style={{ marginBottom: 12 }}>
        <button
          onClick={() => setMobilSidebarOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#fff', border: '1.5px solid #e5e7eb',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 600, color: '#374151',
            cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <SlidersHorizontal size={15} style={{ color: '#e53935' }} />
          {mainCat ? mainCat.label : 'Tüm Kategoriler'}
          {hasFilters && <span style={{ background: '#e53935', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>!</span>}
        </button>
      </div>

      {/* ── Mobil Sidebar Drawer ── */}
      {mobilSidebarOpen && (
        <>
          <div
            onClick={() => setMobilSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 290,
            background: '#f8f9fa', zIndex: 301, overflowY: 'auto',
            padding: '20px 16px',
            boxShadow: '4px 0 24px rgba(0,0,0,.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#1a2e4a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Filtreler</span>
              <button onClick={() => setMobilSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>
            <SidebarContent />
          </div>
        </>
      )}

      {/* ── Desktop: Zwei-Spalten-Layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ─── Linke Sidebar — Desktop ─── */}
        <div
          className="hidden md:block"
          style={{
            width: 230, minWidth: 200, flexShrink: 0,
            background: '#f4f5f7',
            borderRadius: 14, padding: '18px 14px',
            position: 'sticky', top: 148,
            maxHeight: 'calc(100vh - 170px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            border: '1px solid #eaebec',
          }}
        >
          <SidebarContent />
        </div>

        {/* ─── Rechte Seite: Ergebnisse ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Header: Breadcrumb + Sort + Grid/List Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <span
                  onClick={() => onSelectCategory(null)}
                  style={{ fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}
                >
                  Tümü
                </span>
                {mainCat && (
                  <>
                    <i className="ti ti-chevron-right" style={{ fontSize: 10, color: '#d1d5db' }} />
                    <span
                      onClick={() => onSelectCategory(mainCat.id)}
                      style={{
                        fontSize: 12, color: isSubSelected ? '#9ca3af' : '#e53935',
                        fontWeight: isSubSelected ? 500 : 700, cursor: 'pointer',
                      }}
                    >
                      {mainCat.label}
                    </span>
                  </>
                )}
                {isSubSelected && (() => {
                  const sub = mainCat?.sub.find(s => s.id === selectedCategory)
                  return sub ? (
                    <>
                      <i className="ti ti-chevron-right" style={{ fontSize: 10, color: '#d1d5db' }} />
                      <span style={{ fontSize: 12, color: '#e53935', fontWeight: 700 }}>{mitAnzahl(sub.label, sub.adet)}</span>
                    </>
                  ) : null
                })()}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', fontFamily: "'Plus Jakarta Sans', sans-serif", marginTop: 2 }}>
                {filtered.length} ilan
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Sıralama */}
              <div style={{ position: 'relative' }}>
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  style={{
                    background: '#fff', border: '1.5px solid #e5e7eb',
                    borderRadius: 9, padding: '6px 28px 6px 10px',
                    fontSize: 12, fontWeight: 600, color: '#374151',
                    appearance: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="latest">En Yeni İlanlar</option>
                  <option value="priceAsc">Fiyat: Artan</option>
                  <option value="priceDesc">Fiyat: Azalan</option>
                </select>
                <ChevronDown style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} size={12} />
              </div>

              {/* Grid / List Toggle */}
              <div style={{ display: 'flex', gap: 2, background: '#fff', padding: 3, borderRadius: 9, border: '1.5px solid #e5e7eb' }}>
                <button
                  onClick={() => setIsGridView(true)}
                  style={{
                    padding: '5px 7px', borderRadius: 7, border: 'none',
                    background: isGridView ? '#e53935' : 'transparent',
                    color: isGridView ? '#fff' : '#9ca3af',
                    cursor: 'pointer', transition: 'all .12s',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setIsGridView(false)}
                  style={{
                    padding: '5px 7px', borderRadius: 7, border: 'none',
                    background: !isGridView ? '#e53935' : 'transparent',
                    color: !isGridView ? '#fff' : '#9ca3af',
                    cursor: 'pointer', transition: 'all .12s',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Aktive Filter-Tags ── */}
          {hasFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {searchTerm && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff5f5', color: '#e53935', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #fca5a5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  🔍 &quot;{searchTerm}&quot;
                  <X size={10} style={{ cursor: 'pointer' }} onClick={resetAll} />
                </span>
              )}
              {isSubSelected && (() => {
                const sub = mainCat?.sub.find(s => s.id === selectedCategory)
                return sub ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff5f5', color: '#e53935', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #fca5a5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {mitAnzahl(sub.label, sub.adet)}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => mainCat && onSelectCategory(mainCat.id)} />
                  </span>
                ) : null
              })()}
              {city !== 'Tüm Şehirler' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0f4ff', color: '#3b5bdb', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #bfcbff', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  📍 {city}
                  <X size={10} style={{ cursor: 'pointer' }} onClick={() => setCity('Tüm Şehirler')} />
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fff4', color: '#15803d', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #86efac', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  💰 {minPrice || '0'}₺ – {maxPrice || '∞'}₺
                  <X size={10} style={{ cursor: 'pointer' }} onClick={() => { setMinPrice(''); setMaxPrice('') }} />
                </span>
              )}
              {eldenTeslim && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fefce8', color: '#a16207', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #fde68a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  🤝 Elden Teslim
                  <X size={10} style={{ cursor: 'pointer' }} onClick={() => setEldenTeslim(false)} />
                </span>
              )}
              {kargoIleYolla && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fefce8', color: '#a16207', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #fde68a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  📦 Kargo ile Yolla
                  <X size={10} style={{ cursor: 'pointer' }} onClick={() => setKargoIleYolla(false)} />
                </span>
              )}
            </div>
          )}

          {/* ── Süper İlanlar Sektion ── */}
          {filteredSuper.length > 0 && !nurVideolu && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 14, fontWeight: 800, color: '#e53935',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  ⭐ Süper İlanlar
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  · Öne çıkan ilanlar
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 10,
              }}>
                {filteredSuper.map(item => (
                  <SuperIlanCard
                    key={item.id || item.uuid}
                    item={item}
                    onClick={() => onSelectProduct({
                      id: String(item.uuid || item.id),
                      title: item.baslik,
                      price: Number(item.fiyat) || 0,
                      category: '',
                      location: item.sehir || '',
                      date: 'Yeni',
                      image: item.ana_foto || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
                      description: '',
                      sellerName: item.satici_ad || '',
                      sellerPhone: '',
                      isFavorite: false,
                      condition: 'İkinci El',
                    })}
                  />
                ))}
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 20, marginBottom: 4 }} />
            </div>
          )}

          {/* ── Normal İlanlar ── */}
          {filtered.length > 0 ? (
            <div className={isGridView ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3' : 'flex flex-col gap-3'}>
              {filtered.map(listing => (
                <ProductCard
                  key={listing.id}
                  listing={listing}
                  isGridView={isGridView}
                  onSelect={() => onSelectProduct(listing)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div style={{
              background: '#fff', borderRadius: 20, padding: '48px 24px',
              textAlign: 'center', border: '1px solid #f3f4f6',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
              <div style={{
                width: 64, height: 64, background: '#f3f4f6',
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <i className="ti ti-search-off" style={{ fontSize: '2rem', color: '#e53935' }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a2e4a', marginBottom: 8 }}>
                Aradığınız İlan Bulunamadı
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', maxWidth: 320, margin: '0 auto 20px' }}>
                Filtrelerinizi genişletmeyi veya farklı bir kategori seçmeyi deneyin.
              </p>
              <button
                onClick={resetAll}
                style={{
                  background: '#e53935', color: '#fff', border: 'none',
                  borderRadius: 30, padding: '10px 24px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Tüm İlanları Göster
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
