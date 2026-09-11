import { useState, useMemo, useCallback, useEffect } from 'react'
import { Bookmark, Heart, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

// Konstanten aus dem Live-Bundle
const ITEMS_PER_PAGE = 6
const AUTOPLAY_DELAY = 2500
const AUTOPLAY_INTERVAL = 5000
const BOOSTED_EVERY = 4

const CONDITION_MAP: Record<string, string> = {
  sifir: 'Sıfır',
  az_kullanilmis: 'Az Kull.',
  ikinci_el: 'İkinci El',
}

const FONT_STYLE: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

const BOKEH_CIRCLES = [
  { size: 70, top: '10%', left: '4%', delay: '0.3s', dur: '8s', op: 0.25 },
  { size: 45, top: '60%', left: '10%', delay: '2s', dur: '6.5s', op: 0.18 },
  { size: 90, top: '20%', left: '78%', delay: '1s', dur: '9s', op: 0.2 },
  { size: 35, top: '72%', left: '55%', delay: '2.8s', dur: '7s', op: 0.3 },
  { size: 55, top: '40%', left: '90%', delay: '1.5s', dur: '10s', op: 0.14 },
  { size: 40, top: '85%', left: '28%', delay: '3.5s', dur: '7.5s', op: 0.22 },
  { size: 25, top: '12%', left: '42%', delay: '0.7s', dur: '8.5s', op: 0.33 },
  { size: 60, top: '55%', left: '68%', delay: '2.2s', dur: '9.5s', op: 0.12 },
]

function formatPrice(price: number): string {
  return new Intl.NumberFormat('tr-TR').format(price) + ' ₺'
}

function mapBoostedItem(raw: any) {
  return {
    id: raw.uuid || String(raw.id || Math.random()),
    title: raw.baslik || '',
    price: Number(raw.fiyat) || 0,
    category: raw.kategori_ad || '', categorySlug: raw.kategori_slug || '',
    location: [raw.ilce, raw.sehir].filter(Boolean).join(', '),
    date: 'Öne Çıkan',
    image: raw.ana_foto || raw.foto_url || '',
    description: raw.aciklama || '',
    sellerName: [raw.ad, raw.soyad].filter(Boolean).join(' ') || 'Satıcı',
    sellerPhone: raw.phone || '',
    isFavorite: false,
    condition: CONDITION_MAP[raw.durum] || 'İkinci El',
    _isBoosted: true,
  }
}

function mergeListings(allListings: any[], boostedMapped: any[]): any[] {
  const active = allListings.filter((l) => !l.isSold)
  const result: any[] = []
  let ni = 0, si = 0, slot = 0
  while (ni < active.length || si < boostedMapped.length) {
    if (si < boostedMapped.length && slot % BOOSTED_EVERY === 0) {
      result.push(boostedMapped[si++])
    } else if (ni < active.length) {
      result.push(active[ni++])
    } else if (si < boostedMapped.length) {
      result.push(boostedMapped[si++])
    }
    slot++
  }
  return result
}

interface Props {
  listings: any[]
  rawBoosted: any[]
  onSelect: (listing: any) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}

export default function OnceCikanIlanSection({ listings, rawBoosted, onSelect, onToggleFavorite }: Props) {
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)

  const boostedMapped = useMemo(() => rawBoosted.map(mapBoostedItem), [rawBoosted])
  const merged = useMemo(() => mergeListings(listings, boostedMapped), [listings, boostedMapped])
  const pageCount = Math.max(1, Math.ceil(merged.length / ITEMS_PER_PAGE))

  const goToPage = useCallback((getter: (prev: number) => number) => {
    setVisible(false)
    setTimeout(() => {
      setPage(getter)
      setVisible(true)
    }, 600)
  }, [])

  const nextPage = useCallback(() => goToPage((p) => (p + 1) % pageCount), [goToPage, pageCount])
  const prevPage = useCallback(() => goToPage((p) => (p - 1 + pageCount) % pageCount), [goToPage, pageCount])

  useEffect(() => { setPage(0) }, [listings, rawBoosted])

  useEffect(() => {
    const t = setTimeout(() => setReady(true), AUTOPLAY_DELAY)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!ready || paused || pageCount <= 1) return
    const t = setInterval(nextPage, AUTOPLAY_INTERVAL)
    return () => clearInterval(t)
  }, [ready, nextPage, paused, pageCount])

  if (merged.length === 0) return null

  const pageItems = merged.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, #2dd4bf 0%, #5eead4 30%, #99f6e4 65%, #ccfbf1 85%, #f0fdfb 100%)',
        padding: '18px 18px 14px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 6px 24px rgba(13,148,136,0.25)',
        marginTop: 12,
      }}
    >
      {/* Bokeh-Kreise */}
      {BOKEH_CIRCLES.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: c.size,
            height: c.size,
            borderRadius: '50%',
            background: `rgba(255,255,255,${c.op})`,
            top: c.top,
            left: c.left,
            filter: 'blur(4px)',
            animation: `kapbeni-kucuk-bokeh ${c.dur} ${c.delay} ease-in-out infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(15,79,71,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bookmark size={16} color="#0f4f47" strokeWidth={2.2} />
        </span>
        <h3 style={{ margin: 0, color: '#0f4f47', fontWeight: 800, fontSize: '0.95rem', ...FONT_STYLE }}>Öne Çıkan İlan</h3>
        <span style={{ marginLeft: 'auto', color: 'rgba(15,79,71,0.55)', fontSize: 10, fontWeight: 600, ...FONT_STYLE }}>Taze ilanlar</span>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease', position: 'relative' }}
      >
        {pageItems.map((item) => {
          const img = item.image || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=300&q=70'
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              style={{
                background: 'rgba(255,255,255,0.97)',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                transition: 'transform 0.18s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
            >
              {/* Bookmark-Badge */}
              <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 5, background: 'rgba(13,148,136,0.85)', borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center' }}>
                <Bookmark size={8} color="#fff" strokeWidth={2.5} />
              </div>
              {/* Favoriten-Button */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id, e) }}
                style={{ position: 'absolute', top: 4, right: 4, zIndex: 5, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <Heart size={10} className={item.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
              </button>
              {/* Bild */}
              <div style={{ height: 70, background: '#e5e7eb', overflow: 'hidden' }}>
                <img src={img} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              {/* Info */}
              <div style={{ padding: '5px 6px 6px' }}>
                {item.condition && (
                  <span style={{ display: 'inline-block', fontSize: 7, fontWeight: 700, background: '#f0fdfb', color: '#0f766e', borderRadius: 3, padding: '1px 4px', marginBottom: 2, ...FONT_STYLE }}>
                    {item.condition}
                  </span>
                )}
                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...FONT_STYLE }}>
                  {item.title}
                </p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#0f766e', ...FONT_STYLE }}>
                  {formatPrice(item.price)}
                </p>
                {item.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    <MapPin size={7} color="#9ca3af" />
                    <span style={{ fontSize: 8, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...FONT_STYLE }}>
                      {item.location}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3" style={FONT_STYLE}>
          <button
            onClick={prevPage}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(15,79,71,0.10)', border: '1px solid rgba(15,79,71,0.22)', color: '#0f4f47', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,79,71,0.22)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,79,71,0.10)' }}
          >
            <ChevronLeft size={11} />
          </button>
          <div className="flex gap-1 items-center">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => goToPage(() => i)}
                style={{ width: i === page ? 16 : 5, height: 5, borderRadius: 99, background: i === page ? '#0f766e' : 'rgba(15,79,71,0.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s ease' }}
              />
            ))}
          </div>
          <button
            onClick={nextPage}
            style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(15,79,71,0.10)', border: '1px solid rgba(15,79,71,0.22)', color: '#0f4f47', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,79,71,0.22)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,79,71,0.10)' }}
          >
            <ChevronRight size={11} />
          </button>
        </div>
      )}

      {/* Progress-Bar */}
      {ready && !paused && pageCount > 1 && (
        <div
          key={`pb-${page}`}
          style={{ height: 2, background: 'rgba(15,79,71,0.35)', borderRadius: 2, marginTop: 8, animation: `kapbeni-kucuk-progress ${AUTOPLAY_INTERVAL}ms linear forwards` }}
        />
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
