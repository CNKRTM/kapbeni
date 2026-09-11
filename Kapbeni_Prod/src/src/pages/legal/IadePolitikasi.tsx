// IadePolitikasi.tsx — 1:1 rekonstruiert aus dem Live-Bundle (Zw-Komponente)
import { ArrowLeft } from 'lucide-react'

export default function IadePolitikasi({ onBack }: { onBack?: () => void }) {
  return (
    <div className="py-8 max-w-3xl mx-auto" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-primary font-bold transition-colors cursor-pointer group mb-8"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          Geri Dön
        </button>
      )}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm prose prose-gray max-w-none">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#111827', marginBottom: 4 }}>İade ve Geri Ödeme Politikası</h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 32 }}>Son güncelleme: Ocak 2026 | Geçerlilik: kapbeni.com</p>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>1. Genel Bilgi</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            kapbeni.com, bireysel kullanıcılar ve kurumsal satıcılar arasında ikinci el ürünlerin alınıp satıldığı bir pazar yeri platformudur. Platform, yalnızca alıcı ile satıcı arasında iletişim ortamı sağlar; ürünlerin satışından, tesliminden veya kalitesinden doğrudan sorumlu değildir. Bununla birlikte kullanıcılarımızın haklarını korumak adına aşağıdaki politikayı benimsemekteyiz.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>2. Bireysel Satıcılardan Yapılan Alışverişler</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            Bireysel satıcılar (<strong>şahıslar</strong>) tarafından gerçekleştirilen satışlar, Türk Borçlar Kanunu kapsamındaki adi satış niteliğinde olup 6502 sayılı Tüketicinin Korunması Hakkında Kanun'un mesafeli satış hükümleri bu tür işlemlere uygulanmaz. Dolayısıyla bireysel satıcılara yönelik yasal cayma hakkı bulunmamaktadır.
          </p>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginTop: 10 }}>
            Buna karşın kapbeni.com olarak kullanıcılarımızı şu tavsiyelere uymaya davet ediyoruz:
          </p>
          <ul style={{ fontSize: 14, color: '#374151', lineHeight: 2, paddingLeft: 20 }}>
            <li>Ürünü almadan önce <strong>yüz yüze görüşerek</strong> deneyiniz ve kontrol ediniz.</li>
            <li>İlan açıklamasını ve fotoğrafları dikkatlice inceleyiniz.</li>
            <li>Satıcıyla anlaşmazlık durumunda önce platformumuzun mesajlaşma sistemi üzerinden çözüm arayınız.</li>
            <li>Dolandırıcılık şüphesi hâlinde derhal <a href="mailto:destek@kapbeni.com" style={{ color: '#e53935' }}>destek@kapbeni.com</a> adresine bildiriniz.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>3. Kurumsal Satıcılardan Yapılan Alışverişler</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            kapbeni.com'da faaliyet gösteren <strong>kurumsal satıcılar</strong> (ticari işletmeler), 6502 sayılı TKHK ve Mesafeli Sözleşmeler Yönetmeliği kapsamında tüketicilere yasal <strong>14 günlük cayma hakkı</strong> tanımakla yükümlüdür.
          </p>
          <ul style={{ fontSize: 14, color: '#374151', lineHeight: 2, paddingLeft: 20 }}>
            <li>Cayma hakkı, ürünün teslim alındığı tarihten itibaren <strong>14 takvim günü</strong> içinde kullanılabilir.</li>
            <li>Cayma bildirimini, satıcının iletişim bilgilerini kullanarak yazılı olarak ya da e-posta yoluyla iletmeniz yeterlidir.</li>
            <li>İade kargo masrafları, ürün ayıplı değilse alıcıya aittir; aksi satıcı tarafından açıkça belirtilmişse satıcı üstlenir.</li>
            <li>Satıcı, cayma bildiriminin ulaşmasından itibaren <strong>14 gün içinde</strong> ödemeyi iade etmekle yükümlüdür.</li>
          </ul>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginTop: 10 }}>
            Doğası gereği iade edilemeyecek ürünler (ör. mühürsüz açılmış hijyen ürünleri, kişiye özel üretilmiş eşyalar vb.) yasal istisnalar kapsamındadır.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>4. Ayıplı Mal</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            Teslim edilen ürün, ilanda belirtilen özelliklere uymuyorsa ya da ayıplı çıkarsa alıcı, kurumsal satıcıya karşı TKHK m.11 uyarınca şu haklara sahiptir:
          </p>
          <ul style={{ fontSize: 14, color: '#374151', lineHeight: 2, paddingLeft: 20 }}>
            <li>Sözleşmeden dönme (tam iade)</li>
            <li>Ürünün yenisiyle değiştirilmesini talep etme</li>
            <li>Orantılı bedel indirimi talep etme</li>
            <li>Ücretsiz onarım talep etme</li>
          </ul>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginTop: 10 }}>
            Ayıplı mal bildirimi için ürünü teslim aldığınız tarihten itibaren <strong>30 gün</strong> içinde satıcıya ve platformumuza bildirim yapmanızı öneririz.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>5. Abonelik ve Platform Ödemeleri</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            kapbeni.com platformuna ödenen abonelik ücretleri (ör. Öne Çıkan İlan, Süper İlan, video yükleme ücreti 50 TL/video vb.) aşağıdaki koşullarda iade edilebilir:
          </p>
          <ul style={{ fontSize: 14, color: '#374151', lineHeight: 2, paddingLeft: 20 }}>
            <li>Satın alım yapıldıktan sonra ilgili hizmet henüz başlatılmamışsa ve talep <strong>24 saat içinde</strong> iletilmişse.</li>
            <li>Teknik bir hata nedeniyle hizmet hiç verilememişse.</li>
            <li>Hizmet başladıktan sonra yapılan iade talepleri değerlendirmeye alınmaz.</li>
          </ul>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginTop: 10 }}>
            İade taleplerini <a href="mailto:destek@kapbeni.com" style={{ color: '#e53935' }}>destek@kapbeni.com</a> adresine, ödeme bilgilerinizi ve talebinizin gerekçesini içeren bir e-posta ile iletebilirsiniz.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>6. Kişisel Verilerin Korunması (KVKK)</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            İade ve şikayet süreçlerinde toplanan ad, iletişim bilgisi ve işlem kaydı gibi kişisel veriler, yalnızca ilgili talebin çözümü amacıyla işlenir ve 6698 sayılı KVKK kapsamında korunur. Veriler, hizmetin gereği dışında üçüncü kişilerle paylaşılmaz. Ayrıntılı bilgi için <a href="/#/gizlilik-politikasi" style={{ color: '#e53935' }}>Gizlilik Politikamızı</a> inceleyebilirsiniz.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>7. Anlaşmazlık Çözümü</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
            Öncelikle platformumuzun <strong>Destek Merkezi</strong> üzerinden çözüm aramanızı öneririz. Tüketici uyuşmazlıklarında Mersin İl Tüketici Hakem Heyeti veya Tüketici Mahkemeleri yetkilidir. Ayrıca <a href="https://tuketicisikayetleri.gov.tr" target="_blank" rel="noopener noreferrer" style={{ color: '#e53935' }}>tuketicisikayetleri.gov.tr</a> üzerinden şikayet başvurusunda bulunabilirsiniz.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>8. İletişim</h2>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>Bu politikayla ilgili sorularınız için:</p>
          <address style={{ fontStyle: 'normal', fontSize: 14, color: '#374151', lineHeight: 2, marginTop: 8 }}>
            <strong>Tamer Aydın</strong> – Şahıs İşletmesi<br />
            Akdeniz Mah. 39741 Sk. Akdeniz 7 Sitesi No:1/B İç Kapı No:3, Mezitli / Mersin<br />
            VKN: 1151635832 | İstiklal Vergi Dairesi Müdürlüğü<br />
            <a href="mailto:destek@kapbeni.com" style={{ color: '#e53935' }}>destek@kapbeni.com</a> | <a href="tel:+905380324398" style={{ color: '#e53935' }}>+90 538 032 43 98</a>
          </address>
        </section>
      </div>
    </div>
  )
}
