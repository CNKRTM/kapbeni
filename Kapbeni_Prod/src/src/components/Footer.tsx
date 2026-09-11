// Footer.tsx — 1:1 nach Live-Bundle (index-B_ZskGvg.js)
// 5 Spalten: Logo | Kurumsal | Paketler (Buttons → PaketModal) | Yardım | İletişim
import { useState } from 'react'
import { ChevronDown, X, Gift, Bookmark, Sparkles, Building2, Zap, Crown } from 'lucide-react'

const LEGAL_LINKS = [
  { label: 'Kullanım Koşulları', href: '/#/kullanim-kosullari' },
  { label: 'Gizlilik Politikası', href: '/#/gizlilik-politikasi' },
  { label: 'Mesafeli Satış', href: '/#/mesafeli-satis' },
  { label: 'Çerez Politikası', href: '/#/cerez-politikasi' },
  { label: 'İade ve Geri Ödeme Politikası', href: '/#/iade-politikasi' },
]

interface Paket {
  title: string
  icon: React.ReactNode
  price: string
  duration: string
  color: string
  gradient: string
  bullets: string[]
}

const PAKETLER_BIREYSEL: Paket[] = [
  {
    title: 'Ücretsiz Deneme', icon: <Gift size={20} />, price: 'Ücretsiz', duration: '14 gün',
    color: '#15803d', gradient: 'linear-gradient(135deg,#16a34a,#15803d)',
    bullets: ['İlk 14 gün tamamen ücretsiz', '5 adede kadar ilan yayınla', 'Alıcılarla doğrudan mesajlaş', 'Temel istatistiklere eriş'],
  },
  {
    title: 'Öne Çıkan İlan', icon: <Bookmark size={20} />, price: '₺49,90', duration: '30 gün',
    color: '#0d9488', gradient: 'linear-gradient(135deg,#2dd4bf,#0d9488)',
    bullets: ['İlanınız ana sayfada türkiz Öne Çıkan sliderında görünür', 'Arama sonuçlarında üst sıralarda çıkar', 'Modern Bookmark etiketi ile öne çık', '3× daha fazla görüntülenme garantisi'],
  },
  {
    title: 'Süper İlan', icon: <Sparkles size={20} />, price: '₺99,90', duration: '30 gün',
    color: '#1d6fa8', gradient: 'linear-gradient(135deg,#7ab8e8,#1d6fa8)',
    bullets: ['İlanınız ana sayfada mavi Süper İlan sliderında öne çıkar', 'Sparkles ✦ ikonu ile premium görünüm', 'Büyük kart formatında vitrin gösterimi', '8× daha fazla görüntülenme', 'Öncelikli müşteri desteği'],
  },
]

const PAKETLER_KURUMSAL: Paket[] = [
  {
    title: 'Başlangıç', icon: <Building2 size={20} />, price: '₺299', duration: 'aylık',
    color: '#6d28d9', gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    bullets: ['Aylık 20 ilan yayınlama hakkı', '2 Öne Çıkan İlan kredisi / ay', 'Kurumsal profil sayfası', 'E-posta desteği'],
  },
  {
    title: 'Profesyonel', icon: <Zap size={20} />, price: '₺699', duration: 'aylık',
    color: '#b45309', gradient: 'linear-gradient(135deg,#f59e0b,#b45309)',
    bullets: ['Sınırsız ilan yayınlama hakkı', '5 Öne Çıkan + 2 Süper İlan kredisi / ay', 'Öncelikli arama sıralaması', 'Analitik & raporlama paneli', 'Telefon + e-posta destek'],
  },
  {
    title: 'Premium', icon: <Crown size={20} />, price: '₺1.499', duration: 'aylık',
    color: '#0369a1', gradient: 'linear-gradient(135deg,#38bdf8,#0369a1)',
    bullets: ['Sınırsız ilan + Öne Çıkan kredisi', '10 Süper İlan kredisi / ay', 'Dedicated kurumsal hesap yöneticisi', 'API entegrasyon & teknik destek', 'Özel marka profil sayfası'],
  },
]

function PaketModal({ paket, onClose }: { paket: Paket; onClose: () => void }) {
  const bg = paket.gradient || paket.color
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div style={{ background: bg }} className="px-5 py-5 flex items-center justify-between relative overflow-hidden">
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -15, left: -15, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
          <div className="flex items-center gap-3 relative">
            <span style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {paket.icon}
            </span>
            <div>
              <h3 className="text-white font-black text-base leading-tight">{paket.title}</h3>
              <p className="text-white/70 text-xs mt-0.5">{paket.duration}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <span className="text-white font-black text-xl">{paket.price}</span>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/35 transition-colors">
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {paket.bullets.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: paket.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M2 5l2 2 4-4" stroke={paket.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <a
            href="/#/paketler"
            className="block w-full text-center py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: bg }}
          >
            Paketi İncele & Satın Al
          </a>
        </div>
      </div>
    </div>
  )
}

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false)
  const [activePaket, setActivePaket] = useState<Paket | null>(null)

  return (
    <>
      {activePaket && <PaketModal paket={activePaket} onClose={() => setActivePaket(null)} />}
      <footer className="bg-gray-900 text-gray-300 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

            {/* Logo + tagline */}
            <div>
              <img src="/logo-footer.png" alt="Kap Beni" className="h-[108px] w-auto object-contain mb-4" />
              <p className="text-sm text-gray-400 leading-relaxed">
                Türkiye'nin güvenilir ikinci el alışveriş platformu. Beğen, kap, senin olsun.
              </p>
            </div>

            {/* Kurumsal */}
            <div>
              <h3 className="text-white font-semibold mb-4">Kurumsal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/#/hakkimizda" className="hover:text-white transition-colors">Hakkımızda</a></li>
                {LEGAL_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Paketler */}
            <div>
              <h3 className="text-white font-semibold mb-4">Paketler</h3>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Bireysel</p>
              <ul className="space-y-1.5 text-sm mb-3">
                {PAKETLER_BIREYSEL.map((p) => (
                  <li key={p.title}>
                    <button
                      type="button"
                      onClick={() => setActivePaket(p)}
                      className="hover:text-white transition-colors text-left flex items-center gap-2 group"
                    >
                      <span className="opacity-50 group-hover:opacity-90 transition-opacity" style={{ color: '#fff', display: 'flex' }}>{p.icon}</span>
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Kurumsal</p>
              <ul className="space-y-1.5 text-sm">
                {PAKETLER_KURUMSAL.map((p) => (
                  <li key={p.title}>
                    <button
                      type="button"
                      onClick={() => setActivePaket(p)}
                      className="hover:text-white transition-colors text-left flex items-center gap-2 group"
                    >
                      <span className="opacity-50 group-hover:opacity-90 transition-opacity" style={{ color: '#fff', display: 'flex' }}>{p.icon}</span>
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Yardım */}
            <div>
              <h3 className="text-white font-semibold mb-4">Yardım</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/#/nasil-calisir" className="hover:text-white transition-colors">Nasıl Çalışır?</a></li>
                <li><a href="/#/guvenli-alisveris" className="hover:text-white transition-colors">Güvenli Alışveriş</a></li>
                <li><a href="mailto:destek@kapbeni.com" className="hover:text-white transition-colors">destek@kapbeni.com</a></li>
                <li><a href="tel:+905380324398" className="hover:text-white transition-colors">+90 538 032 43 98</a></li>
              </ul>
            </div>

            {/* İletişim + ETBİS */}
            <div>
              <h3 className="text-white font-semibold mb-4">İletişim</h3>
              <button
                type="button"
                onClick={() => setContactOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                İletişim Bilgileri
                <ChevronDown size={14} className={`transition-transform ${contactOpen ? 'rotate-180' : ''}`} />
              </button>
              {contactOpen && (
                <address className="not-italic text-sm space-y-1 text-gray-400 mt-3">
                  <p className="text-gray-300 font-medium">Tamer Aydın</p>
                  <p>Şahıs İşletmesi</p>
                  <p>
                    Akdeniz Mah. 39741 Sk.<br />
                    Akdeniz 7 Sitesi No:1/B İç Kapı No:3<br />
                    Mezitli / Mersin
                  </p>
                  <p className="pt-1">VKN: 1151635832</p>
                  <p>İstiklal Vergi Dairesi Müdürlüğü</p>
                  <p className="pt-1">
                    <a href="mailto:destek@kapbeni.com" className="hover:text-white">destek@kapbeni.com</a>
                  </p>
                  <p>
                    <a href="tel:+905380324398" className="hover:text-white">+90 538 032 43 98</a>
                  </p>
                </address>
              )}
              <div className="mt-4">
                <a
                  href="https://www.eticaret.gov.tr/sitedogrulama"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="ETBİS - Elektronik Ticaret Bilgi Sistemi"
                  className="inline-flex flex-col items-center gap-1.5"
                >
                  <span className="bg-white rounded-lg px-3 py-2 inline-flex items-center justify-center shadow-sm">
                    <img src="/etbis-logo.png" alt="ETBİS Kayıtlı" className="h-14 w-auto object-contain" />
                  </span>
                  <span className="text-xs font-medium text-gray-300">ETBİS'e Kayıtlıdır.</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            {/* Version aus /opt/kapbeni/VERSION, zur Bauzeit eingesetzt (vite.config.ts).
                Gleiche Zeile, gleiche Groesse, gleiche Farbe wie der Rest der Fusszeile. */}
            <p>
              © 2026 Kap Beni – Tamer Aydın Şahıs İşletmesi. Tüm hakları saklıdır.
              <span className="text-gray-600 ml-2">v{__APP_VERSION__}</span>
            </p>
            <p>
              Faaliyet Kodu: 479114 – İnternet üzerinden perakende ticaret |{' '}
              <a href="/#/gizlilik-politikasi" className="hover:text-gray-300 transition-colors">KVKK</a>
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
