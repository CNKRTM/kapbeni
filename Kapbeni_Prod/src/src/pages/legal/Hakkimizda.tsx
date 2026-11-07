import { SIRKET, tamAdres } from '../../data/sirket'
export default function Hakkimizda() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Hakkımızda</h1>
      <p className="text-gray-700 leading-relaxed mb-4">
        <strong>Kap Beni</strong>, Türkiye'nin güvenilir ikinci el alışveriş platformudur. Amacımız; insanların ihtiyaç duymadıkları eşyaları kolayca satabilmesi ve uygun fiyatlı ürünlere hızlıca ulaşabilmesini sağlamaktır.
      </p>
      <p className="text-gray-700 leading-relaxed mb-4">
        Platform, bireyler arasındaki alım-satımı güvenli, şeffaf ve kolay hale getirmek için tasarlanmıştır. İkinci el ekonomisini destekleyerek hem cüzdanınıza hem de çevreye katkı sağlıyoruz.
      </p>
      <p className="text-gray-700 leading-relaxed">
        Sorularınız ve önerileriniz için:{' '}
        <a href={`mailto:${SIRKET.destekEposta}`} className="text-[var(--color-primary)] underline">{SIRKET.destekEposta}</a>
      </p>
      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-sm text-gray-500">
        <p><strong>İşletmeci:</strong> {SIRKET.unvan}</p>
        {SIRKET.vkn && <p><strong>VKN:</strong> {SIRKET.vkn}{SIRKET.vergiDairesi && <> | {SIRKET.vergiDairesi}</>}</p>}
        <p><strong>Adres:</strong> {tamAdres()}</p>
        <p><strong>İletişim:</strong> {SIRKET.eposta} | {SIRKET.telefon}</p>
      </div>
    </div>
  )
}
