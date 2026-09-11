import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldCheck, Gift, Users, TrendingDown, PackageCheck, Building2 } from 'lucide-react'

const KACHELN = [
  {
    id: 1,
    title: 'Güvenli Alışveriş',
    desc: 'İpuçları ve anlaşma notu ile emniyetli alışveriş yapın',
    image: '/kacheln/guvenli-alisveris.png',
    icon: ShieldCheck,
    color: 'from-primary to-primary-container',
    modal: {
      title: 'Güvenli Alışveriş İpuçları',
      items: [
        { heading: 'Yüz yüze görüşün', text: 'Mümkün olduğunda ürünü bizzat görüp, deneyerek satın alın.' },
        { heading: 'Ödemeyi son adımda yapın', text: 'Ürünü teslim aldıktan sonra kontrol edin, her şey yolundaysa ödeme yapın.' },
        { heading: 'Tanımadığınıza para göndermeyin', text: 'Önceden havale/EFT isteyen satıcılara karşı dikkatli olun.' },
        { heading: 'Anlaşma notunu kullanın', text: 'Mesajlaşma ekranındaki anlaşma notu özelliğiyle koşulları yazılı kaydedin.' },
        { heading: 'Profil ve değerlendirmeleri inceleyin', text: 'Satıcının doğrulama rozetine ve kullanıcı yorumlarına bakın.' },
      ],
    },
  },
  {
    id: 2,
    title: 'İlk 14 Gün Ücretsiz',
    desc: 'Tüm yeni üyeler için geçerli, kredi kartı gerekmez',
    image: '/kacheln/ilk-14-gun.png',
    icon: Gift,
    color: 'from-purple-500 to-purple-700',
    modal: {
      title: 'İlk 14 Gün Ücretsiz',
      items: [
        { heading: 'Yeni üyelere özel', text: 'KapBeni\'ye yeni kaydolan tüm kullanıcılar ilk 14 gün boyunca premium özellikleri ücretsiz kullanır.' },
        { heading: 'Kredi kartı gerekmez', text: 'Kayıt sırasında herhangi bir ödeme bilgisi girmeniz gerekmez.' },
        { heading: 'Sınırsız ilan', text: 'Deneme süresince dilediğiniz kadar ilan verebilirsiniz.' },
        { heading: 'Otomatik yenileme yok', text: 'Süre bitiminde hiçbir ücret çekilmez; devam etmek isteyenler paket seçer.' },
      ],
    },
  },
  {
    id: 3,
    title: 'Milyonlarca Alıcı',
    desc: 'Geniş kullanıcı kitlesiyle ilanlarınız hızla satılır',
    image: '/kacheln/milyonlarca-alici.png',
    icon: Users,
    color: 'from-secondary to-blue-700',
    modal: {
      title: 'Milyonlarca Alıcı',
      items: [
        { heading: 'Türkiye genelinde erişim', text: 'İlanlarınız tüm Türkiye\'deki aktif alıcılara ulaşır.' },
        { heading: 'Hızlı satış', text: 'Büyük ve aktif kullanıcı kitlesi sayesinde ilanlar kısa sürede ilgi görür.' },
        { heading: 'Kategoriye göre alıcılar', text: 'Elektronik, giyim, araç gibi her kategoride ilgili alıcılar mevcuttur.' },
        { heading: 'Teklif sistemi', text: 'Alıcılar doğrudan teklif yapabilir; satışı hızlandırır.' },
      ],
    },
  },
  {
    id: 4,
    title: 'En Uygun Fiyatlar',
    desc: 'İkinci el ürünlerde en iyi fiyatları bulun',
    image: '/kacheln/elektronik.png',
    icon: TrendingDown,
    color: 'from-tertiary to-green-800',
    modal: {
      title: 'En Uygun Fiyatlar',
      items: [
        { heading: 'Piyasa fiyatını karşılaştırın', text: 'Benzer ürünlerin fiyatlarını yan yana görerek en avantajlısını seçin.' },
        { heading: 'Teklif verin', text: 'Satıcıyla mesajlaşarak fiyat üzerinde pazarlık yapabilirsiniz.' },
        { heading: 'Fiyat alarmı', text: 'Takip ettiğiniz kategoride yeni ilan eklendiğinde bildirim alın.' },
        { heading: 'Sıfır ürünlere kıyasla %50–80 daha ucuz', text: 'Kaliteli ikinci el ürünleri çok daha uygun fiyata bulun.' },
      ],
    },
  },
  {
    id: 5,
    title: 'Küçük Ev Aletleri',
    desc: 'Mutfak, temizlik ve ev tipi cihazları uygun fiyata bulun',
    image: '/kacheln/beyaz-esya.png',
    icon: PackageCheck,
    color: 'from-amber-500 to-amber-600',
    modal: {
      title: 'Küçük Ev Aletleri',
      items: [
        { heading: 'Tüm kategoriler açık', text: 'Elektronik, giyim, mobilya, araç, spor malzemeleri ve daha fazlası.' },
        { heading: 'Kolay ilan oluşturma', text: 'Fotoğraf çek, fiyat belirle, açıklama yaz — dakikalar içinde yayında.' },
        { heading: 'Çoklu fotoğraf', text: 'Her ilanınıza birden fazla fotoğraf ekleyerek alıcıları daha çok çekin.' },
        { heading: 'Evinizi boşaltın, cebinizi doldurun', text: 'Kullanmadığınız her ürün bir başkasına değer katabilir.' },
      ],
    },
  },
  {
    id: 6,
    title: 'Kurumsal Çözümler',
    desc: 'Firmalar için özel paketler ve öncelikli destek',
    image: '/kacheln/kurumsal-cozumler.png',
    icon: Building2,
    color: 'from-teal-500 to-teal-600',
    modal: {
      title: 'Kurumsal Çözümler',
      items: [
        { heading: 'Özel kurumsal paket', text: 'Firmalar için aylık veya yıllık abonelik seçenekleri mevcuttur.' },
        { heading: 'Öncelikli destek', text: 'Kurumsal hesaplar özel destek hattı ve öncelikli yanıt hakkından yararlanır.' },
        { heading: 'Toplu ilan yönetimi', text: 'Birden fazla ilanı aynı anda düzenleyip yayınlayabilirsiniz.' },
        { heading: 'Marka görünürlüğü', text: 'Firma logonuz ve bilgileriniz tüm ilanlarınızda öne çıkar.' },
      ],
    },
  },
]

interface ModalItem { heading: string; text: string }
interface KachelModal { title: string; items: ModalItem[] }

function KachelModal({ modal, icon: Icon, color, onClose }: { modal: KachelModal; icon: React.ElementType; color: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-br ${color} p-6 text-white relative`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold">{modal.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {modal.items.map((item, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.heading}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-95"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function FeatureKacheln() {
  const [orders, setOrders] = useState(() => KACHELN.map((_, i) => i))
  const [activeModal, setActiveModal] = useState<number | null>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (pausedRef.current) return
      setOrders((prev) => {
        const next = [...prev]
        let i = Math.floor(Math.random() * next.length)
        let j = Math.floor(Math.random() * next.length)
        while (j === i) j = Math.floor(Math.random() * next.length)
        ;[next[i], next[j]] = [next[j], next[i]]
        return next
      })
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  const activeKachel = activeModal !== null ? KACHELN.find((k) => k.id === activeModal) : null

  return (
    <>
      <section className="w-full py-8">
        {/* Header */}
        <div className="flex flex-row justify-between items-end mb-8 border-b border-gray-200 pb-5">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
            Neden Kap Beni?
          </h2>
          <div className="text-primary font-bold text-xs md:text-sm tracking-wide uppercase">
            Güvenle Al • Kolay Sat
          </div>
        </div>

        {/* Mosaic Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
          onMouseEnter={() => { pausedRef.current = true }}
          onMouseLeave={() => { pausedRef.current = false }}
        >
          {KACHELN.map((k, i) => (
            <div
              key={k.id}
              style={{
                order: orders[i],
                transition: 'order 700ms ease-in-out',
              }}
              className="group"
            >
              <div
                className="relative aspect-square rounded-2xl overflow-hidden bg-slate-200 cursor-pointer"
                style={{ transition: 'transform 500ms cubic-bezier(0.4,0,0.2,1)' }}
                onClick={() => setActiveModal(k.id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.zIndex = '10' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.zIndex = '0' }}
              >
                <img
                  src={k.image}
                  alt={k.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Click hint on hover */}
                <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-semibold">
                  Daha Fazla →
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {activeKachel && (
        <KachelModal
          modal={activeKachel.modal}
          icon={activeKachel.icon}
          color={activeKachel.color}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  )
}
