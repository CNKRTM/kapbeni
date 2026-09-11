// ════════════════════════════════════════════════════════════════════════════
//  "Benzer İlanlar" — Empfehlungsleiste am Fuß der Produktseite.
//
//  Die Auswahl kommt vom Server (GET /api/ilanlar/:uuid/benzer), nicht aus dem
//  Zustand der App: das Frontend hält immer nur die gerade sichtbare Seite an
//  Inseraten, eine Auswahl daraus wäre je nach Einstiegspunkt verschieden und
//  nach einem Direktaufruf der Detail-URL sogar leer.
//
//  Zwei Gruppen, bewusst getrennt beschriftet: erst dieselbe Kategorie, danach
//  Auffüller aus anderen Kategorien. Ohne die Trennung sähe eine dünn besetzte
//  Kategorie so aus, als wären das alles passende Treffer.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ve, ilanZuListing } from '../api'
import type { Listing } from '../api'
import ProductCard from './ProductCard'
import { useKategoriAgac, mitAnzahl } from '../data/kategoriAgac'

interface Props {
  ilanId: string
  onSelect: (l: Listing) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  onSelectCategory: (slug: string) => void
}

interface Antwort {
  kategori: { id: number; ad: string; slug: string } | null
  ilanlar: any[]
  diger_ilanlar: any[]
}

/** Waagerechter Streifen mit Pfeilen — die Karten selbst sind die gewohnten ProductCards. */
function Streifen({ items, onSelect, onToggleFavorite }: {
  items: Listing[]
  onSelect: (l: Listing) => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [links, setLinks] = useState(false)
  const [rechts, setRechts] = useState(false)

  const pruefe = () => {
    const el = box.current
    if (!el) return
    setLinks(el.scrollLeft > 4)
    setRechts(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }
  useEffect(() => {
    pruefe()
    const el = box.current
    if (!el) return
    el.addEventListener('scroll', pruefe, { passive: true })
    window.addEventListener('resize', pruefe)
    return () => { el.removeEventListener('scroll', pruefe); window.removeEventListener('resize', pruefe) }
  }, [items.length])

  const schiebe = (richtung: number) => {
    const el = box.current
    if (!el) return
    el.scrollBy({ left: richtung * Math.max(200, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const Pfeil = ({ seite, aktiv }: { seite: 'l' | 'r'; aktiv: boolean }) => (
    <button
      onClick={() => schiebe(seite === 'l' ? -1 : 1)}
      aria-label={seite === 'l' ? 'Geri kaydır' : 'İleri kaydır'}
      className={`absolute top-1/2 -translate-y-1/2 ${seite === 'l' ? 'left-1' : 'right-1'} z-10
        w-9 h-9 rounded-full bg-white/95 border border-gray-100 shadow-sm
        flex items-center justify-center text-gray-500 hover:text-primary
        transition-opacity cursor-pointer ${aktiv ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {seite === 'l' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  )

  return (
    <div className="relative">
      <Pfeil seite="l" aktiv={links} />
      <Pfeil seite="r" aktiv={rechts} />
      <div
        ref={box}
        className="flex gap-3 overflow-x-auto scroll-smooth px-5 py-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((l) => (
          <div key={l.id} className="w-[168px] sm:w-[190px] flex-shrink-0">
            <ProductCard
              listing={l}
              isGridView={true}
              onSelect={() => onSelect(l)}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BenzerIlanlar({ ilanId, onSelect, onToggleFavorite, onSelectCategory }: Props) {
  const [daten, setDaten] = useState<Antwort | null>(null)
  const [laedt, setLaedt] = useState(true)
  const { kategoriler } = useKategoriAgac()

  useEffect(() => {
    let abgebrochen = false
    setLaedt(true)
    setDaten(null)
    ve.get<Antwort>(`/ilanlar/${encodeURIComponent(ilanId)}/benzer?limit=12`)
      .then((d) => { if (!abgebrochen) setDaten(d) })
      .catch(() => { if (!abgebrochen) setDaten(null) })
      .finally(() => { if (!abgebrochen) setLaedt(false) })
    return () => { abgebrochen = true }
  }, [ilanId])

  // Chips: Hauptkategorien mit Inseraten, ohne die gerade geöffnete.
  // Der Slug kommt aus der Antwort des Servers, nicht aus dem übergebenen
  // Inserat: bei einem Direktlink kann die App noch einen Platzhalter aus
  // data/mockData.ts halten, der kein categorySlug trägt (siehe Backlog).
  const chips = kategoriler
    .filter((k) => k.adet > 0 && k.id !== (daten?.kategori?.slug || null))
    .sort((a, b) => b.adet - a.adet)
    .slice(0, 8)

  const gleiche = (daten?.ilanlar || []).map(ilanZuListing)
  const andere = (daten?.diger_ilanlar || []).map(ilanZuListing)
  if (!laedt && !gleiche.length && !andere.length && !chips.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-8">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <i className="ti ti-layout-grid" style={{ color: '#e53935', fontSize: 18 }} />
        <span className="font-bold text-gray-900 text-sm">Benzer İlanlar</span>
        {daten?.kategori && (
          <span className="ml-auto text-xs text-gray-500 font-medium">{daten.kategori.ad}</span>
        )}
      </div>

      {laedt ? (
        <div className="flex gap-3 px-5 py-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[168px] sm:w-[190px] flex-shrink-0">
              <div className="bg-gray-100 rounded-2xl aspect-square animate-pulse" />
              <div className="h-3 bg-gray-100 rounded mt-2 animate-pulse" />
              <div className="h-3 w-2/3 bg-gray-100 rounded mt-1.5 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {gleiche.length > 0 && (
            <Streifen items={gleiche} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
          )}

          {andere.length > 0 && (
            <>
              {/* Trenner nur, wenn darueber wirklich eine Gruppe steht — sonst
                  stuende die Zwischenueberschrift direkt unter der Hauptzeile. */}
              {gleiche.length > 0 && (
                <div className="px-5 pt-1 pb-0 flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">Diğer İlanlar</span>
                  <span className="h-px flex-1 bg-gray-100" />
                </div>
              )}
              <Streifen items={andere} onSelect={onSelect} onToggleFavorite={onToggleFavorite} />
            </>
          )}

          {!gleiche.length && !andere.length && (
            <p className="px-5 py-6 text-sm text-gray-500 text-center">Şu anda gösterilecek başka ilan yok.</p>
          )}
        </>
      )}

      {chips.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 mb-2.5">Daha Fazla Kategori</p>
          <div className="flex flex-wrap gap-2">
            {chips.map((k) => (
              <button
                key={k.id}
                onClick={() => onSelectCategory(k.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200
                  text-xs font-semibold text-gray-700 bg-gray-50
                  hover:border-primary/30 hover:text-primary hover:bg-primary/5
                  transition-colors cursor-pointer"
              >
                <i className={`ti ${k.icon}`} style={{ fontSize: 14 }} />
                {mitAnzahl(k.label, k.adet)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
