// Cookie-Banner + Tercihler-Fenster (Arbeitspaket D). Aufbau nach Cankartım
// CookieConsent (Kategorien zorunlu/analitik/pazarlama), Optik nach Styleguide §2.
//  - Banner unten als Karte; am Handy über der BottomNav (bottom-[72px]), damit die
//    Navigation bedienbar bleibt. Kein Overlay — die Seite bleibt benutzbar.
//  - „Reddet“ und „Tümünü kabul et“ gleich groß und gleich gestaltet (gleichwertig sichtbar).
//  - Tercihler-Fenster mit eigenem History-Eintrag (useGeriKapat, wie alle Fenster seit v1.30).
//  - Footer „Çerez Tercihleri“ öffnet das Fenster erneut (cerezTercihleriniAc()).
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useGeriKapat } from '../lib/geriTusu'
import { CEREZ_METIN as M, onayOku, onayYaz, cerezAcDinle, type CerezOnay } from '../lib/cerezOnay'

type Kat = 'zorunlu' | 'analitik' | 'pazarlama'

function Schalter({ an, onChange, gesperrt, label }: { an: boolean; onChange?: (v: boolean) => void; gesperrt?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={label}
      disabled={gesperrt}
      onClick={() => onChange?.(!an)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${an ? 'bg-primary' : 'bg-gray-200'} ${gesperrt ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${an ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function CerezBanner() {
  const [karar, setKarar] = useState<CerezOnay | null>(() => onayOku())
  const [tercihAcik, setTercihAcik] = useState(false)
  const [analitik, setAnalitik] = useState(false)
  const [pazarlama, setPazarlama] = useState(false)
  const [toast, setToast] = useState(false)

  const tercihKapat = useGeriKapat(tercihAcik, () => setTercihAcik(false), { escape: true })

  const tercihleriAc = () => {
    const o = onayOku()
    setAnalitik(!!o?.analitik)
    setPazarlama(!!o?.pazarlama)
    setTercihAcik(true)
  }

  useEffect(() => cerezAcDinle(tercihleriAc), [])

  const kaydet = (a: boolean, p: boolean) => {
    setKarar(onayYaz(a, p))
    if (tercihAcik) tercihKapat()
    setToast(true)
    window.setTimeout(() => setToast(false), 2500)
  }

  const kategoriler: { k: Kat; an: boolean; set?: (v: boolean) => void }[] = [
    { k: 'zorunlu', an: true },
    { k: 'analitik', an: analitik, set: setAnalitik },
    { k: 'pazarlama', an: pazarlama, set: setPazarlama },
  ]

  return (
    <>
      {!karar && !tercihAcik && (
        <div
          role="region"
          aria-label={M.baslik}
          data-cerez-banner
          className="fixed z-[90] left-2 right-2 bottom-[72px] md:left-4 md:right-auto md:bottom-4 md:max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <i className="ti ti-cookie text-primary text-lg" />
            <h2 className="text-sm font-bold text-gray-900">{M.baslik}</h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed max-h-28 overflow-y-auto">
            {M.aciklama}{' '}
            <a href={M.politikaLink.href} className="text-primary font-semibold hover:underline">{M.politikaLink.metin}</a>
            {' · '}
            <a href={M.kvkkLink.href} className="text-primary font-semibold hover:underline">{M.kvkkLink.metin}</a>
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" onClick={() => kaydet(false, false)} className="bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all">
              {M.reddet}
            </button>
            <button type="button" onClick={() => kaydet(true, true)} className="bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all">
              {M.tumunuKabul}
            </button>
          </div>
          <button type="button" onClick={tercihleriAc} className="w-full mt-2 border border-gray-200 hover:border-primary text-gray-800 py-2 rounded-xl font-semibold text-sm transition-colors">
            {M.tercihler}
          </button>
        </div>
      )}

      {tercihAcik && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={tercihKapat} />
          <div role="dialog" aria-modal="true" aria-label={M.baslik} className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <i className="ti ti-cookie text-primary text-lg" />
                <h2 className="text-base font-bold text-gray-900">{M.baslik}</h2>
              </div>
              <button type="button" onClick={tercihKapat} aria-label={M.kapat} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={16} className="text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-gray-600 leading-relaxed">
                {M.aciklama}{' '}
                <a href={M.politikaLink.href} className="text-primary font-semibold hover:underline">{M.politikaLink.metin}</a>
              </p>
              {kategoriler.map(({ k, an, set }) => {
                const kat = M.kategoriler[k]
                return (
                  <div key={k} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-gray-900">{kat.baslik}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500">
                          {k === 'zorunlu' ? M.herZaman : an ? M.acik : M.kapali}
                        </span>
                        <Schalter an={an} onChange={set} gesperrt={k === 'zorunlu'} label={kat.baslik} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mt-1.5">{kat.aciklama}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {kat.araclar.length ? kat.araclar.join(', ') : M.aracYok}
                    </p>
                  </div>
                )
              })}
              {!karar && <p className="text-[11px] text-gray-400">{M.kapatIpucu}</p>}
            </div>
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => kaydet(false, false)} className="bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all">
                  {M.reddet}
                </button>
                <button type="button" onClick={() => kaydet(true, true)} className="bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all">
                  {M.tumunuKabul}
                </button>
              </div>
              <button type="button" onClick={() => kaydet(analitik, pazarlama)} className="w-full bg-gray-100 text-gray-800 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
                {M.kaydet}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 z-[160] text-xs font-semibold">
          <i className="ti ti-circle-check text-base" />
          {M.kaydedildi}
        </div>
      )}
    </>
  )
}
