// OneCikanSliders.tsx — Rekonstruiert aus dem Live-Bundle (index-B_ZskGvg.js, Build 2026-07-21)
// Zwei Startseiten-Slider:
//   1. BoostedSuperSlider  — "Öne Çıkan Süper İlan" (blauer Gradient, ProductCards + Badges)
//   2. OneCikanMiniSlider  — "Öne Çıkan İlan" (türkiser Gradient, Mini-Karten)
// Datenquelle: /api/ilanlar/boosted, gesplittet nach boost_type in App.tsx

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Sparkles, Bookmark, ChevronLeft, ChevronRight, Heart, MapPin } from 'lucide-react'
import ProductCard from './ProductCard'

const FONT = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

// ─── Slider 1: Öne Çıkan Süper İlan (blau) ───────────────────────────────────

const SUPER_PAGE_SIZE = 4
const SUPER_INTERVAL = 5000
const SUPER_INTERLEAVE = 4
const CONDITION_MAP: Record<string, string> = {
  sifir: 'Sıfır Ayarında',
  az_kullanilmis: 'Az Kullanılmış',
  ikinci_el: 'İkinci El',
}

function mapBoostedSuper(e: any) {
  return {
    id: e.uuid || String(e.id || Math.random()),
    title: e.baslik || '',
    price: Number(e.fiyat) || 0,
    category: e.kategori_ad || '', categorySlug: e.kategori_slug || '',
    location: [e.ilce, e.sehir].filter(Boolean).join(', '),
    date: 'Öne Çıkan',
    image: e.ana_foto || e.foto_url || '',
    description: e.aciklama || '',
    sellerName: [e.ad, e.soyad].filter(Boolean).join(' ') || 'Satıcı',
    sellerPhone: e.phone || '',
    isFavorite: false,
    condition: CONDITION_MAP[e.durum] || 'İkinci El',
    _isBoosted: true,
    _isSuper: e.boost_type === 'buyuk_ilan' || e.boost_type === 'super',
  }
}

function interleaveSuper(listings: any[], boosted: any[]) {
  const clean = listings.filter((o: any) => !o.isSold)
  const out: any[] = []
  let li = 0, bi = 0, pos = 0
  while (li < clean.length || bi < boosted.length) {
    if (bi < boosted.length && pos % SUPER_INTERLEAVE === 0) out.push(boosted[bi++])
    else if (li < clean.length) out.push(clean[li++])
    else if (bi < boosted.length) out.push(boosted[bi++])
    pos++
  }
  return out
}

const SUPER_BOKEH = [
  { size: 90, top: '8%', left: '3%', delay: '0s', dur: '7s', op: 0.22 },
  { size: 55, top: '65%', left: '12%', delay: '1.8s', dur: '9s', op: 0.16 },
  { size: 110, top: '15%', left: '72%', delay: '0.6s', dur: '8s', op: 0.18 },
  { size: 40, top: '75%', left: '52%', delay: '2.4s', dur: '6s', op: 0.28 },
  { size: 70, top: '42%', left: '88%', delay: '1.2s', dur: '10s', op: 0.13 },
  { size: 50, top: '82%', left: '32%', delay: '3.2s', dur: '7.5s', op: 0.2 },
  { size: 30, top: '18%', left: '48%', delay: '0.4s', dur: '8.5s', op: 0.32 },
  { size: 80, top: '52%', left: '62%', delay: '2.8s', dur: '9.5s', op: 0.11 },
  { size: 45, top: '30%', left: '22%', delay: '1.5s', dur: '6.5s', op: 0.19 },
  { size: 65, top: '88%', left: '78%', delay: '4s', dur: '8s', op: 0.15 },
]

interface SuperProps {
  listings: any[]
  rawBoosted: any[]
  isGridView: boolean
  onSelect: (listing: any) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}

export function BoostedSuperSlider({ listings, rawBoosted, isGridView, onSelect, onToggleFavorite }: SuperProps) {
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)

  const boosted = useMemo(() => rawBoosted.map(mapBoostedSuper), [rawBoosted])
  const merged = useMemo(() => interleaveSuper(listings, boosted), [listings, boosted])
  const pages = Math.max(1, Math.ceil(merged.length / SUPER_PAGE_SIZE))

  const goTo = useCallback((updater: any) => {
    setVisible(false)
    setTimeout(() => { setPage(updater); setVisible(true) }, 600)
  }, [])
  const next = useCallback(() => goTo((x: number) => (x + 1) % pages), [goTo, pages])
  const prev = useCallback(() => goTo((x: number) => (x - 1 + pages) % pages), [goTo, pages])

  useEffect(() => { setPage(0) }, [listings, rawBoosted])
  useEffect(() => {
    if (paused || pages <= 1) return
    const iv = setInterval(next, SUPER_INTERVAL)
    return () => clearInterval(iv)
  }, [next, paused, pages])

  if (merged.length === 0) {
    return (
      <div style={{ borderRadius: 24, background: 'linear-gradient(135deg, #93c4e8 0%, #bdd8f0 50%, #e8f4fd 100%)', padding: '32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(100,160,210,0.25)' }}>
        <p style={{ color: '#4a7098', fontSize: 14, ...FONT }}>Aradığınız kriterlerde eşleşen ilan bulunamadı.</p>
      </div>
    )
  }

  const Badge = ({ item, big }: { item: any; big?: boolean }) => (
    <div style={{
      position: 'absolute', top: 8, left: 8, zIndex: 5,
      background: item._isSuper ? 'linear-gradient(90deg,#f59e0b,#d97706)' : (big ? 'linear-gradient(90deg,#1e40af,#2563eb)' : 'linear-gradient(90deg,#2563eb,#1d4ed8)'),
      color: '#fff', borderRadius: 7, padding: big ? '3px 9px' : '2px 8px', fontSize: 9, fontWeight: 800,
      letterSpacing: '0.06em', boxShadow: '0 2px 8px rgba(0,0,0,0.20)', fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {item._isSuper ? '⭐ SÜPER İLAN' : '⭐ ÖNE ÇIKAN'}
    </div>
  )

  if (!isGridView) {
    return (
      <div className="flex flex-col gap-3.5">
        {merged.map((item: any) => (
          <div key={item.id} style={{ position: 'relative' }}>
            <Badge item={item} />
            <ProductCard listing={item} isGridView={false} onSelect={() => onSelect(item)} onToggleFavorite={onToggleFavorite} />
          </div>
        ))}
      </div>
    )
  }

  const current = merged.slice(page * SUPER_PAGE_SIZE, (page + 1) * SUPER_PAGE_SIZE)

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        borderRadius: 24,
        background: 'linear-gradient(135deg, #7ab8e8 0%, #a8d4f5 35%, #cce5f9 65%, #e8f4fd 85%, #f5fbff 100%)',
        padding: '24px 24px 20px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(100,160,210,0.30)',
      }}
    >
      {SUPER_BOKEH.map((c, idx) => (
        <div key={idx} style={{
          position: 'absolute', width: c.size, height: c.size, borderRadius: '50%',
          background: `rgba(255,255,255,${c.op})`, top: c.top, left: c.left, filter: 'blur(5px)',
          animation: `kapbeni-super-bokeh ${c.dur} ${c.delay} ease-in-out infinite`, pointerEvents: 'none',
        }} />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(30,58,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} color="#1e3a5f" strokeWidth={2} />
          </span>
          <div>
            <h2 style={{ margin: 0, color: '#1e3a5f', fontWeight: 900, fontSize: '1.1rem', ...FONT }}>Öne Çıkan Süper İlan</h2>
            <p style={{ margin: 0, color: '#4a7098', fontSize: 11, ...FONT }}>Seçkin ve taze ilanlar — hemen göz at</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" style={{ minHeight: 220, opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease', position: 'relative' }}>
        {current.map((item: any) => (
          <div key={item.id} style={{ position: 'relative' }}>
            <Badge item={item} big />
            <ProductCard listing={item} isGridView={true} onSelect={() => onSelect(item)} onToggleFavorite={onToggleFavorite} />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4" style={FONT}>
          <button
            onClick={prev} aria-label="Önceki"
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(30,58,138,0.10)', border: '1.5px solid rgba(30,58,138,0.22)', color: '#1e3a5f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(30,58,138,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(30,58,138,0.10)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex gap-1.5 items-center">
            {Array.from({ length: pages }).map((_, idx) => (
              <button
                key={idx} onClick={() => goTo(() => idx)} aria-label={`Sayfa ${idx + 1}`}
                style={{ width: idx === page ? 20 : 6, height: 6, borderRadius: 99, background: idx === page ? '#1e3a8a' : 'rgba(30,58,138,0.28)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.35s ease' }}
              />
            ))}
          </div>
          <button
            onClick={next} aria-label="Sonraki"
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(30,58,138,0.10)', border: '1.5px solid rgba(30,58,138,0.22)', color: '#1e3a5f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(30,58,138,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(30,58,138,0.10)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {!paused && pages > 1 && (
        <div key={`pb-${page}`} style={{ height: 2, background: 'rgba(30,58,138,0.40)', borderRadius: 2, marginTop: 10, animation: `kapbeni-listing-progress ${SUPER_INTERVAL}ms linear forwards` }} />
      )}

      <style>{`
        @keyframes kapbeni-listing-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes kapbeni-super-bokeh {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.10); opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}

// ─── Slider 2: Öne Çıkan İlan (türkis, Mini-Karten) ──────────────────────────

const MINI_PAGE_SIZE = 6
const MINI_INTERVAL = 5000
const MINI_START_DELAY = 2500
const MINI_INTERLEAVE = 4
const CONDITION_MAP_SHORT: Record<string, string> = {
  sifir: 'Sıfır',
  az_kullanilmis: 'Az Kull.',
  ikinci_el: 'İkinci El',
}

function formatTL(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n) + ' ₺'
}

function mapBoostedMini(e: any) {
  return {
    id: e.uuid || String(e.id || Math.random()),
    title: e.baslik || '',
    price: Number(e.fiyat) || 0,
    category: e.kategori_ad || '', categorySlug: e.kategori_slug || '',
    location: [e.ilce, e.sehir].filter(Boolean).join(', '),
    date: 'Öne Çıkan',
    image: e.ana_foto || e.foto_url || '',
    description: e.aciklama || '',
    sellerName: [e.ad, e.soyad].filter(Boolean).join(' ') || 'Satıcı',
    sellerPhone: e.phone || '',
    isFavorite: false,
    condition: CONDITION_MAP_SHORT[e.durum] || 'İkinci El',
    _isBoosted: true,
  }
}

function interleaveMini(listings: any[], boosted: any[]) {
  const clean = listings.filter((o: any) => !o.isSold)
  const out: any[] = []
  let li = 0, bi = 0, pos = 0
  while (li < clean.length || bi < boosted.length) {
    if (bi < boosted.length && pos % MINI_INTERLEAVE === 0) out.push(boosted[bi++])
    else if (li < clean.length) out.push(clean[li++])
    else if (bi < boosted.length) out.push(boosted[bi++])
    pos++
  }
  return out
}

const MINI_BOKEH = [
  { size: 70, top: '10%', left: '4%', delay: '0.3s', dur: '8s', op: 0.25 },
  { size: 45, top: '60%', left: '10%', delay: '2s', dur: '6.5s', op: 0.18 },
  { size: 90, top: '20%', left: '78%', delay: '1s', dur: '9s', op: 0.2 },
  { size: 35, top: '72%', left: '55%', delay: '2.8s', dur: '7s', op: 0.3 },
  { size: 55, top: '40%', left: '90%', delay: '1.5s', dur: '10s', op: 0.14 },
  { size: 40, top: '85%', left: '28%', delay: '3.5s', dur: '7.5s', op: 0.22 },
  { size: 25, top: '12%', left: '42%', delay: '0.7s', dur: '8.5s', op: 0.33 },
  { size: 60, top: '55%', left: '68%', delay: '2.2s', dur: '9.5s', op: 0.12 },
]

interface MiniProps {
  listings: any[]
  rawBoosted: any[]
  onSelect: (listing: any) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}

export function OneCikanMiniSlider({ listings, rawBoosted, onSelect, onToggleFavorite }: MiniProps) {
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const [started, setStarted] = useState(false)

  const boosted = useMemo(() => rawBoosted.map(mapBoostedMini), [rawBoosted])
  const merged = useMemo(() => interleaveMini(listings, boosted), [listings, boosted])
  const pages = Math.max(1, Math.ceil(merged.length / MINI_PAGE_SIZE))

  const goTo = useCallback((updater: any) => {
    setVisible(false)
    setTimeout(() => { setPage(updater); setVisible(true) }, 600)
  }, [])
  const next = useCallback(() => goTo((x: number) => (x + 1) % pages), [goTo, pages])
  const prev = useCallback(() => goTo((x: number) => (x - 1 + pages) % pages), [goTo, pages])

  useEffect(() => { setPage(0) }, [listings, rawBoosted])
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), MINI_START_DELAY)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!started || paused || pages <= 1) return
    const iv = setInterval(next, MINI_INTERVAL)
    return () => clearInterval(iv)
  }, [started, next, paused, pages])

  if (merged.length === 0) return null

  const current = merged.slice(page * MINI_PAGE_SIZE, (page + 1) * MINI_PAGE_SIZE)

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, #2dd4bf 0%, #5eead4 30%, #99f6e4 65%, #ccfbf1 85%, #f0fdfb 100%)',
        padding: '18px 18px 14px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 6px 24px rgba(13,148,136,0.25)', marginTop: 12,
      }}
    >
      {MINI_BOKEH.map((c, idx) => (
        <div key={idx} style={{
          position: 'absolute', width: c.size, height: c.size, borderRadius: '50%',
          background: `rgba(255,255,255,${c.op})`, top: c.top, left: c.left, filter: 'blur(4px)',
          animation: `kapbeni-kucuk-bokeh ${c.dur} ${c.delay} ease-in-out infinite`, pointerEvents: 'none',
        }} />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(15,79,71,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bookmark size={16} color="#0f4f47" strokeWidth={2.2} />
        </span>
        <h3 style={{ margin: 0, color: '#0f4f47', fontWeight: 800, fontSize: '0.95rem', ...FONT }}>Öne Çıkan İlan</h3>
        <span style={{ marginLeft: 'auto', color: 'rgba(15,79,71,0.55)', fontSize: 10, fontWeight: 600, ...FONT }}>Taze ilanlar</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease', position: 'relative' }}>
        {current.map((item: any) => {
          const img = item.image || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=300&q=70'
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.15)', transition: 'transform 0.18s ease', position: 'relative' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 5, background: 'rgba(13,148,136,0.85)', borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center' }}>
                <Bookmark size={8} color="#fff" strokeWidth={2.5} />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, e) }}
                style={{ position: 'absolute', top: 4, right: 4, zIndex: 5, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <Heart size={10} className={item.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
              </button>
              <div style={{ height: 70, background: '#e5e7eb', overflow: 'hidden' }}>
                <img src={img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '5px 6px 6px' }}>
                {item.condition && (
                  <span style={{ display: 'inline-block', fontSize: 7, fontWeight: 700, background: '#f0fdfb', color: '#0f766e', borderRadius: 3, padding: '1px 4px', marginBottom: 2, ...FONT }}>
                    {item.condition}
                  </span>
                )}
                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...FONT }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#0f766e', ...FONT }}>{formatTL(item.price)}</p>
                {item.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    <MapPin size={7} color="#9ca3af" />
                    <span style={{ fontSize: 8, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...FONT }}>{item.location}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3" style={FONT}>
          <button
            onClick={prev}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(15,79,71,0.10)', border: '1px solid rgba(15,79,71,0.22)', color: '#0f4f47', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15,79,71,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(15,79,71,0.10)' }}
          >
            <ChevronLeft size={11} />
          </button>
          <div className="flex gap-1 items-center">
            {Array.from({ length: pages }).map((_, idx) => (
              <button
                key={idx} onClick={() => goTo(() => idx)}
                style={{ width: idx === page ? 16 : 5, height: 5, borderRadius: 99, background: idx === page ? '#0f766e' : 'rgba(15,79,71,0.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s ease' }}
              />
            ))}
          </div>
          <button
            onClick={next}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(15,79,71,0.10)', border: '1px solid rgba(15,79,71,0.22)', color: '#0f4f47', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(15,79,71,0.22)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(15,79,71,0.10)' }}
          >
            <ChevronRight size={11} />
          </button>
        </div>
      )}

      {started && !paused && pages > 1 && (
        <div key={`pb-${page}`} style={{ height: 2, background: 'rgba(15,79,71,0.35)', borderRadius: 2, marginTop: 8, animation: `kapbeni-kucuk-progress ${MINI_INTERVAL}ms linear forwards` }} />
      )}

      <style>{`
        @keyframes kapbeni-kucuk-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes kapbeni-kucuk-bokeh {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.12); opacity: 0.50; }
        }
      `}</style>
    </div>
  )
}
