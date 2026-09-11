import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { X, Gift, Check, Tag, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ve } from '../api'

interface Props {
  onClose: () => void
}

export default function PackagesModal({ onClose }: Props) {
  const { isLoggedIn } = useAuth()
  const [packages, setPackages] = useState<any[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<any>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [buying, setBuying] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isLoggedIn) {
      ve.get('/abonelik/paketler')
        .then((d: any) => setPackages(Array.isArray(d) ? d : []))
        .catch(() => {})
    }
  }, [isLoggedIn])

  const checkCoupon = async () => {
    if (!couponCode.trim()) return
    setCheckingCoupon(true)
    try {
      const res: any = await ve.get(`/abonelik/kupon-kontrol?kod=${encodeURIComponent(couponCode.trim())}`)
      setCoupon(
        res?.gecerli
          ? res
          : { gecerli: false, mesaj: res?.mesaj || 'Geçersiz veya süresi dolmuş kupon.' }
      )
    } catch {
      setCoupon({ gecerli: false, mesaj: 'Bir hata oluştu.' })
    } finally {
      setCheckingCoupon(false)
    }
  }

  const calcPrice = (pkg: any) => {
    if (!coupon?.gecerli || coupon.indirim_degeri == null) return pkg.fiyat
    if (coupon.indirim_tipi === 'yuzde') return Math.round(pkg.fiyat * (1 - coupon.indirim_degeri / 100))
    return Math.max(0, pkg.fiyat - coupon.indirim_degeri)
  }

  const purchase = async () => {
    if (!selected) return
    setBuying(true)
    try {
      await ve.post('/abonelik/satin-al', {
        paket_id: selected.id,
        kupon_kodu: coupon?.gecerli ? couponCode.trim() : undefined,
      })
      setSuccess(true)
    } catch {
    } finally {
      setBuying(false)
    }
  }

  const bireysel = packages.filter((p) => p.hesap_tipi === 'bireysel')
  const kurumsal = packages.filter((p) => p.hesap_tipi === 'kurumsal')

  const PackageCard = (pkg: any) => {
    const isSelected = selected?.id === pkg.id
    return (
      <button
        key={pkg.id}
        onClick={() => setSelected(pkg)}
        className={`text-left p-4 rounded-2xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="font-bold text-gray-900">{pkg.isim}</p>
          {isSelected && <Check className="w-5 h-5 text-primary" />}
        </div>
        <p className="text-primary font-bold text-lg">
          {calcPrice(pkg)}₺{' '}
          {coupon?.gecerli && (
            <span className="text-gray-400 text-sm font-normal line-through">{pkg.fiyat}₺</span>
          )}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {pkg.ilan_hakki} ilan hakkı · {pkg.sure_gun} gün
        </p>
      </button>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900">Paketler & Abonelikler</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {!isLoggedIn ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">Giriş yapın</h3>
              <p className="text-sm text-gray-500">Paket satın almak için lütfen önce giriş yapın.</p>
            </div>
          ) : success ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">Satın Alma Başarılı!</h3>
              <p className="text-sm text-gray-600 mb-2">Paketiniz hesabınıza tanımlanmıştır.</p>
              <p className="text-xs text-gray-400 mb-5">Ödeme entegrasyonu yakında (Param).</p>
              <button
                onClick={onClose}
                className="bg-primary hover:bg-primary/95 text-white px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all"
              >
                Kapat
              </button>
            </div>
          ) : (
            <>
              {/* Promo banner */}
              <div className="bg-gradient-to-r from-primary to-rose-500 rounded-2xl p-4 text-white flex items-center gap-3">
                <Gift className="w-7 h-7 flex-shrink-0" />
                <div>
                  <p className="font-bold">İlk 3 Ay Ücretsiz! 🎉</p>
                  <p className="text-xs text-red-100">Yeni üyeler için geçerli. Kredi kartı gerekmez.</p>
                </div>
              </div>

              {/* Bireysel packages */}
              {bireysel.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Bireysel</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {bireysel.map(PackageCard)}
                  </div>
                </div>
              )}

              {/* Kurumsal packages */}
              {kurumsal.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Kurumsal</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {kurumsal.map(PackageCard)}
                  </div>
                </div>
              )}

              {/* Coupon */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Tag className="w-4 h-4" /> Kupon Kodu
                </p>
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCoupon(null) }}
                    placeholder="KUPON10"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
                  />
                  <button
                    onClick={checkCoupon}
                    disabled={checkingCoupon || !couponCode.trim()}
                    className="bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {checkingCoupon ? '...' : 'Uygula'}
                  </button>
                </div>
                {coupon && (
                  <p className={`text-xs mt-1.5 ${coupon.gecerli ? 'text-green-600' : 'text-red-500'}`}>
                    {coupon.gecerli
                      ? `✓ ${coupon.indirim_tipi === 'yuzde' ? `%${coupon.indirim_degeri}` : `${coupon.indirim_degeri}₺`} indirim uygulandı`
                      : `✗ ${coupon.mesaj}`}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {isLoggedIn && !success && (
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={purchase}
              disabled={!selected || buying}
              className="w-full bg-primary hover:bg-primary/95 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
            >
              {buying ? 'İşleniyor...' : selected ? `${calcPrice(selected)}₺ – Satın Al` : 'Paket Seçin'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">Fiyatlara KDV dahildir.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
