import { SIRKET, tamAdres } from '../../data/sirket'
export default function KullarimKosullari() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kullanım Koşulları</h1>
      <p className="text-sm text-gray-500 mb-8">Son güncelleme: 03.06.2026 | kapbeni.com</p>
      <section className="prose prose-sm max-w-none text-gray-700 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Hizmet Sağlayıcı</h2>
          <p>Bu platform, <strong>{SIRKET.unvan}</strong> tarafından işletilmektedir.<br />
          {SIRKET.vkn && <>Vergi Kimlik No: {SIRKET.vkn}{SIRKET.vergiDairesi && <> | {SIRKET.vergiDairesi}</>}<br /></>}
          Adres: {tamAdres()}<br />
          E-posta: {SIRKET.eposta} | Tel: {SIRKET.telefon}</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Platformun Amacı</h2>
          <p>Kap Beni, bireyler arasında ikinci el ürün alım-satımını kolaylaştıran bir ilan platformudur. Platform yalnızca aracılık hizmeti sunar; satıcı ile alıcı arasındaki sözleşmenin tarafı değildir.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Kullanıcı Yükümlülükleri</h2>
          <p>Kullanıcılar; gerçek ve doğru bilgi vermekle, yanıltıcı ilan oluşturmamakla, yasadışı ürün satmamakla ve diğer kullanıcılara saygılı davranmakla yükümlüdür. Aksine davranışlar hesap askıya alınmasına yol açabilir.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. İlan Kuralları</h2>
          <p>İlanlar Türkiye Cumhuriyeti mevzuatına uygun olmalıdır. Silah, uyuşturucu, sahte ürün ve telif hakkı ihlali içeren ilanlar yasaktır. Platform, uygunsuz ilanları önceden haber vermeksizin kaldırma hakkını saklı tutar.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Sorumluluk Sınırlaması</h2>
          <p>Kap Beni, kullanıcılar arasındaki alışverişlerden doğan anlaşmazlıklardan sorumlu tutulamaz. Platform, ilan içeriklerinin doğruluğunu garanti etmez.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Değişiklikler</h2>
          <p>Platform, bu koşulları önceden haber vermeksizin güncelleme hakkını saklı tutar. Güncel koşullar her zaman kapbeni.com/kullanim-kosullari adresinde yayımlanır.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Uygulanacak Hukuk</h2>
          <p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Mersin Tüketici Mahkemeleri ve Tüketici Hakem Heyetleri yetkilidir.</p>
        </div>
      </section>
    </div>
  )
}
