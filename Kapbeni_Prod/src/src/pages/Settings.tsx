import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  User, MapPin, CreditCard, Lock, Bell, Mail, ShieldCheck,
  AlertTriangle, ChevronRight, ArrowLeft, Check, PenLine, Trash2,
  Building2, Info, LogOut, Plus, ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ve } from '../api'
import { CITIES } from '../data/cities'

interface Props {
  onBack?: () => void
}

const INPUT_CLS =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all'
const LABEL_CLS = 'block text-xs font-bold text-gray-700 mb-1.5'

function normalizePhone(n: string) {
  let s = (n || '').replace(/\D/g, '')
  if (s.startsWith('90') && s.length >= 12) s = s.slice(2)
  if (s.length === 10 && s.startsWith('5')) s = '0' + s
  if (s.length > 11) s = s.slice(0, 11)
  return s
}

async function saveSettings(data: Record<string, any>) {
  const token = localStorage.getItem('sg_token') || ''
  const res = await fetch('/api/ayarlar', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('patch failed')
  return res.json().catch(() => null)
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-primary' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}

const DEFAULT_PROFILE = {
  ad: '', soyad: '', phone: '', hakkinda: '', sehir: '', ilce: '',
  hesap_tipi: 'bireysel', firma_adi: '', vkn: '', mersis_no: '',
  ticari_adres: '', yetkili_kisi: '', sektor: '', takma_ad: '',
  takma_ad_aktif: false,
}

const DEFAULT_NOTIFS = {
  bildirim_mesaj: true, bildirim_teklif: true, bildirim_ilan: true,
  bildirim_email: true, bildirim_sms: false,
}

export default function Settings({ onBack }: Props) {
  const { user, refreshUser, logout } = useAuth()
  const [section, setSection] = useState<string | null>(null)
  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE })
  const [notifs, setNotifs] = useState({ ...DEFAULT_NOTIFS })
  const [addresses, setAddresses] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [editAddress, setEditAddress] = useState<any>(null)
  const [savingAddress, setSavingAddress] = useState(false)

  const applyUser = (u: any) => {
    if (!u) return
    setProfile({
      ad: u.ad || '',
      soyad: u.soyad || '',
      phone: normalizePhone(u.phone || ''),
      hakkinda: u.hakkinda || '',
      sehir: u.sehir || '',
      ilce: u.ilce || '',
      hesap_tipi: u.hesap_tipi || 'bireysel',
      firma_adi: u.firma_adi || '',
      vkn: u.vkn || '',
      mersis_no: u.mersis_no || '',
      ticari_adres: u.ticari_adres || '',
      yetkili_kisi: u.yetkili_kisi || '',
      sektor: u.sektor || '',
      takma_ad: u.takma_ad || '',
      takma_ad_aktif: u.takma_ad_aktif === true,
    })
    setNotifs({
      bildirim_mesaj: u.bildirim_mesaj ?? true,
      bildirim_teklif: u.bildirim_teklif ?? true,
      bildirim_ilan: u.bildirim_ilan ?? true,
      bildirim_email: u.bildirim_email ?? true,
      bildirim_sms: u.bildirim_sms ?? false,
    })
  }

  useEffect(() => {
    if (user) applyUser(user)
    ;(async () => {
      try {
        const data = await ve.get('/ayarlar')
        if (data) applyUser(data)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (section === 'adresler') loadAddresses()
  }, [section])

  const loadAddresses = async () => {
    try {
      const data: any = await ve.get('/adresler')
      setAddresses(Array.isArray(data) ? data : data?.adresler || [])
    } catch {}
  }

  const validatePhone = (val: string) => {
    const normalized = normalizePhone(val)
    if (!normalized) { setPhoneError(''); return true }
    if (/^05\d{9}$/.test(normalized)) { setPhoneError(''); return true }
    setPhoneError('Geçerli GSM: 05XX XXX XX XX'); return false
  }

  const handleSaveProfile = async () => {
    if (profile.phone && !validatePhone(profile.phone)) return
    setSaving(true)
    try {
      const data: Record<string, any> = {
        ad: profile.ad.trim(),
        soyad: profile.soyad.trim(),
        phone: normalizePhone(profile.phone),
        hakkinda: profile.hakkinda.trim(),
        sehir: profile.sehir,
        ilce: profile.ilce,
        hesap_tipi: profile.hesap_tipi,
        takma_ad: profile.takma_ad.trim(),
        takma_ad_aktif: profile.takma_ad_aktif,
      }
      if (profile.hesap_tipi === 'kurumsal') {
        data.firma_adi = profile.firma_adi.trim()
        data.vkn = profile.vkn.trim()
        data.mersis_no = profile.mersis_no.trim()
        data.ticari_adres = profile.ticari_adres.trim()
        data.yetkili_kisi = profile.yetkili_kisi.trim()
        data.sektor = profile.sektor.trim()
      }
      await saveSettings(data)
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleToggleNotif = async (updated: typeof notifs) => {
    setNotifs(updated)
    try {
      await saveSettings(updated)
      await refreshUser()
    } catch {}
  }

  const handleSaveAddress = async () => {
    if (!editAddress) return
    setSavingAddress(true)
    try {
      const payload = {
        baslik: editAddress.baslik || '',
        ad_soyad: editAddress.ad_soyad || '',
        telefon: normalizePhone(editAddress.telefon || ''),
        il: editAddress.il || '',
        ilce: editAddress.ilce || '',
        adres_satiri: editAddress.adres_satiri || '',
        tip: editAddress.tip || 'teslimat',
      }
      if (editAddress.id != null) {
        await ve.put(`/adresler/${editAddress.id}`, payload)
      } else {
        await ve.post('/adresler', payload)
      }
      setEditAddress(null)
      await loadAddresses()
    } catch {
    } finally {
      setSavingAddress(false)
    }
  }

  const handleDeleteAddress = async (id: any) => {
    try {
      await ve.del(`/adresler/${id}`)
      await loadAddresses()
    } catch {}
  }

  const handleDeleteAccount = async () => {
    try { await ve.del('/hesap/sil') } catch {}
    setShowDeleteDialog(false)
    logout()
  }

  const handleLogoutAll = async () => {
    try { await ve.post('/auth/cikis-tumcihaz') } catch {}
    setShowLogoutDialog(false)
    logout()
  }

  const patchProfile = (patch: Partial<typeof profile>) =>
    setProfile((p) => ({ ...p, ...patch }))

  const NAV_ITEMS = [
    { key: 'profil', icon: User, label: 'Profil Ayarları', desc: 'Ad, soyad, GSM, bio' },
    { key: 'adresler', icon: MapPin, label: 'Teslimat & Fatura Adreslerim', desc: 'Kayıtlı adresleriniz' },
    { key: 'kartlar', icon: CreditCard, label: 'Kayıtlı Kartlarım', desc: 'Ödeme yöntemleri' },
    { key: 'gizlilik', icon: Lock, label: 'Gizlilik', desc: 'Şifre, profil görünürlüğü' },
    { key: 'bildirimler', icon: Bell, label: 'Bildirimler', desc: 'Mesaj, teklif, ilan bildirimleri' },
    { key: 'iletisim', icon: Mail, label: 'İletişim Tercihleri', desc: 'E-posta, SMS tercihleri' },
    { key: 'sohbet', icon: ShieldCheck, label: 'Sohbet Güvenliği İpuçları', desc: 'Güvenli alışveriş rehberi' },
    { key: 'hesap', icon: AlertTriangle, label: 'Hesap İşlemleri', desc: 'Çıkış, hesap silme' },
  ]

  const currentLabel = section
    ? NAV_ITEMS.find((n) => n.key === section)?.label
    : 'Ayarlar'

  const renderSection = () => {
    switch (section) {
      case 'profil':
        return (
          <div className="space-y-5">
            {/* Hesap türü */}
            <div>
              <label className={LABEL_CLS}>Hesap Türü</label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {(['bireysel', 'kurumsal'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patchProfile({ hesap_tipi: t })}
                    className={`flex-1 py-2.5 text-sm font-bold transition-colors ${profile.hesap_tipi === t ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t === 'bireysel' ? 'Bireysel' : 'Kurumsal'}
                  </button>
                ))}
              </div>
            </div>

            {/* Ad / Soyad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Ad</label>
                <input value={profile.ad} onChange={(e) => patchProfile({ ad: e.target.value })} maxLength={100} className={INPUT_CLS} placeholder="Adınız" />
              </div>
              <div>
                <label className={LABEL_CLS}>Soyad</label>
                <input value={profile.soyad} onChange={(e) => patchProfile({ soyad: e.target.value })} maxLength={100} className={INPUT_CLS} placeholder="Soyadınız" />
              </div>
            </div>

            {/* İl / İlçe */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>İl</label>
                <div className="relative">
                  <select
                    value={profile.sehir}
                    onChange={(e) => patchProfile({ sehir: e.target.value, ilce: '' })}
                    className={INPUT_CLS + ' appearance-none pr-9'}
                  >
                    <option value="">İl Seçin</option>
                    {Object.keys(CITIES).sort((a, b) => a.localeCompare(b, 'tr')).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>İlçe</label>
                <div className="relative">
                  <select
                    value={profile.ilce}
                    onChange={(e) => patchProfile({ ilce: e.target.value })}
                    disabled={!profile.sehir}
                    className={INPUT_CLS + ' appearance-none pr-9 disabled:opacity-50'}
                  >
                    <option value="">İlçe Seçin</option>
                    {profile.sehir && CITIES[profile.sehir]?.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* GSM */}
            <div>
              <label className={LABEL_CLS}>GSM Numarası</label>
              <input
                type="tel"
                inputMode="numeric"
                value={profile.phone}
                onChange={(e) => {
                  patchProfile({ phone: e.target.value.replace(/\D/g, '').slice(0, 11) })
                  validatePhone(e.target.value)
                }}
                onBlur={() => patchProfile({ phone: normalizePhone(profile.phone) })}
                maxLength={11}
                className={INPUT_CLS + (phoneError ? ' border-red-300 focus:border-red-400 focus:ring-red-200' : '')}
                placeholder="05XX XXX XX XX"
              />
              {phoneError
                ? <p className="text-red-500 text-xs mt-1">{phoneError}</p>
                : <p className="text-[11px] text-gray-400 mt-1">Başında 0 ile veya 0 olmadan girebilirsiniz; her durumda <strong>05XXXXXXXXX</strong> olarak kaydedilir.</p>
              }
            </div>

            {/* Hakkında */}
            <div>
              <label className={LABEL_CLS}>Hakkında <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
              <textarea
                rows={3}
                value={profile.hakkinda}
                onChange={(e) => patchProfile({ hakkinda: e.target.value.slice(0, 200) })}
                maxLength={200}
                className={INPUT_CLS + ' resize-none'}
                placeholder="Kendinizden kısaca bahsedin..."
              />
              <p className="text-[11px] text-gray-400 mt-1 text-right">{profile.hakkinda.length}/200</p>
            </div>

            {/* Takma ad */}
            <div>
              <label className={LABEL_CLS}>Takma Ad (Nickname)</label>
              <input value={profile.takma_ad} onChange={(e) => patchProfile({ takma_ad: e.target.value })} maxLength={60} className={INPUT_CLS} placeholder="Örn: burako_34" />
              <label className="flex items-start gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={profile.takma_ad_aktif}
                  onChange={(e) => patchProfile({ takma_ad_aktif: e.target.checked })}
                  className="mt-0.5 accent-[var(--color-primary)] w-4 h-4"
                />
                <span className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-800">Takma adım herkese görünsün</span>
                  {' '}— İlanlarınızda ve profilinizde gerçek ad-soyad yerine takma adınız gösterilir.
                </span>
              </label>
            </div>

            {/* Kurumsal fields */}
            {profile.hesap_tipi === 'kurumsal' && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" /> Firma Bilgileri
                </p>
                {[
                  { key: 'firma_adi', label: 'Firma Adı', placeholder: 'Örn: ABC Ticaret Ltd. Şti.' },
                  { key: 'vkn', label: 'Vergi Kimlik No (VKN)', placeholder: '10 haneli VKN' },
                  { key: 'mersis_no', label: 'MERSİS No', placeholder: 'MERSİS numaranız' },
                  { key: 'ticari_adres', label: 'Ticari Adres', placeholder: 'Tescilli adresiniz' },
                  { key: 'yetkili_kisi', label: 'Yetkili Kişi', placeholder: 'Ad Soyad' },
                  { key: 'sektor', label: 'Sektör', placeholder: 'Örn: Elektronik, Tekstil...' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className={LABEL_CLS}>{field.label}</label>
                    <input
                      value={(profile as any)[field.key]}
                      onChange={(e) => patchProfile({ [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className={INPUT_CLS}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/95 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              {saved ? (
                <><Check className="w-4 h-4" /> Kaydedildi</>
              ) : saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        )

      case 'adresler':
        return (
          <div className="space-y-3">
            {addresses.length === 0 && !editAddress && (
              <p className="text-sm text-gray-500 text-center py-6">Henüz kayıtlı adresiniz yok.</p>
            )}

            {!editAddress && addresses.map((addr, idx) => (
              <div key={addr.id ?? idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex gap-3">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-gray-900 truncate">{addr.baslik || 'Adres'}</p>
                    {addr.tip && (
                      <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        {addr.tip === 'fatura' ? 'Fatura' : 'Teslimat'}
                      </span>
                    )}
                  </div>
                  {addr.ad_soyad && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {addr.ad_soyad}{addr.telefon ? ` · ${addr.telefon}` : ''}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {[addr.adres_satiri, addr.ilce, addr.il].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => setEditAddress(addr)} className="text-gray-400 hover:text-primary p-1" aria-label="Düzenle">
                    <PenLine className="w-4 h-4" />
                  </button>
                  {addr.id != null && (
                    <button onClick={() => handleDeleteAddress(addr.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Sil">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {editAddress && (
              <div className="space-y-3 border border-gray-100 rounded-2xl p-4 bg-white">
                <p className="text-sm font-bold text-gray-800">
                  {editAddress.id != null ? 'Adresi Düzenle' : 'Yeni Adres'}
                </p>
                <div>
                  <label className={LABEL_CLS}>Adres Başlığı</label>
                  <input value={editAddress.baslik || ''} onChange={(e) => setEditAddress({ ...editAddress, baslik: e.target.value })} className={INPUT_CLS} placeholder="Örn: Ev, İş" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Ad Soyad</label>
                  <input value={editAddress.ad_soyad || ''} onChange={(e) => setEditAddress({ ...editAddress, ad_soyad: e.target.value })} className={INPUT_CLS} placeholder="Alıcı ad soyad" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Telefon</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={editAddress.telefon || ''}
                    onChange={(e) => setEditAddress({ ...editAddress, telefon: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    maxLength={11}
                    className={INPUT_CLS}
                    placeholder="05XX XXX XX XX"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>İl</label>
                    <div className="relative">
                      <select
                        value={editAddress.il || ''}
                        onChange={(e) => setEditAddress({ ...editAddress, il: e.target.value, ilce: '' })}
                        className={INPUT_CLS + ' appearance-none pr-9'}
                      >
                        <option value="">İl Seçin</option>
                        {Object.keys(CITIES).sort((a, b) => a.localeCompare(b, 'tr')).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>İlçe</label>
                    <div className="relative">
                      <select
                        value={editAddress.ilce || ''}
                        onChange={(e) => setEditAddress({ ...editAddress, ilce: e.target.value })}
                        disabled={!editAddress.il}
                        className={INPUT_CLS + ' appearance-none pr-9 disabled:opacity-50'}
                      >
                        <option value="">İlçe Seçin</option>
                        {editAddress.il && CITIES[editAddress.il]?.map((d: string) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Açık Adres</label>
                  <textarea
                    rows={2}
                    value={editAddress.adres_satiri || ''}
                    onChange={(e) => setEditAddress({ ...editAddress, adres_satiri: e.target.value })}
                    className={INPUT_CLS + ' resize-none'}
                    placeholder="Mahalle, sokak, no, daire"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Adres Türü</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-200">
                    {(['teslimat', 'fatura'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditAddress({ ...editAddress, tip: t })}
                        className={`flex-1 py-2 text-sm font-bold transition-colors ${(editAddress.tip || 'teslimat') === t ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      >
                        {t === 'teslimat' ? 'Teslimat' : 'Fatura'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setEditAddress(null)} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-sm">
                    Vazgeç
                  </button>
                  <button
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                    className="flex-1 bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {savingAddress ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            )}

            {!editAddress && (
              <button
                onClick={() => setEditAddress({ tip: 'teslimat' })}
                className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-500 hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" /> Yeni Adres Ekle
              </button>
            )}
          </div>
        )

      case 'kartlar':
        return (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-700">Kart saklama yakında</p>
            <p className="text-xs text-gray-400 mt-1">Param entegrasyonu</p>
          </div>
        )

      case 'gizlilik':
        return (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
              Şifrenizi değiştirmek için e-posta adresinize bir sıfırlama bağlantısı göndeririz.
            </div>
            <button className="w-full border border-gray-200 rounded-xl py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" /> Şifre Sıfırlama E-postası Gönder
            </button>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Profil görünürlüğünüzü Takma Ad ayarından yönetebilirsiniz. Kişisel verileriniz KVKK kapsamında korunur.
              </p>
            </div>
          </div>
        )

      case 'bildirimler':
        return (
          <div className="space-y-3">
            {[
              { key: 'bildirim_mesaj', label: 'Yeni mesaj bildirimleri' },
              { key: 'bildirim_teklif', label: 'Teklif bildirimleri' },
              { key: 'bildirim_ilan', label: 'İlan durumu değişiklikleri' },
              { key: 'bildirim_email', label: 'E-posta bildirimleri' },
              { key: 'bildirim_sms', label: 'SMS bildirimleri' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                <Toggle
                  on={(notifs as any)[item.key]}
                  onToggle={() => handleToggleNotif({ ...notifs, [item.key]: !(notifs as any)[item.key] })}
                />
              </div>
            ))}
          </div>
        )

      case 'iletisim':
        return (
          <div className="space-y-3">
            {[
              { key: 'bildirim_email', label: 'Promosyon e-postaları', desc: 'Kampanya ve indirim haberleri' },
              { key: 'bildirim_sms', label: 'SMS bildirimleri', desc: 'Kritik işlem SMS\'leri' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <Toggle
                  on={(notifs as any)[item.key]}
                  onToggle={() => handleToggleNotif({ ...notifs, [item.key]: !(notifs as any)[item.key] })}
                />
              </div>
            ))}
          </div>
        )

      case 'sohbet':
        return (
          <div className="space-y-3">
            {[
              {
                title: 'Halka açık yerde buluşun',
                body: 'Tanımadığınız kişilerle buluşurken AVM, kafe gibi kalabalık ve güvenli alanları tercih edin.',
              },
              {
                title: 'Ürünü teslim almadan ödeme yapmayın',
                body: 'Ürünü incelemeden ve teslim almadan kesinlikle ödeme yapmayın.',
              },
              {
                title: 'Şüpheli durumları bildirin',
                body: '"Şikayet Et" butonunu kullanarak şüpheli ilan ve kullanıcıları ekibimize bildirin.',
              },
              {
                title: 'İzlenebilir ödeme kullanın',
                body: 'Banka havalesi, EFT veya dijital cüzdan gibi kayıt altına alınan ödeme yöntemlerini tercih edin.',
              },
              {
                title: 'Anlaşma Notunu Kullanın',
                body: 'Fiyat, ürün ve teslimat yöntemi üzerine anlaştıktan sonra Anlaşma Notu ile bunu sohbete sabitleyin.',
              },
            ].map((tip, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <p className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" /> {tip.title}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">{tip.body}</p>
              </div>
            ))}
          </div>
        )

      case 'hesap':
        return (
          <div className="space-y-4">
            <button
              onClick={() => setShowLogoutDialog(true)}
              className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-2xl text-gray-700 hover:bg-gray-50 text-sm"
            >
              <LogOut className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="font-bold">Tüm Cihazlardan Çıkış Yap</p>
                <p className="text-xs text-gray-400">Tüm oturumlarınızı sonlandırır</p>
              </div>
            </button>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-4 h-4" /> Tehlikeli Bölge
              </p>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-red-100 text-sm border border-red-200 bg-white"
              >
                <Trash2 className="w-5 h-5 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-bold">Hesabımı Sil ve Beni Unut</p>
                  <p className="text-xs text-red-400">Bu işlem 30 gün sonra geri alınamaz</p>
                </div>
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => {
              if (section) { setSection(null); setEditAddress(null) }
              else onBack?.()
            }}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{currentLabel}</h1>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className={`w-full md:w-72 flex-shrink-0 ${section ? 'hidden md:block' : 'block'}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = section === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => { setSection(item.key); setEditAddress(null) }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-50 last:border-0 ${active ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary/10' : 'bg-gray-50'}`}>
                      <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${active ? 'text-primary' : 'text-gray-900'}`}>{item.label}</p>
                      <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : 'text-gray-300'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div className={`flex-1 min-w-0 ${section ? 'block' : 'hidden md:block'}`}>
            {section ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                {renderSection()}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
                <p className="text-sm">Soldaki menüden bir bölüm seçin</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete account dialog */}
      {showDeleteDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[80] p-4"
          onClick={() => setShowDeleteDialog(false)}
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Hesabımı Sil ve Beni Unut</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Bu işlemi onaylamanızdan itibaren <strong>30 gün</strong> süre tanınır. Bu süre içinde giriş yaparak işlemi iptal edebilirsiniz.
            </p>
            <p className="text-sm text-gray-600 mb-5">
              30 gün sonunda tüm verileriniz (ilanlar, mesajlar, değerlendirmeler) kalıcı olarak silinir. Aktif ilanlarınız hemen yayından kaldırılır.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteDialog(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-bold">
                Vazgeç
              </button>
              <button onClick={handleDeleteAccount} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-all">
                Hesabı Sil
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout all devices dialog */}
      {showLogoutDialog && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[80] p-4"
          onClick={() => setShowLogoutDialog(false)}
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-gray-900">Tüm Cihazlardan Çıkış</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Telefon ve bilgisayar dahil tüm cihazlardaki oturumlarınız kapatılacaktır.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutDialog(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-bold">
                İptal
              </button>
              <button onClick={handleLogoutAll} className="flex-1 bg-primary hover:bg-primary/95 text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-all">
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
