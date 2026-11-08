// Cloudflare Turnstile (v1.20) fuer Kunden-Login und -Registrierung.
// Einstellungen kommen aus Admin → Entegrasyonlar ueber GET /api/auth/yapilandirma:
//   disabled / ohne Schluessel -> nichts anzeigen, nichts pruefen
//   test  -> offizieller Cloudflare-Testschluessel (besteht immer)
//   live  -> echter Site-Key, der Server prueft per siteverify
// Google-Login (vorbereitet) liest dieselbe Antwort.
import { useEffect, useRef, useState } from 'react'

export interface AuthYapilandirma {
  turnstile: { aktif: boolean; mod: string; siteKey: string | null }
  google: { aktif: boolean }
}

let _cfg: Promise<AuthYapilandirma> | null = null
export function authYapilandirmaLaden(): Promise<AuthYapilandirma> {
  if (!_cfg) {
    _cfg = fetch('/api/auth/yapilandirma')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d || { turnstile: { aktif: false, mod: 'disabled', siteKey: null }, google: { aktif: false } })
      .catch(() => { _cfg = null; return { turnstile: { aktif: false, mod: 'disabled', siteKey: null }, google: { aktif: false } } })
  }
  return _cfg
}
export function useAuthYapilandirma() {
  const [cfg, setCfg] = useState<AuthYapilandirma | null>(null)
  useEffect(() => { let aktiv = true; authYapilandirmaLaden().then((c) => { if (aktiv) setCfg(c) }); return () => { aktiv = false } }, [])
  return cfg
}

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void } }
}
let _skript: Promise<void> | null = null
function skriptLaden(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!_skript) {
    _skript = new Promise((ok, fehler) => {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = () => ok()
      s.onerror = () => { _skript = null; fehler(new Error('Turnstile yüklenemedi')) }
      document.head.appendChild(s)
    })
  }
  return _skript
}

interface Props {
  onToken: (token: string | null) => void
  /** Aendert sich der Wert, wird das Widget zurueckgesetzt (z. B. nach einem Fehlversuch). */
  sifirla?: number
}

export default function Turnstile({ onToken, sifirla = 0 }: Props) {
  const cfg = useAuthYapilandirma()
  const kutu = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const tokenRef = useRef(onToken)
  tokenRef.current = onToken

  useEffect(() => {
    const ts = cfg?.turnstile
    if (!ts?.aktif || !ts.siteKey || !kutu.current) return
    let aktiv = true
    skriptLaden().then(() => {
      if (!aktiv || !kutu.current || !window.turnstile) return
      widget.current = window.turnstile.render(kutu.current, {
        sitekey: ts.siteKey, language: 'tr', theme: 'light',
        callback: (t: string) => tokenRef.current(t),
        'expired-callback': () => tokenRef.current(null),
        'error-callback': () => tokenRef.current(null),
      })
    }).catch(() => { /* Ohne Skript: der Server entscheidet (test = keine Pruefung) */ })
    return () => { aktiv = false; if (widget.current && window.turnstile) { try { window.turnstile.remove(widget.current) } catch { /* schon weg */ } } widget.current = null }
  }, [cfg])

  useEffect(() => {
    if (sifirla && widget.current && window.turnstile) { window.turnstile.reset(widget.current); tokenRef.current(null) }
  }, [sifirla])

  if (!cfg?.turnstile?.aktif) return null
  return <div ref={kutu} className="flex justify-center min-h-[65px]" data-turnstile={cfg.turnstile.mod} />
}
