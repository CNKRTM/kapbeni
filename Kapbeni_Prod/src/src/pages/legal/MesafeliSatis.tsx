export default function MesafeliSatis() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mesafeli Satış Sözleşmesi Hakkında Bilgilendirme</h1>
      <p className="text-sm text-gray-500 mb-8">6502 Sayılı Tüketici Kanunu ve Mesafeli Sözleşmeler Yönetmeliği kapsamında hazırlanmıştır.</p>
      <section className="prose prose-sm max-w-none text-gray-700 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Platform'un Rolü</h2>
          <p>Kap Beni bir aracı platform olup satıcı ile alıcı arasındaki bireysel satışlarda taraf değildir. Mesafeli satış sözleşmesi; ilan sahibi (satıcı) ile alıcı arasında kurulmaktadır.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Cayma Hakkı (14 Gün)</h2>
          <p>Tüketiciler, ürünü teslim aldıkları tarihten itibaren <strong>14 gün</strong> içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkını kullanabilir. Cayma bildiriminin satıcıya yazılı olarak (mesaj/e-posta) iletilmesi yeterlidir.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Cayma Hakkı İstisnaları</h2>
          <p>Aşağıdaki durumlarda cayma hakkı kullanılamaz: Hızlı bozulan ya da son kullanma tarihi geçebilecek ürünler, kişiye özel üretilen ürünler, ambalajı açılmış hijyenik ürünler.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. İade Süreci</h2>
          <p>Cayma hakkı kullanıldığında, ürün 10 gün içinde iade edilmelidir. Kargo masrafları taraflarca kararlaştırılır. Satıcı, ürünü teslim aldığı tarihten itibaren 14 gün içinde ödemeyi iade etmekle yükümlüdür.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Şikayet ve Uyuşmazlık</h2>
          <p>Uyuşmazlıklarda öncelikle destek@kapbeni.com adresine başvurunuz. Çözüme kavuşturulamazsa Tüketici Hakem Heyeti veya Tüketici Mahkemesi'ne başvurabilirsiniz.<br />
          Ayrıca <a href="https://tuketici.gov.tr" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">tuketici.gov.tr</a> üzerinden e-Devlet şikayeti oluşturabilirsiniz.</p>
        </div>
      </section>
    </div>
  )
}
