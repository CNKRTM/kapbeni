import { useState, useEffect } from 'react'
import { Package, PenLine, ShieldCheck, ShieldAlert, Smartphone, Check, LogOut, Trash2 } from 'lucide-react'
import { ilanlarApi, Listing } from '../api'
import { useAuth } from '../context/AuthContext'
import ProductCard from '../components/ProductCard'
import OnayModal from '../components/OnayModal'

interface Props {
  onOpenKyc: () => void
  onOpenGsm: () => void
  onEditProfile: () => void
  onSelectProduct: (listing: Listing) => void
}

export default function Profile({ onOpenKyc, onOpenGsm, onEditProfile, onSelectProduct }: Props) {
  const { user, logout } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await ilanlarApi.getMine()
        const arr = ((data && data.ilanlar) || []).filter((l: any) => l.ilan_durum !== 'pasif')
        const condMap: Record<string, string> = {
          sifir: 'Sıfır Ayarında',
          az_kullanilmis: 'Az Kullanılmış',
          ikinci_el: 'İkinci El',
        }
        setListings(
          arr.map((l: any) => ({
            id: l.uuid,
            title: l.baslik,
            price: Number(l.fiyat) || 0,
            category: l.kategori_ad || '', categorySlug: l.kategori_slug || '',
            location: [l.ilce, l.sehir].filter(Boolean).join(', '),
            date: 'Yeni',
            image: l.ana_foto || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
            description: l.aciklama || '',
            sellerName: user?.ad || 'Siz',
            sellerPhone: '',
            isFavorite: false,
            condition: condMap[l.durum] || 'İkinci El',
          }))
        )
      } catch {
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Welches Inserat gerade zum Loeschen ansteht — gesetzt heisst: Modal offen.
  const [loeschZiel, setLoeschZiel] = useState<string | null>(null)
  const [loescht, setLoescht] = useState(false)

  const deleteListing = async (id: string) => {
    setLoescht(true)
    try {
      await ilanlarApi.delete(id)
      setListings((prev) => prev.filter((l) => l.id !== id))
      setLoeschZiel(null)
    } catch (err: any) {
      setLoeschZiel(null)
      // Der Grund kommt jetzt aus dem Feld `hata` der API durch, statt immer
      // dieselbe nichtssagende Zeile zu zeigen.
      alert(err?.message === 'Unauthorized'
        ? 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.'
        : (err?.message || 'İlan silinemedi. Lütfen tekrar deneyin.'))
    } finally {
      setLoescht(false)
    }
  }

  const isKycVerified = user?.kyc_durum === 'onaylandi' || user?.kyc_durumu === 'onaylandi'
  const isPhoneVerified = user?.phone_verified === true
  const displayName =
    user?.takma_ad_aktif && user?.takma_ad
      ? user.takma_ad
      : [user?.ad, user?.soyad].filter(Boolean).join(' ') || 'Kullanıcı'

  return (
    <div className="py-6 space-y-6">
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/5 text-primary font-extrabold text-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : user?.ad?.[0] || '?'}
        </div>
        <div className="flex-grow min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate flex items-center gap-1.5">
            {displayName}
            {isKycVerified && <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />}
          </h2>
          {user?.takma_ad_aktif && user?.takma_ad && (user?.ad || user?.soyad) && (
            <p className="text-xs text-gray-400 truncate">Takma ad görünüyor</p>
          )}
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          <button
            onClick={onEditProfile}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <PenLine className="h-3.5 w-3.5" /> Profili Düzenle
          </button>
        </div>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-primary flex flex-col items-center text-[10px] font-semibold flex-shrink-0"
        >
          <LogOut className="h-5 w-5 mb-0.5" />
          Çıkış
        </button>
      </div>

      {/* Verification status */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5">
          {isKycVerified ? (
            <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-amber-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-800">Kimlik (Fotoğraf) Doğrulama</p>
            <p className={`text-xs ${isKycVerified ? 'text-green-600' : 'text-amber-600'}`}>
              {isKycVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
            </p>
          </div>
          {isKycVerified ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <button onClick={onOpenKyc} className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Doğrula
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          {isPhoneVerified ? (
            <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
          ) : (
            <Smartphone className="h-6 w-6 text-amber-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-800">GSM (Telefon) Doğrulama</p>
            <p className={`text-xs ${isPhoneVerified ? 'text-green-600' : 'text-amber-600'}`}>
              {isPhoneVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
            </p>
          </div>
          {isPhoneVerified ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <button onClick={onOpenGsm} className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Doğrula
            </button>
          )}
        </div>
      </div>

      {/* My listings */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-5 w-5 text-gray-700" />
          <h3 className="font-bold text-gray-900">
            İlanlarım <span className="text-gray-400 font-semibold">({listings.length})</span>
          </h3>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Yükleniyor...</p>
        ) : listings.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <div key={listing.id} className="relative">
                <ProductCard
                  listing={listing}
                  isGridView={true}
                  onSelect={() => onSelectProduct(listing)}
                  onToggleFavorite={() => {}}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setLoeschZiel(listing.id) }}
                  className="absolute top-2 right-2 z-10 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-2 py-1 transition-colors bg-white shadow-sm"
                >
                  <Trash2 size={12} /> Sil
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 text-sm text-gray-500">
            Henüz ilanınız yok. "+" ile ilk ilanınızı verin!
          </div>
        )}
      </div>

      <OnayModal
        offen={loeschZiel != null}
        titel="İlanı sil"
        text="Bu ilan kalıcı olarak silinecek. Fotoğrafları ve videosu da kaldırılacak. Emin misiniz?"
        bestaetigen="Evet, sil"
        gefaehrlich
        icon="trash"
        laeuft={loescht}
        onBestaetigen={() => loeschZiel && deleteListing(loeschZiel)}
        onAbbrechen={() => setLoeschZiel(null)}
      />
    </div>
  )
}
