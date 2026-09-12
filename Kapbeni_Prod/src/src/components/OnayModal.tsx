// ════════════════════════════════════════════════════════════════════════════
//  Bestätigungsdialog im Seitendesign.
//
//  Ersetzt das native window.confirm(): das zeigt auf jedem Gerät eine andere
//  Leiste, schreibt "kapbeni.com says…" darüber und hat mit dem Rest der
//  Oberfläche nichts gemein. Auf iOS lässt es sich zudem unterdrücken.
//
//  Optik ist keine neue Erfindung, sondern dieselbe wie beim Şikayet-Dialog in
//  pages/Details.tsx: dunkler Überzug, weiße Karte mit rounded-2xl, zwei
//  gleich breite Knöpfe (grau abbrechen, farbig bestätigen) in rounded-xl.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react'

interface Props {
  offen: boolean
  titel: string
  text: string
  /** Beschriftung der bestätigenden Aktion. */
  bestaetigen: string
  abbrechen?: string
  /** true = rote Schaltfläche für zerstörende Aktionen. */
  gefaehrlich?: boolean
  /** Tabler-Icon-Klasse ohne "ti-"-Präfix, z. B. "trash". */
  icon?: string
  laeuft?: boolean
  onBestaetigen: () => void
  onAbbrechen: () => void
}

export default function OnayModal({
  offen, titel, text, bestaetigen, abbrechen = 'Vazgeç',
  gefaehrlich = false, icon, laeuft = false, onBestaetigen, onAbbrechen,
}: Props) {
  const bestaetigenRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!offen) return
    // Escape schließt — dasselbe Verhalten, das der native Dialog hatte.
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onAbbrechen() }
    document.addEventListener('keydown', taste)
    // Fokus auf die bestätigende Aktion, damit der Dialog auch mit der
    // Tastatur bedienbar bleibt.
    bestaetigenRef.current?.focus()
    return () => document.removeEventListener('keydown', taste)
  }, [offen, onAbbrechen])

  if (!offen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[90] p-4"
      onClick={onAbbrechen}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              gefaehrlich ? 'bg-red-50' : 'bg-primary/8'
            }`}>
              <i className={`ti ti-${icon}`} style={{ fontSize: 20, color: gefaehrlich ? '#dc2626' : 'var(--color-primary)' }} />
            </div>
          )}
          <div>
            <h3 className="font-bold text-gray-900 text-base mb-1">{titel}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAbbrechen}
            disabled={laeuft}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {abbrechen}
          </button>
          <button
            ref={bestaetigenRef}
            type="button"
            onClick={onBestaetigen}
            disabled={laeuft}
            className={`flex-1 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50 ${
              gefaehrlich ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/95'
            }`}
          >
            {laeuft ? 'Siliniyor…' : bestaetigen}
          </button>
        </div>
      </div>
    </div>
  )
}
