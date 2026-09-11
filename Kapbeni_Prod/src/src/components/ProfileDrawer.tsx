import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  User, Camera, ShieldCheck, ChevronRight,
  Shield, Smartphone,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileApi } from '../api'

// GLOBAL ICON RULE: Tabler Icons webfont (ti-* classes) on white circles with shadow.
// Never use Lucide for new menu icons.
const MENU_ITEMS = [
  { iconClass: 'ti-layout-dashboard', label: 'Hesabım',                tab: 'hesabim' },
  { iconClass: 'ti-package',        label: 'İlanlarım',                tab: 'ilanlarim' },
  { iconClass: 'ti-shopping-bag',   label: 'Aldıklarım & Sattıklarım', tab: 'islemlerim' },
  { iconClass: 'ti-heart',          label: 'Favorilerim',              tab: 'favoriler' },
  { iconClass: 'ti-message',        label: 'Mesajlarım',               tab: 'mesajlar' },
  { iconClass: 'ti-tag',            label: 'Tekliflerim',              tab: 'tekliflerim' },
  { iconClass: 'ti-star',           label: 'Değerlendirmelerim',       tab: 'degerlendirmeler' },
  { iconClass: 'ti-bookmark',       label: 'Kayıtlı Aramalarım',      tab: 'aramalar' },
  { iconClass: 'ti-shield-check',   label: 'Satıcı Doğrulama',        tab: 'kyc' },
  { iconClass: 'ti-gift',           label: 'Kampanyalar',              tab: 'kampanyalar' },
  { iconClass: 'ti-settings',       label: 'Ayarlar',                  tab: 'ayarlar' },
  { iconClass: 'ti-help-circle',    label: 'Yardım ve Destek',        tab: 'yardim' },
]

interface Props {
  onClose: () => void
  onNavigate: (tab: string) => void
}

export default function ProfileDrawer({ onClose, onNavigate }: Props) {
  const { user, logout, refreshUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  if (!user) return null

  const isKycVerified = user.kyc_durum === 'onaylandi' || user.kyc_durumu === 'onaylandi'
  const isPhoneVerified = user.phone_verified === true
  const allVerified = isKycVerified && isPhoneVerified

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setUploading(true)
    try {
      await profileApi.uploadAvatar(file)
      await refreshUser()
    } catch {
      alert('Fotoğraf yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setUploading(false)
    }
  }

  const displayName =
    user.takma_ad_aktif && user.takma_ad
      ? user.takma_ad
      : [user.ad, user.soyad].filter(Boolean).join(' ') || 'Kullanıcı'

  return createPortal(
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white z-[70] shadow-2xl flex flex-col overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-[var(--color-primary)] text-white px-4 py-6">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/40 overflow-hidden relative group"
                title="Profil fotoğrafını değiştir"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-white" />
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                  <Camera size={16} className="text-white" />
                </span>
              </button>
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              )}
              {isKycVerified && (
                <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow" title="Onaylı Satıcı">
                  <ShieldCheck size={16} className="text-green-600" />
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg leading-tight truncate flex items-center gap-1">
                {displayName}
                {isKycVerified && <ShieldCheck size={16} className="text-white/90 flex-shrink-0" />}
              </p>
              <p className="text-red-200 text-sm truncate">{user.email}</p>
              <button
                onClick={() => { onNavigate('profil'); onClose() }}
                className="mt-1 inline-flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded-full transition-colors"
              >
                <Camera size={11} /> Profili Düzenle
              </button>
              <p className="text-[10px] text-red-200/90 mt-1 flex items-center gap-1">
                <Camera size={10} /> Fotoğraf eklemek için resme dokunun
              </p>
            </div>
          </div>

          {/* Follower counts */}
          <div className="flex gap-4 mt-4 text-sm">
            <span><strong>{(user as any).takip_sayisi ?? 0}</strong> Takip</span>
            <span><strong>{(user as any).takipci_sayisi ?? 0}</strong> Takipçi</span>
          </div>
        </div>

        {/* Verification status */}
        {allVerified ? (
          <div className="mx-3 my-2 p-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <ShieldCheck size={18} className="text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium text-green-800">Onaylı Satıcı</p>
          </div>
        ) : (
          <div className="mx-3 my-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-800 flex-1">Satıcı Doğrulama</p>
            </div>

            {/* KYC row */}
            <button
              onClick={() => { if (!isKycVerified) { onNavigate('kyc'); onClose() } }}
              disabled={isKycVerified}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${isKycVerified ? 'cursor-default' : 'hover:bg-amber-100'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isKycVerified ? 'bg-green-500' : 'border-2 border-amber-300'}`}>
                {isKycVerified && <ShieldCheck size={12} className="text-white" />}
              </span>
              <span className="flex-1 text-xs">
                <span className={`font-medium ${isKycVerified ? 'text-green-700' : 'text-amber-800'}`}>Kimlik Doğrulama</span>
                <span className={`block ${isKycVerified ? 'text-green-600' : 'text-amber-600'}`}>
                  {isKycVerified ? 'Tamamlandı' : 'Doğrulama gerekli'}
                </span>
              </span>
              {!isKycVerified && <ChevronRight size={14} className="text-amber-400" />}
            </button>

            {/* GSM row */}
            <button
              onClick={() => { if (!isPhoneVerified) { onNavigate('gsm'); onClose() } }}
              disabled={isPhoneVerified}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${isPhoneVerified ? 'cursor-default' : 'hover:bg-amber-100'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isPhoneVerified ? 'bg-green-500' : 'border-2 border-amber-300'}`}>
                {isPhoneVerified
                  ? <ShieldCheck size={12} className="text-white" />
                  : <Smartphone size={11} className="text-amber-400" />}
              </span>
              <span className="flex-1 text-xs">
                <span className={`font-medium ${isPhoneVerified ? 'text-green-700' : 'text-amber-800'}`}>GSM Doğrulama</span>
                <span className={`block ${isPhoneVerified ? 'text-green-600' : 'text-amber-600'}`}>
                  {isPhoneVerified ? 'Tamamlandı' : 'Telefon doğrulaması eksik'}
                </span>
              </span>
              {!isPhoneVerified && <ChevronRight size={14} className="text-amber-400" />}
            </button>
          </div>
        )}

        {/* Navigation menu */}
        <nav className="flex-1 py-1">
          {[...MENU_ITEMS, ...(((user as any)?.rol === 'admin' || (user as any)?.is_admin) ? [{ iconClass: 'ti-shield', label: 'Admin Paneli', tab: 'admin' }] : [])].map(({ iconClass, label, tab }) => (
            <button
              key={tab}
              onClick={() => { onNavigate(tab); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0 group"
            >
              {/* Tabler Icon on white circle with shadow */}
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '2px 3px 10px rgba(26,46,74,.14), 0 1px 3px rgba(0,0,0,.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                className="group-hover:[box-shadow:2px_3px_14px_rgba(229,57,53,.18)]"
              >
                <i
                  className={`ti ${iconClass}`}
                  style={{ fontSize: 17, color: '#1a2e4a' }}
                  aria-hidden="true"
                />
              </span>
              <span className="flex-1 text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-6 border-t border-gray-100 pt-2">
          <button
            onClick={() => { logout(); onClose() }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors text-left"
          >
            <span
              style={{
                width: 36, height: 36, borderRadius: '50%', background: '#fff',
                boxShadow: '2px 3px 10px rgba(229,57,53,.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <i className="ti ti-logout" style={{ fontSize: 17, color: '#dc2626' }} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-red-600">Çıkış Yap</span>
          </button>
        </div>
      </motion.div>
    </>,
    document.body,
  )
}
