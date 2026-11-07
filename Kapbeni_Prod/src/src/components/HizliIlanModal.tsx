// ════════════════════════════════════════════════════════════════════════════
//  "Hızlı İlan Ver – 3 adımda" (Auftragssammlung M).
//
//  Kurze Anleitung vor dem ersten Inserat, Optik wie OnayModal (dunkler
//  Ueberzug, weisse Karte rounded-2xl, Knoepfe rounded-xl). Am Ende oeffnet
//  "Şimdi ilan ver" die Verkaufsmaske.
//
//  Browser-Zurueck schliesst das Fenster (Auftragssammlung K): beim Oeffnen
//  wird ein History-Eintrag gesetzt, X/Vazgeç gehen per history.back() zurueck,
//  damit kein toter Eintrag stehen bleibt.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { DURUM_SECENEKLERI } from '../api'

interface Props {
  offen: boolean
  onKapat: () => void
  onIlanVer: () => void
}

const ADIMLAR = ['Hazırlık', 'Başlık & açıklama', 'Yayınla']

function Madde({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
      <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
        <i className={`ti ti-${icon}`} style={{ fontSize: 17, color: 'var(--color-primary)' }} />
      </div>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </li>
  )
}

export default function HizliIlanModal({ offen, onKapat, onIlanVer }: Props) {
  const [adim, setAdim] = useState(0)
  const grund = useRef<'ilanver' | null>(null)
  const kapatRef = useRef(onKapat); kapatRef.current = onKapat
  const ilanVerRef = useRef(onIlanVer); ilanVerRef.current = onIlanVer

  useEffect(() => {
    if (!offen) return
    setAdim(0)
    // Bestehenden State mitnehmen: App.tsx erkennt seine Eintraege am Feld `nav`.
    window.history.pushState({ ...(window.history.state || {}), hizliIlan: true }, '', window.location.href)
    const onPop = () => {
      const g = grund.current
      grund.current = null
      kapatRef.current()
      // Erst nach dem Schliessen oeffnen: App.tsx schliesst bei popstate alle
      // Overlays — dieser Handler laeuft danach und oeffnet die Maske wieder.
      if (g === 'ilanver') ilanVerRef.current()
    }
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') window.history.back() }
    window.addEventListener('popstate', onPop)
    document.addEventListener('keydown', taste)
    return () => { window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', taste) }
  }, [offen])

  if (!offen) return null
  const schliessen = (g: 'ilanver' | null = null) => { grund.current = g; window.history.back() }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[90] p-4"
      onClick={() => schliessen()} role="dialog" aria-modal="true" aria-label="Hızlı İlan Ver">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
              <i className="ti ti-bolt" style={{ fontSize: 20, color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Hızlı İlan Ver – 3 adımda</h3>
              <p className="text-xs text-gray-500">Adım {adim + 1}/3 · {ADIMLAR[adim]}</p>
            </div>
          </div>
          <button type="button" onClick={() => schliessen()} aria-label="Kapat"
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Fortschritt */}
        <div className="flex gap-1.5 mb-5">
          {ADIMLAR.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= adim ? 'bg-primary' : 'bg-gray-100'}`} />
          ))}
        </div>

        {adim === 0 && (
          <ul className="space-y-2.5">
            <Madde icon="camera"><strong>3–8 fotoğraf</strong> çekin, mümkünse gün ışığında. İlk fotoğraf ilanın kapağı olur.</Madde>
            <Madde icon="video">İsterseniz kısa bir <strong>video</strong> ekleyin (en fazla 60 saniye önerilir).</Madde>
            <Madde icon="tag"><strong>Fiyat</strong> ve <strong>ürün durumu</strong>: {DURUM_SECENEKLERI.map((d) => d.etiket).join(', ')}.</Madde>
            <Madde icon="map-pin"><strong>İl ve ilçe</strong> — "Konumu Kullan" ile tek dokunuşta doldurabilirsiniz.</Madde>
          </ul>
        )}

        {adim === 1 && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-800 mb-1.5">Başlık: Marka + Model + en önemli özellik</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Apple iPhone 13 128 GB – pil sağlığı %89</li>
                <li>• Arçelik 9 kg çamaşır makinesi – 2 yıllık</li>
                <li>• Chicco bebek arabası – katlanır, az kullanılmış</li>
              </ul>
            </div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Açıklamada olsun</p>
            <ul className="grid grid-cols-1 gap-1.5 text-sm text-gray-700">
              {['Yaşı / kullanım süresi', 'Kullanım izleri, varsa kusurlar', 'Aksesuarlar, kutu', 'Fatura veya garanti', 'Teslimat: elden veya kargo'].map((m) => (
                <li key={m} className="flex items-center gap-2"><i className="ti ti-check" style={{ fontSize: 15, color: '#15803d' }} />{m}</li>
              ))}
            </ul>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex gap-2">
              <i className="ti ti-alert-triangle" style={{ fontSize: 16 }} />
              <span><strong>Telefon, IBAN, WhatsApp</strong> açıklamaya yazılmaz. Yapay zekâ denetimi bu tür ilanları reddeder; iletişim kapbeni mesajlarıyla olur.</span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> İlan formundaki <strong>“KI ile açıklama öner”</strong> size bir taslak hazırlar.
            </p>
          </div>
        )}

        {adim === 2 && (
          <ul className="space-y-2.5">
            <Madde icon="shield-check">İlanınız gönderdikten sonra <strong>birkaç saniye içinde</strong> yapay zekâ ile kontrol edilir.</Madde>
            <Madde icon="clock">Uygunsa hemen yayına girer. Emin olunamazsa ekibimiz inceler; bu durumda yayına alınması biraz sürebilir.</Madde>
            <Madde icon="rocket"><strong>Öne Çıkan / Doping</strong> ile ilanınızı daha fazla kişiye gösterebilirsiniz.</Madde>
          </ul>
        )}

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={() => (adim === 0 ? schliessen() : setAdim(adim - 1))}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
            {adim === 0 ? 'Vazgeç' : 'Geri'}
          </button>
          {adim < 2 ? (
            <button type="button" onClick={() => setAdim(adim + 1)}
              className="flex-1 bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
              İleri
            </button>
          ) : (
            <button type="button" onClick={() => schliessen('ilanver')}
              className="flex-1 bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer">
              Şimdi ilan ver
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
