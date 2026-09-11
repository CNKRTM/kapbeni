// ════════════════════════════════════════════════════════════════════════════
//  Teilen-Menü der Produktseite.
//
//  Vorher lag hinter dem Teilen-Symbol nur ein Aufruf von
//  navigator.clipboard.writeText(window.location.href) — ohne Rückfallweg und
//  ohne ein einziges Ziel. Über http (kein sicherer Kontext) ist
//  navigator.clipboard gar nicht vorhanden, der Knopf tat dort also nichts.
//
//  Optik bewusst neutral: dieselbe Zeilenform wie "Konumu Haritada Gör" in der
//  Detailansicht (Symbolquadrat in primary/8 plus Beschriftung), keine
//  Markenfarben — die wären ein neues Muster in dieser Oberfläche.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** UUID des Inserats — daraus entsteht die geteilte Adresse. */
  ilanId: string
  baslik: string
  fiyat: number
}

interface Ziel {
  schluessel: string
  etikett: string
  icon: string
  href: (adresse: string, text: string) => string
}

// Alle Ziele nehmen die Adresse als Parameter entgegen; nichts wird serverseitig
// vorbereitet, damit kein Klick die Seite verlässt, bevor der Nutzer es will.
const ZIELE: Ziel[] = [
  { schluessel: 'whatsapp', etikett: 'WhatsApp', icon: 'ti-brand-whatsapp',
    href: (a, t) => `https://wa.me/?text=${encodeURIComponent(`${t}\n${a}`)}` },
  { schluessel: 'telegram', etikett: 'Telegram', icon: 'ti-brand-telegram',
    href: (a, t) => `https://t.me/share/url?url=${encodeURIComponent(a)}&text=${encodeURIComponent(t)}` },
  { schluessel: 'x', etikett: 'X', icon: 'ti-brand-x',
    href: (a, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(a)}&text=${encodeURIComponent(t)}` },
  { schluessel: 'facebook', etikett: 'Facebook', icon: 'ti-brand-facebook',
    href: (a) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(a)}` },
  { schluessel: 'eposta', etikett: 'E-Posta', icon: 'ti-mail',
    href: (a, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${t}\n${a}`)}` },
]

/**
 * In die Zwischenablage schreiben — mit Rückfallweg.
 * navigator.clipboard gibt es nur im sicheren Kontext (https oder localhost).
 * Über http ist es schlicht nicht da, deshalb der alte execCommand-Weg.
 */
async function inZwischenablage(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fällt unten weiter */ }
  try {
    const feld = document.createElement('textarea')
    feld.value = text
    feld.setAttribute('readonly', '')
    feld.style.position = 'fixed'
    feld.style.top = '-1000px'
    document.body.appendChild(feld)
    feld.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(feld)
    return ok
  } catch { return false }
}

export default function PaylasMenu({ ilanId, baslik, fiyat }: Props) {
  const [offen, setOffen] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const [fehler, setFehler] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Die Adresse wird aufgebaut statt window.location.href zu nehmen: so wird
  // immer genau dieses Inserat geteilt, unabhängig davon, was gerade im Hash steht.
  const adresse = `${window.location.origin}/#/ilan/${encodeURIComponent(ilanId)}`
  const text = `${baslik} — ₺${Number(fiyat || 0).toLocaleString('tr-TR')} | Kap Beni`

  useEffect(() => {
    if (!offen) return
    const aussen = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOffen(false) }
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setOffen(false) }
    document.addEventListener('mousedown', aussen)
    document.addEventListener('keydown', taste)
    return () => { document.removeEventListener('mousedown', aussen); document.removeEventListener('keydown', taste) }
  }, [offen])

  const kopieren = async () => {
    const ok = await inZwischenablage(adresse)
    setKopiert(ok)
    setFehler(!ok)
    setTimeout(() => { setKopiert(false); setFehler(false) }, 2200)
    if (ok) setOffen(false)
  }

  // Die native Freigabe des Geräts gibt es nur im sicheren Kontext und
  // im Wesentlichen auf Telefonen — deshalb nur anbieten, wenn vorhanden.
  const nativVorhanden = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function'
  const nativTeilen = async () => {
    try { await (navigator as any).share({ title: baslik, text, url: adresse }); setOffen(false) } catch { /* abgebrochen */ }
  }

  const zeile = 'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer text-left'
  const quadrat = 'w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0'
  const etikett = 'text-sm font-semibold text-gray-700'

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOffen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={offen}
        className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary transition-all shadow-xs cursor-pointer"
        title="Paylaş"
      >
        {kopiert
          ? <i className="ti ti-check" style={{ fontSize: 18, color: '#15803d' }} />
          : <i className="ti ti-share" style={{ fontSize: 18 }} />}
      </button>

      {offen && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-60 bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <i className="ti ti-share" style={{ color: '#e53935', fontSize: 18 }} />
            <span className="font-bold text-gray-900 text-sm">Paylaş</span>
          </div>

          <div className="py-1">
            {nativVorhanden && (
              <button onClick={nativTeilen} className={zeile} role="menuitem">
                <span className={quadrat}><i className="ti ti-share" style={{ color: 'var(--color-primary)', fontSize: 17 }} /></span>
                <span className={etikett}>Cihazda Paylaş</span>
              </button>
            )}

            {ZIELE.map((z) => (
              <a
                key={z.schluessel}
                href={z.href(adresse, text)}
                target={z.schluessel === 'eposta' ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={() => setOffen(false)}
                className={zeile}
                role="menuitem"
              >
                <span className={quadrat}><i className={`ti ${z.icon}`} style={{ color: 'var(--color-primary)', fontSize: 17 }} /></span>
                <span className={etikett}>{z.etikett}</span>
              </a>
            ))}

            <button onClick={kopieren} className={zeile} role="menuitem">
              <span className={quadrat}><i className="ti ti-link" style={{ color: 'var(--color-primary)', fontSize: 17 }} /></span>
              <span className={etikett}>Bağlantıyı Kopyala</span>
            </button>
          </div>

          {fehler && (
            <p className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100 break-all">
              Kopyalanamadı. Bağlantı: {adresse}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
