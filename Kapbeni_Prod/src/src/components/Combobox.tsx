// ════════════════════════════════════════════════════════════════════════════
//  Combobox im Kapbeni-Stil: Liste klappt nach unten auf, Tippen filtert,
//  freie Eingabe bleibt erlaubt (Auftragssammlung F, M).
//
//  Verwendet fuer İl/İlçe (IlIlceAlanlari) und die Marke in der Verkaufsmaske.
//  Optik wie die bisherigen <select>-Felder: dieselbe Eingabeklasse wird vom
//  Aufrufer hereingereicht, die Liste ist eine weisse Karte mit rounded-xl.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { tuerkischFalten } from '../data/iller'

interface Props {
  value: string
  onChange: (v: string) => void
  secenekler: string[]
  placeholder?: string
  disabled?: boolean
  /** Eingabeklasse des Formulars (z. B. INPUT_CLS), damit das Feld gleich aussieht. */
  className?: string
  style?: React.CSSProperties
  /** Hoechstzahl sichtbarer Treffer — lange Listen (973 İlçe) bleiben flott. */
  limit?: number
  id?: string
  ariaLabel?: string
  /** Wird nach einer Auswahl aus der Liste aufgerufen (nicht bei freier Eingabe). */
  onSecim?: (v: string) => void
}

export default function Combobox({
  value, onChange, secenekler, placeholder, disabled, className = '', style, limit = 80, id, ariaLabel, onSecim,
}: Props) {
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(-1)
  // Beim Oeffnen per Klick die ganze Liste zeigen, erst Tippen filtert.
  const [filtern, setFiltern] = useState(false)
  const huelle = useRef<HTMLDivElement>(null)
  const liste = useRef<HTMLUListElement>(null)

  const treffer = useMemo(() => {
    const f = tuerkischFalten(value)
    if (!filtern || !f) return secenekler.slice(0, limit)
    // Erst die mit dem Anfang passenden, dann die mit Teiltreffer.
    const anfang: string[] = [], teil: string[] = []
    for (const s of secenekler) {
      const g = tuerkischFalten(s)
      if (g.startsWith(f)) anfang.push(s)
      else if (g.includes(f)) teil.push(s)
    }
    return [...anfang, ...teil].slice(0, limit)
  }, [value, secenekler, filtern, limit])

  // Klick ausserhalb schliesst.
  useEffect(() => {
    if (!offen) return
    const zu = (e: MouseEvent | TouchEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener('mousedown', zu)
    document.addEventListener('touchstart', zu)
    return () => { document.removeEventListener('mousedown', zu); document.removeEventListener('touchstart', zu) }
  }, [offen])

  // Aktiven Eintrag in Sicht halten (Pfeiltasten).
  useEffect(() => {
    if (aktiv < 0 || !liste.current) return
    const el = liste.current.children[aktiv] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [aktiv])

  const waehle = (s: string) => {
    onChange(s)
    onSecim?.(s)
    setOffen(false)
    setFiltern(false)
    setAktiv(-1)
  }

  return (
    <div ref={huelle} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={offen}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => { setOffen(true); setFiltern(false) }}
        onClick={() => setOffen(true)}
        onChange={(e) => { onChange(e.target.value); setOffen(true); setFiltern(true); setAktiv(-1) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOffen(true); setAktiv((a) => Math.min(a + 1, treffer.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAktiv((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && offen && aktiv >= 0 && treffer[aktiv]) { e.preventDefault(); waehle(treffer[aktiv]) }
          else if (e.key === 'Escape' || e.key === 'Tab') setOffen(false)
        }}
        className={className + ' pr-9'}
        style={style}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Listeyi aç"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setOffen((o) => !o); setFiltern(false) }}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${offen ? 'rotate-180' : ''}`} />
      </button>
      {offen && !disabled && treffer.length > 0 && (
        <ul
          ref={liste}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-[60] max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
        >
          {treffer.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={s === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => waehle(s)}
              onMouseEnter={() => setAktiv(i)}
              className={`px-4 py-2 text-sm cursor-pointer ${i === aktiv ? 'bg-gray-50' : ''} ${s === value ? 'text-primary font-semibold' : 'text-gray-800'}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
