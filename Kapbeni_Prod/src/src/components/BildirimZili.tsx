// Glocke mit Benachrichtigungen (v1.35). Zaehler kommt von aussen
// (lib/bildirimOzet.ts), die Liste laedt beim Oeffnen.
// Klick auf eine Meldung: als gelesen markieren, Fenster zu, zum Ziel springen
// (Navigation ueber App, nicht per location.hash — die App fuehrt ihre History selbst).
// Das Fenster liegt per Portal in <body> (fixed): im Header waere es hinter der
// sticky Kategorieleiste verschwunden (eigener Stapelkontext des Headers).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell } from 'lucide-react'
import { bildirimlerApi, type Bildirim } from '../api'

interface Props {
  sayi: number
  onDegisti: () => void
  onGit: (link: string) => void
  /** 'masaustu' = Knopf in der Navbar, 'menu' = Zeile im Handy-Menue
      (im Handy-Kopf ist kein Platz: das Suchfeld wuerde unter das Logo rutschen) */
  gorunum: 'masaustu' | 'menu'
}

const IKON: Record<string, string> = {
  mesaj: 'ti-message-circle', teklif_yeni: 'ti-tag', teklif_kabul: 'ti-circle-check', teklif_red: 'ti-circle-x',
  ilan_onay: 'ti-rosette-discount-check', ilan_red: 'ti-alert-circle', medya: 'ti-video-off',
}

export function zamanOnce(iso: string, simdi = Date.now()): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const sn = Math.max(0, Math.round((simdi - t) / 1000))
  if (sn < 60) return 'az önce'
  if (sn < 3600) return `${Math.floor(sn / 60)} dk önce`
  if (sn < 86400) return `${Math.floor(sn / 3600)} sa önce`
  if (sn < 7 * 86400) return `${Math.floor(sn / 86400)} gün önce`
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function BildirimZili({ sayi, onDegisti, onGit, gorunum }: Props) {
  const [acik, setAcik] = useState(false)
  const [liste, setListe] = useState<Bildirim[] | null>(null)
  const [hata, setHata] = useState(false)
  const kutu = useRef<HTMLDivElement | null>(null)
  const fenster = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // Lage des Fensters (Desktop: rechtsbuendig unter der Glocke)
  useEffect(() => {
    if (!acik || gorunum !== 'masaustu') { setPos(null); return }
    const setze = () => {
      const r = kutu.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) })
    }
    setze()
    window.addEventListener('resize', setze)
    window.addEventListener('scroll', setze, true)
    return () => { window.removeEventListener('resize', setze); window.removeEventListener('scroll', setze, true) }
  }, [acik, gorunum])

  const yukle = async () => {
    setHata(false)
    try { const d = await bildirimlerApi.liste(); setListe(d.bildirimler || []) }
    catch { setHata(true); setListe((l) => l ?? []) }
  }

  useEffect(() => { if (acik) yukle() }, [acik])

  // Aussenklick und Escape schliessen
  useEffect(() => {
    if (!acik) return
    const klick = (e: MouseEvent) => {
      const z = e.target as Node
      if (kutu.current?.contains(z) || fenster.current?.contains(z)) return
      setAcik(false)
    }
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setAcik(false) } }
    document.addEventListener('mousedown', klick)
    window.addEventListener('keydown', taste)
    return () => { document.removeEventListener('mousedown', klick); window.removeEventListener('keydown', taste) }
  }, [acik])

  const tikla = async (b: Bildirim) => {
    setAcik(false)
    if (!b.okundu) {
      setListe((l) => l && l.map((x) => (x.id === b.id ? { ...x, okundu: true } : x)))
      try { await bildirimlerApi.oku(b.id) } catch { /* naechster Abgleich holt es nach */ }
      onDegisti()
    }
    if (b.link) onGit(b.link)
  }

  const tumunuOku = async () => {
    setListe((l) => l && l.map((x) => ({ ...x, okundu: true })))
    try { await bildirimlerApi.tumunuOku() } catch { /* ignorieren */ }
    onDegisti()
  }

  const rozet = sayi > 0 && (
    <span data-testid="bildirim-sayi"
      className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
      {sayi > 99 ? '99+' : sayi}
    </span>
  )

  return (
    <div className="relative" ref={kutu}>
      {gorunum === 'masaustu' ? (
        <button onClick={() => setAcik((v) => !v)} aria-label="Bildirimler" aria-expanded={acik} title="Bildirimler"
          className={`relative w-9 h-9 rounded-full flex items-center justify-center ${acik ? 'text-primary bg-primary/5' : 'text-gray-500 hover:text-primary'}`}>
          <Bell className="h-5 w-5" />{rozet}
        </button>
      ) : (
        <button onClick={() => setAcik((v) => !v)} aria-label="Bildirimler" aria-expanded={acik}
          className={`w-full flex items-center gap-3 px-2 py-3 text-sm font-semibold rounded-lg ${acik ? 'text-primary bg-primary/5' : 'text-gray-600'}`}>
          <Bell className="h-5 w-5" />
          Bildirimler
          {sayi > 0 && (
            <span data-testid="bildirim-sayi" className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {sayi > 99 ? '99+' : sayi}
            </span>
          )}
        </button>
      )}

      {acik && createPortal(
        <div role="dialog" aria-label="Bildirimler" ref={fenster}
          style={pos ? { top: pos.top, right: pos.right } : undefined}
          className={`fixed z-[60] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden ${pos ? 'w-[360px] max-w-[calc(100vw-24px)]' : 'left-3 right-3 top-[84px]'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-800">Bildirimler</span>
            {liste && liste.some((b) => !b.okundu) && (
              <button onClick={tumunuOku} className="text-xs font-semibold text-primary hover:underline">Tümünü okundu işaretle</button>
            )}
          </div>
          <div className="max-h-[60vh] md:max-h-[420px] overflow-y-auto">
            {liste === null ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Yükleniyor...</p>
            ) : hata && liste.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Bildirimler yüklenemedi.</p>
            ) : liste.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Henüz bildiriminiz yok</p>
                <p className="text-xs mt-1">Mesaj, teklif ve ilan durumları burada görünür.</p>
              </div>
            ) : (
              liste.map((b) => (
                <button key={b.id} onClick={() => tikla(b)} data-testid="bildirim-satir"
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start border-b border-gray-50 hover:bg-gray-50 ${b.okundu ? '' : 'bg-red-50/60'}`}>
                  <i className={`ti ${IKON[b.tip] || 'ti-bell'} text-lg mt-0.5 ${b.okundu ? 'text-gray-400' : 'text-primary'}`} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm truncate ${b.okundu ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{b.baslik}</span>
                    {b.icerik && <span className="block text-xs text-gray-500 line-clamp-2">{b.icerik}</span>}
                    <span className="block text-[11px] text-gray-400 mt-0.5">{zamanOnce(b.olusturma_tarihi)}</span>
                  </span>
                  {!b.okundu && <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" aria-label="okunmadı" />}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
