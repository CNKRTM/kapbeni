import { ArrowLeft, Camera, MessageCircle, FileText, Truck, Star, Shield } from 'lucide-react'

interface Props {
  onBack?: () => void
}

const STEPS = [
  { icon: Camera, no: '01', title: 'Fotoğraf Çek & İlan Ver', desc: 'Satmak istediğin ürünün birkaç fotoğrafını çek. Başlık, açıklama, kategori ve fiyat ekle. İlanın dakikalar içinde yayında!' },
  { icon: MessageCircle, no: '02', title: 'Alıcıyla İletişime Geç', desc: 'İlgilenen alıcılar sana mesaj yazar. Platform üzerinden güvenle yazış, sorularını yanıtla ve fiyat konuş.' },
  { icon: FileText, no: '03', title: 'Anlaşmayı Kaydet', desc: '"Anlaşma Notu" özelliğiyle kararlaştırdığınız fiyatı, ürünü ve teslimat yöntemini zaman damgalı olarak sohbete sabitleyin.' },
  { icon: Truck, no: '04', title: 'Teslim Et', desc: 'Kargo gönder ya da elden teslim. Kamu alanlarında buluşmayı tercih et. Ödemeyi almadan önce ürünü teslim etme.' },
  { icon: Star, no: '05', title: 'Değerlendirme Yap', desc: 'İşlem tamamlandıktan sonra karşılıklı değerlendirme yapın. Güvenilir satıcı rozetine ulaşmak için puanını yükselt.' },
  { icon: Shield, no: '06', title: 'Güvende Kal', desc: 'Şüpheli bir durumla karşılaşırsan "Şikayet Et" butonunu kullan. Ekibimiz 24 saat içinde inceler.' },
]

export default function NasilCalisir({ onBack }: Props) {
  const goBack = () => {
    if (onBack) onBack()
    else window.location.hash = ''
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700" aria-label="Geri">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Nasıl Çalışır?</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Kap Beni ile Satmak Çok Kolay</h2>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            Saniyeler içinde ilan ver, güvenle alışveriş yap. İşte adım adım nasıl çalıştığımız:
          </p>
        </div>

        <div className="space-y-4 mb-10">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.no} className="bg-white rounded-2xl p-5 flex gap-4 shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary mb-0.5">ADIM {step.no}</div>
                  <h3 className="font-bold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl p-5 flex items-center gap-4 shadow-2xs border border-gray-100 mb-6">
          <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-0.5">Güvenli Alışveriş İpuçları</h3>
            <p className="text-sm text-gray-600">Dolandırıcılığa karşı kendini korumanın yollarını öğren.</p>
          </div>
          <a href="/#/guvenli-alisveris" className="text-primary hover:underline font-semibold text-sm whitespace-nowrap">
            Daha fazla →
          </a>
        </div>

        <div className="bg-gradient-to-br from-primary to-primary-container rounded-2xl p-6 text-center text-white mb-6">
          <h3 className="text-xl font-bold mb-2">Hemen Başla!</h3>
          <p className="text-white/80 text-sm mb-4">İlk 3 ay ücretsiz. Kayıt ol, ilan ver.</p>
          <button
            onClick={goBack}
            className="bg-white text-primary font-bold px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            İlan Ver
          </button>
        </div>

        <p className="text-center text-sm text-gray-500">
          Sorularınız mı var?{' '}
          <a href="/#/" className="text-primary hover:underline font-medium">Destek ekibimizle konuşun →</a>
        </p>
      </div>
    </div>
  )
}
