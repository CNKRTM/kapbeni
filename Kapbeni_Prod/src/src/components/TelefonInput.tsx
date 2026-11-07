// ════════════════════════════════════════════════════════════════════════════
//  Telefon-Eingabe mit einheitlicher Schreibweise (Auftragssammlung F).
//
//  Der Nutzer tippt frei (0532…, 532…, +90 532…). Beim Verlassen des Feldes
//  wird auf "+90 5XX XXX XX XX" gebracht und geprueft. Gespeichert wird vom
//  Aufrufer mit telefonNormalize() -> "+905XXXXXXXXX" (E.164).
// ════════════════════════════════════════════════════════════════════════════
import { useState } from 'react'
import { telefonGoster, telefonNormalize, TELEFON_HATA } from '../lib/dogrula'

interface Props {
  value: string
  onChange: (v: string) => void
  /** Meldet nach jeder Pruefung, ob die Nummer gueltig (oder leer) ist. */
  onGecerlilik?: (gecerli: boolean) => void
  className?: string
  placeholder?: string
  required?: boolean
  /** Fehler unter dem Feld selbst anzeigen (Standard: ja). */
  hataGoster?: boolean
  id?: string
}

const FEHLER_RAND = ' border-red-300 focus:border-red-400 focus:ring-red-200'

export default function TelefonInput({
  value, onChange, onGecerlilik, className = '', placeholder = '+90 5XX XXX XX XX',
  required = false, hataGoster = true, id,
}: Props) {
  const [hata, setHata] = useState('')

  const pruefe = (v: string) => {
    if (!v.trim()) { setHata(''); onGecerlilik?.(!required); return }
    const ok = !!telefonNormalize(v)
    setHata(ok ? '' : TELEFON_HATA)
    onGecerlilik?.(ok)
  }

  return (
    <>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={telefonNormalize(value) ? telefonGoster(value) : value}
        onChange={(e) => {
          // Nur Ziffern, Leerzeichen und ein fuehrendes + zulassen.
          const v = e.target.value.replace(/[^\d+ ]/g, '').slice(0, 20)
          onChange(v)
          if (hata) pruefe(v)
        }}
        onBlur={(e) => pruefe(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!hata}
        className={className + (hata ? FEHLER_RAND : '')}
      />
      {hataGoster && hata && <p className="text-red-500 text-xs mt-1">{hata}</p>}
    </>
  )
}
