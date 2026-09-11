export default function CerezPolitikasi() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Çerez Politikası</h1>
      <p className="text-sm text-gray-500 mb-8">Son güncelleme: 03.06.2026 | kapbeni.com</p>
      <section className="prose prose-sm max-w-none text-gray-700 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Çerez Nedir?</h2>
          <p>Çerezler, web sitemizi ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyalarıdır. Oturumunuzu açık tutmak ve tercihlerinizi hatırlamak için kullanılırlar.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Kullandığımız Çerezler</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Çerez Adı</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Amaç</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Süre</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2">sg_token</td>
                <td className="border border-gray-200 px-3 py-2">Oturum kimlik doğrulama (JWT)</td>
                <td className="border border-gray-200 px-3 py-2">Oturum süresi</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2">localStorage (SPA)</td>
                <td className="border border-gray-200 px-3 py-2">Uygulama tercihleri</td>
                <td className="border border-gray-200 px-3 py-2">Kalıcı (silene kadar)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Zorunlu Çerezler</h2>
          <p>Platformun çalışması için zorunlu olan çerezler devre dışı bırakılamaz. Bu çerezler kişisel veri niteliği taşımaz ve yalnızca teknik işlev görür.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. Çerezleri Yönetme</h2>
          <p>Tarayıcı ayarlarından tüm çerezleri silebilirsiniz. Ancak bu durumda oturumunuz kapanır ve bazı özellikler çalışmayabilir.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. İletişim</h2>
          <p>Sorularınız için: <strong>destek@kapbeni.com</strong></p>
        </div>
      </section>
    </div>
  )
}
