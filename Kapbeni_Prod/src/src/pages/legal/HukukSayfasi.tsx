// Gemeinsame Rechtsseite für alle 15 Texte (Arbeitspaket D).
//  - Inhalt: HTML-Fragment aus ./metinler, Firmendaten aus SIRKET (hukukMetinleri.ts)
//  - Inhaltsverzeichnis: Anker-Klicks werden abgefangen und per scrollIntoView gelöst,
//    weil href="#abschnitt" sonst mit den Hash-Routen (#/kvkk) kollidiert. Die Adresse
//    wird dabei per replaceState auf #/<slug>?b=<id> gesetzt (Direktlink, kein neuer
//    History-Eintrag — Zurück verlässt die Seite weiterhin in einem Schritt).
//  - Solange nicht prod gebaut wird: Hinweis „Taslak – hukuki inceleme bekleniyor“.
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { HUKUK_METINLERI, metniYukle } from './hukukMetinleri'

const abschnittAusHash = (): string | null => {
  const q = window.location.hash.split('?')[1]
  if (!q) return null
  try { return new URLSearchParams(q).get('b') } catch { return null }
}

export default function HukukSayfasi({ slug, onBack }: { slug: string; onBack?: () => void }) {
  const [html, setHtml] = useState<string | null>(null)
  const [hata, setHata] = useState(false)
  const kutu = useRef<HTMLDivElement>(null)
  const metin = HUKUK_METINLERI.find((m) => m.slug === slug)

  useEffect(() => {
    let aktiv = true
    setHtml(null)
    setHata(false)
    metniYukle(slug)
      .then((h) => { if (aktiv) setHtml(h) })
      .catch(() => { if (aktiv) setHata(true) })
    if (!abschnittAusHash()) window.scrollTo(0, 0)
    const alterTitel = document.title
    if (metin) document.title = `${metin.baslik} | Kap Beni`
    return () => { aktiv = false; document.title = alterTitel }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Direktlink #/<slug>?b=<id>: nach dem Laden zum Abschnitt springen
  useEffect(() => {
    if (!html) return
    const b = abschnittAusHash()
    if (!b) return
    const el = kutu.current?.querySelector<HTMLElement>(`[id="${CSS.escape(b)}"]`)
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
  }, [html])

  const klick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    const href = a.getAttribute('href') || ''
    // nur Abschnittsanker (#id), keine Routen (#/…, /#/…) und keine Mail-/Weblinks
    if (!href.startsWith('#') || href.startsWith('#/')) return
    e.preventDefault()
    const id = decodeURIComponent(href.slice(1))
    const el = kutu.current?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const basis = window.location.hash.split('?')[0] || `#/${slug}`
    window.history.replaceState(window.history.state, '', `${basis}?b=${encodeURIComponent(id)}`)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-primary font-bold transition-colors cursor-pointer group mb-6"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          Geri Dön
        </button>
      )}
      {__KAPBENI_ORTAM__ !== 'prod' && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <i className="ti ti-alert-triangle text-base leading-5" />
          <span><strong>Taslak – hukuki inceleme bekleniyor.</strong> Bu metin henüz hukuki incelemeden geçmemiştir.</span>
        </div>
      )}
      <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 border border-gray-100 shadow-sm">
        {hata && (
          <div className="text-sm text-gray-600">
            Metin yüklenemedi. Lütfen sayfayı yenileyin.
          </div>
        )}
        {!hata && !html && (
          <div className="space-y-3 animate-pulse" aria-label="Yükleniyor">
            <div className="h-7 w-2/3 bg-gray-100 rounded-xl" />
            <div className="h-4 w-1/3 bg-gray-100 rounded-xl" />
            <div className="h-4 w-full bg-gray-100 rounded-xl" />
            <div className="h-4 w-5/6 bg-gray-100 rounded-xl" />
          </div>
        )}
        {html && (
          <div
            ref={kutu}
            className="hukuk-metin"
            onClick={klick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  )
}
