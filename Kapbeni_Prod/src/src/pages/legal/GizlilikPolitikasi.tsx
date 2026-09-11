export default function GizlilikPolitikasi() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Kişisel Verilerin Korunması ve Gizlilik Politikası</h1>
      <p className="text-sm text-gray-500 mb-2">6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK) Kapsamında Aydınlatma Metni</p>
      <p className="text-sm text-gray-500 mb-8">Son güncelleme: 03.06.2026  |  Yürürlük: 03.06.2026  |  <strong>kapbeni.com</strong></p>

      <section className="text-gray-700 space-y-8 text-sm leading-relaxed">
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">1. Veri Sorumlusunun Kimliği</h2>
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi uyarınca, kişisel verilerinizi işleyen veri sorumlusu aşağıda tanımlanmıştır:</p>
          <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-1">
            <p><strong>Ticaret Unvanı:</strong> Tamer Aydın (Şahıs İşletmesi)</p>
            <p><strong>Vergi Kimlik No:</strong> 1151635832</p>
            <p><strong>Vergi Dairesi:</strong> İstiklal Vergi Dairesi Müdürlüğü, Mersin</p>
            <p><strong>Adres:</strong> Akdeniz Mah. 39741 Sk. Akdeniz 7 Sitesi No:1/B İç Kapı No:3, Mezitli/Mersin</p>
            <p><strong>Telefon:</strong> +90 538 032 43 98</p>
            <p><strong>E-posta:</strong> destek@kapbeni.com</p>
            <p><strong>Web:</strong> kapbeni.com</p>
            <p><strong>Faaliyet:</strong> İnternet üzerinden ikinci el ürün alım-satımına aracılık (NACE 479114)</p>
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">2. İşlenen Kişisel Veri Kategorileri</h2>
          <p className="mb-3">Platformumuzu kullandığınızda aşağıdaki kategorilerde kişisel verileriniz işlenebilmektedir:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Kategori</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Örnekler</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Kimlik Bilgisi', 'Ad, soyad'],
                  ['İletişim Bilgisi', 'E-posta adresi, telefon numarası, teslimat adresi'],
                  ['Hesap & İşlem Bilgisi', 'Kullanıcı adı, şifreli hesap kaydı, ilan geçmişi, mesaj geçmişi'],
                  ['Fotoğraf & Görsel', 'İlanlara yüklenen ürün fotoğrafları, profil fotoğrafı'],
                  ['Kimlik Doğrulama (KYC)', 'Kimlik belgesi görseli (yalnızca satıcı doğrulama sürecinde, isteğe bağlı)'],
                  ['Teknik Veri', 'IP adresi, tarayıcı türü, oturum çerezi (sg_token), erişim günlüğü'],
                  ['Konum Bilgisi', 'İlanda belirtilen şehir/ilçe (hassas konum alınmaz)'],
                ].map(([cat, ex]) => (
                  <tr key={cat} className="even:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-medium">{cat}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500">Özel nitelikli kişisel veriler bilinçli olarak toplanmamaktadır. KYC sürecinde sunulan kimlik belgeleri yalnızca doğrulama amacıyla işlenip derhal silinir.</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">3. Kişisel Verilerin Toplanma Yöntemi</h2>
          <p>Verileriniz aşağıdaki kanallar aracılığıyla toplanmaktadır:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
            <li>Kayıt formu ve profil güncelleme ekranları aracılığıyla doğrudan tarafınızdan</li>
            <li>İlan oluşturma ve mesajlaşma süreçlerinde platform içi etkileşimle</li>
            <li>Sunucu günlükleri ve oturum çerezleri aracılığıyla otomatik olarak</li>
            <li>Satıcı doğrulama (KYC) sürecinde yüklenen belgeler aracılığıyla</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">4. İşleme Amaçları ve Hukuki Dayanaklar</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Amaç</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Hukuki Dayanak (KVKK m.5)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Üyelik oluşturma, kimlik doğrulama ve hesap yönetimi', 'Sözleşmenin ifası (m.5/2-c)'],
                  ['İlan yayınlama, güncelleme ve silme', 'Sözleşmenin ifası (m.5/2-c)'],
                  ['Alıcı-satıcı mesajlaşma altyapısının sağlanması', 'Sözleşmenin ifası (m.5/2-c)'],
                  ['Satıcı kimlik doğrulaması (KYC)', 'Açık rıza (m.5/1) + Meşru menfaat (m.5/2-f)'],
                  ['Platform güvenliği ve dolandırıcılık tespiti', 'Meşru menfaat (m.5/2-f)'],
                  ['Vergi kayıtları ve muhasebe yükümlülükleri', 'Kanuni yükümlülük (m.5/2-ç)'],
                  ['İlan moderasyonu ve içerik denetimi', 'Meşru menfaat (m.5/2-f)'],
                ].map(([amac, dayanak]) => (
                  <tr key={amac} className="even:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">{amac}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600 whitespace-nowrap">{dayanak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">5. Kişisel Verilerin Aktarımı</h2>
          <p className="mb-2">Kişisel verileriniz, aşağıdaki sınırlı durumlar dışında üçüncü kişilere aktarılmaz:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li><strong>Altyapı sağlayıcıları:</strong> Sunucu barındırma ve veritabanı hizmetleri için teknik işlemci olarak</li>
            <li><strong>Yasal zorunluluklar:</strong> Mahkeme kararı veya yetkili idari kurum talebi üzerine</li>
            <li><strong>Tüketici şikayeti:</strong> Tüketici Hakem Heyeti veya mahkeme süreçlerinde zorunlu bilgi paylaşımı</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">Verileriniz hiçbir şekilde reklam amacıyla üçüncü taraflara satılmaz veya kiralanmaz.</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">6. Veri Saklama Süreleri</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Veri Türü</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Saklama Süresi</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Hesap bilgileri (ad, e-posta, telefon)', 'Hesap aktif olduğu sürece + hesap silinmesinden itibaren 1 yıl'],
                  ['İlan ve fotoğraf verileri', 'İlan silinmesinden itibaren 3 yıl (ticaret kanunu)'],
                  ['Mesaj geçmişi', 'Mesaj silinmesinden itibaren 2 yıl'],
                  ['Sunucu ve erişim günlükleri', '90 gün'],
                  ['KYC kimlik belgesi görseli', 'Doğrulama tamamlandıktan sonra 30 gün içinde silinir'],
                  ['Fatura/ödeme kayıtları', '10 yıl (Vergi Usul Kanunu m.253)'],
                ].map(([tur, sure]) => (
                  <tr key={tur} className="even:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">{tur}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-600">{sure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">7. İlgili Kişi Hakları (KVKK Madde 11)</h2>
          <p className="mb-3">Kişisel verilerinize ilişkin olarak aşağıdaki haklara sahipsiniz:</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              ['🔍 Bilgi Edinme', 'Kişisel verilerinizin işlenip işlenmediğini öğrenme (m.11/a)'],
              ['✏️ Düzeltme', 'Eksik veya yanlış işlenen verilerin düzeltilmesini isteme (m.11/d)'],
              ['🗑️ Silme / Yok Etme', 'Yasal saklama süreleri dolduğunda verilerin silinmesini isteme (m.11/e)'],
              ['⚖️ Tazminat', 'Kanuna aykırı işleme nedeniyle uğradığınız zararın tazminini talep etme (m.11/ğ)'],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3 bg-gray-50 rounded-lg p-3">
                <span className="font-semibold text-gray-800 whitespace-nowrap text-xs">{title}</span>
                <span className="text-gray-600 text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">8. Başvuru Yöntemi</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2 text-sm">
            <p>📧 <strong>E-posta:</strong> <a href="mailto:destek@kapbeni.com" className="text-[var(--color-primary)] underline">destek@kapbeni.com</a> (konu: KVKK Başvurusu)</p>
            <p>📮 <strong>Posta:</strong> Akdeniz Mah. 39741 Sk. Akdeniz 7 Sitesi No:1/B İç Kapı No:3, Mezitli/Mersin</p>
          </div>
          <p className="mt-3 text-xs text-gray-500">Başvurular kimlik teyidi yapılarak <strong>en geç 30 gün</strong> içinde yanıtlanır (KVKK m.13).</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">9. Veri Güvenliği</h2>
          <p>Kişisel verileriniz TLS/SSL şifrelemeli bağlantılarla iletilmekte, şifreli veritabanında saklanmaktadır. Şifreler kriptografik hash (bcrypt) ile saklanır; düz metin olarak hiçbir sistemde tutulmaz.</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">10. Politika Değişiklikleri</h2>
          <p>Bu politika, yasal düzenlemeler doğrultusunda güncellenebilir. Güncel metin her zaman <strong>kapbeni.com/#/gizlilik-politikasi</strong> adresinde yayımlanır.</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">11. Çerezler</h2>
          <p>Çerez kullanımına ilişkin ayrıntılı bilgi için <a href="/#/cerez-politikasi" className="text-[var(--color-primary)] underline">Çerez Politikası</a> sayfamızı inceleyebilirsiniz.</p>
        </div>
      </section>
    </div>
  )
}
