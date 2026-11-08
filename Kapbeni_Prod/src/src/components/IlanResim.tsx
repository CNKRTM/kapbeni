// ════════════════════════════════════════════════════════════════════════════
//  Inseratsbild mit zwei Groessen (Auftragssammlung I, v1.27).
//
//  Eigene Bilder liegen als _lg (1200 px) und _sm (480 px) vor. Die kleine
//  Variante folgt einer Namensregel (lib/medya.ts, identisch zu
//  api/src/lib/bild.js kleinUrl). Der Browser waehlt ueber srcset/sizes; fehlt
//  die kleine Datei doch einmal, faellt das Bild auf die grosse zurueck.
//  Fehlt jedes Bild oder laedt keines, steht statt eines kaputten Symbols
//  „Medya işleniyor…" (Auftragssammlung J).
// ════════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { kleinUrl } from '../lib/medya'

interface Props {
  url?: string | null
  alt?: string
  sizes: string
  className?: string
  style?: React.CSSProperties
  /** nur fuer Detail/Lightbox: immer die grosse Datei */
  gross?: boolean
}

export function MedyaIsleniyor({ className = '', style, klein = false }: { className?: string; style?: React.CSSProperties; klein?: boolean }) {
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-100 text-gray-400 ${className}`} style={style}>
      <i className={`ti ti-photo-cog ${klein ? 'text-lg' : 'text-3xl'}`} />
      {!klein && <span className="text-[11px] font-semibold">Medya işleniyor…</span>}
    </div>
  )
}

export default function IlanResim({ url, alt = '', sizes, className, style, gross = false }: Props) {
  const [stufe, setStufe] = useState(0)   // 0 = srcset, 1 = nur gross, 2 = nichts ladbar
  if (!url || stufe === 2) return <MedyaIsleniyor klein={!!style && Number(style.height) < 90} />
  const k = gross ? null : kleinUrl(url)
  const mitSet = !!k && stufe === 0
  return (
    <img
      src={mitSet ? k! : url}
      srcSet={mitSet ? `${k} 480w, ${url} 1200w` : undefined}
      sizes={mitSet ? sizes : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      style={style}
      onError={() => setStufe(mitSet ? 1 : 2)}
    />
  )
}
