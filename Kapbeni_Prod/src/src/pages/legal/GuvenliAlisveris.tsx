import { ArrowLeft, MapPin, Eye, CreditCard, MessageCircle, TriangleAlert, ShieldCheck, CircleCheckBig } from 'lucide-react'

interface Props {
  onBack?: () => void
}

const TIPS = [
  {
    icon: MapPin,
    color: 'bg-blue-50 text-blue-600',
    title: 'Halka Açık Yerde Buluşun',
    desc: 'Elden teslimatta kafe, AVM veya kalabalık cadde gibi güvenli ve aydınlık kamusal alanlarda buluşun. Yabancıları evinize veya ıssız yerlere davet etmeyin. Güvendiğiniz biri varsa yanınızda alın.',
  },
  {
    icon: Eye,
    color: 'bg-green-50 text-green-600',
    title: 'Ürünü Teslim Almadan Önce İnceleyin',
    desc: 'Ürünü teslim almadan önce çalışıp çalışmadığını, açıklanan özelliklere uyup uymadığını mutlaka kontrol edin. Acele etmeyin; sorunuz varsa sorun, tatmin olmadan para ödemeyin.',
  },
  {
    icon: CreditCard,
    color: 'bg-purple-50 text-purple-600',
    title: 'İzlenebilir Ödeme Yöntemi Kullanın',
    desc: 'Banka havalesi veya EFT gibi kayıt altına alınan ödeme yöntemlerini tercih edin. Ödemeyi ürünü teslim aldıktan sonra yapın. Dijital cüzdanlar ve kart ödemeleri de güvenli seçenektir.',
  },
  {
    icon: MessageCircle,
    color: 'bg-orange-50 text-orange-600',
    title: 'Platform Üzerinden İletişim Kurun',
    desc: 'Tüm yazışmalarınızı Kap Beni mesajlaşma sistemi üzerinden yapın. Bu sayede iletişim kaydınız güvende olur ve gerektiğinde şikayet sürecinde referans olarak kullanılabilir.',
  },
  {
    icon: TriangleAlert,
    color: 'bg-red-50 text-red-600',
    title: 'Dolandırıcılık Belirtilerine Dikkat Edin',
    desc: 'Çok düşük fiyatlı teklifler, önceden ödeme talepleri, banka bilgisi isteme, acele ettirme – bunlar dolandırıcılık belirtileridir. Bu tür ilan ve kullanıcıları hemen platform üzerinden şikayet edin.',
  },
]

export default function GuvenliAlisveris({ onBack }: Props) {
  const goBack = () => {
    if (onBack) onBack()
    else window.location.hash = ''
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>

      <div className="bg-[var(--color-primary)] rounded-3xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheck className="w-8 h-8" />
          <h1 className="text-xl font-bold">Güvenli Alışveriş Rehberi</h1>
        </div>
        <p className="text-red-100 text-sm leading-relaxed">
          Kap Beni, bireyler arasında iletişim kurulmasını sağlayan bir ilan platformudur. Alım-satım işlemleri doğrudan kullanıcılar arasında gerçekleşir. Alışverişinizi güvenli kılmak için aşağıdaki önerileri dikkate alın.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl shadow-sm p-5">
        <div className="flex gap-3">
          <TriangleAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold mb-2">Önemli Bilgilendirme</h2>
            <p className="text-sm leading-relaxed">
              <strong>Kap Beni ödeme sürecine dahil olmaz; alım-satım işlemlerine aracılık etmez ve ödeme sürecinde taraf olmaz.</strong>{' '}
              Platformumuz, alıcı ve satıcıların birbirini bulması için bir ilan panosu işlevi görür. Herhangi bir ödeme güvencesi, emanet (escrow) hizmeti veya anlaşmazlık çözüm mekanizması sunulmamaktadır. Bu nedenle işlemlerinizde dikkatli olmanızı ve aşağıdaki güvenlik önerilerine uymanızı şiddetle tavsiye ederiz.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Güvenli Alışveriş İpuçları</h2>
        </div>
        {TIPS.map((tip, idx) => {
          const Icon = tip.icon
          return (
            <div key={idx} className="px-5 py-4 flex gap-4 border-b border-gray-50 last:border-0">
              <div className={`w-10 h-10 rounded-xl ${tip.color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{tip.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <CircleCheckBig className="w-5 h-5 text-primary" />
          Anlaşma Notu Özelliği
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          Bir satıcı veya alıcıyla anlaştığınızda, sohbet ekranındaki{' '}
          <strong>"Anlaşma Notu"</strong> butonuyla kararlaştırdığınız fiyatı, ürünü ve teslimat yöntemini zaman damgalı olarak sohbete sabitleyebilirsiniz. Bu not her iki tarafça da görünür ve anlaşma sürecini belgeler.
        </p>
        <p className="text-xs text-gray-400">
          Not: Bu özellik yasal bir bağlayıcılık taşımamaktadır. Taraflar arasındaki anlaşmayı kayıt altına almak amacıyla tasarlanmıştır.
        </p>
      </div>

      <div className="text-center pb-safe">
        <p className="text-sm text-gray-500 mb-3">Güvenli alışveriş hakkında sorunuz mu var?</p>
        <a href="mailto:destek@kapbeni.com" className="text-primary font-medium text-sm hover:underline">
          Destek ekibimize ulaşın →
        </a>
      </div>
    </div>
  )
}
