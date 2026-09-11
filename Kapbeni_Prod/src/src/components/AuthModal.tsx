// AuthModal.tsx — 1:1 nach Live-Bundle (_w-Komponente)
// 3 Ansichten: giris | kayit (Bireysel) | kurumsal — mit Google-Button + Kurumsal Kayıt
import { useState } from 'react'
import { X, Mail, Lock, Eye, EyeOff, User, Phone, Building2, Briefcase } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ve } from '../api'

const SEKTORLER = [
  'Elektronik', 'Beyaz Eşya', 'Mobilya & Dekorasyon', 'Giyim & Tekstil', 'Araç & Vasıta',
  'Araç Kiralama', 'Emlak', 'İnşaat & Yapı Malzemeleri', 'Spor & Hobi', 'Gıda & Tarım',
  'Hizmet & Servis', 'Üretim & İmalat', 'Diğer',
]

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.6h12.7c-.6 3-2.3 5.5-4.8 7.2v6h7.7c4.5-4.1 7-10.2 7-17.3z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.7-6c-2.1 1.4-4.8 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.7v6.2C6.5 42.5 14.7 48 24 48z" />
    <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6v-6.2H2.7C1 16.2 0 20 0 24s1 7.8 2.7 10.8l7.9-6.2z" />
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.7 0 6.5 5.5 2.7 13.4l7.9 6.2C12.5 13.7 17.8 9.5 24 9.5z" />
  </svg>
)

type Tab = 'giris' | 'kayit' | 'kurumsal'

interface Props {
  isOpen: boolean
  onClose: () => void
  initialTab?: Tab
}

const INPUT_ICON = 'w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all'
const INPUT_PLAIN = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all'
const INPUT_PASS = 'w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all'
const LABEL = 'block text-xs font-bold text-gray-600 mb-1'

export default function AuthModal({ isOpen, onClose, initialTab }: Props) {
  const { login, register } = useAuth()
  const [tab, setTab] = useState<Tab>(initialTab || 'giris')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Bireysel Kayıt
  const [regAd, setRegAd] = useState('')
  const [regSoyad, setRegSoyad] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')

  // Kurumsal Kayıt
  const [firmaAdi, setFirmaAdi] = useState('')
  const [vkn, setVkn] = useState('')
  const [mersisNo, setMersisNo] = useState('')
  const [yetkiliKisi, setYetkiliKisi] = useState('')
  const [sektor, setSektor] = useState('')
  const [kEmail, setKEmail] = useState('')
  const [kPhone, setKPhone] = useState('')
  const [kPassword, setKPassword] = useState('')
  const [ticariAdres, setTicariAdres] = useState('')

  if (!isOpen) return null

  const switchTab = (t: Tab) => { setTab(t); setError(''); setNotice('') }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginEmail, loginPassword)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.')
    } finally { setLoading(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!regAd.trim() || !regSoyad.trim()) { setError('Ad ve Soyad zorunludur.'); return }
    const digits = regPhone.replace(/\D/g, '')
    const normalized = digits.length === 10 && digits.startsWith('5') ? '0' + digits : digits
    if (!/^05[0-9]{9}$/.test(normalized)) {
      setError('Lütfen geçerli bir GSM numarası girin (05XX XXX XX XX).')
      return
    }
    setLoading(true)
    try {
      await register(`${regAd.trim()} ${regSoyad.trim()}`, regEmail, normalized, regPassword)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Kayıt olunamadı. Lütfen tekrar deneyin.')
    } finally { setLoading(false) }
  }

  const handleKurumsal = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (vkn.replace(/\D/g, '').length < 10) { setError('Geçerli bir Vergi Kimlik No giriniz (10 hane).'); return }
    const digits = kPhone.replace(/\D/g, '')
    const normalized = digits.length === 10 && digits.startsWith('5') ? '0' + digits : digits
    if (!/^05[0-9]{9}$/.test(normalized)) {
      setError('Lütfen geçerli bir GSM numarası girin (05XX XXX XX XX).')
      return
    }
    setLoading(true)
    try {
      await ve.post('/auth/kurumsal-kayit', {
        firma_adi: firmaAdi, vkn, mersis_no: mersisNo, yetkili_kisi: yetkiliKisi,
        sektor, email: kEmail, phone: normalized, password: kPassword,
        ticari_adres: ticariAdres, hesap_tipi: 'kurumsal',
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Kurumsal kayıt olunamadı. Lütfen tekrar deneyin.')
    } finally { setLoading(false) }
  }

  const handleGoogle = () => {
    setNotice('Google ile giriş yakında aktif olacak. KapBeni Google OAuth onayı bekleniyor.')
    setTimeout(() => setNotice(''), 4000)
  }

  const Alerts = () => (
    <>
      {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>}
      {notice && <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">{notice}</div>}
    </>
  )

  const PassToggle = () => (
    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2">
      {showPass ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
    </button>
  )

  // ── Giriş ──────────────────────────────────────────────────────
  if (tab === 'giris') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-black text-gray-900">Giriş Yap</h2>
              <p className="text-xs text-gray-500 mt-0.5">Hesabınıza güvenle giriş yapın</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 pb-6 pt-4">
            <Alerts />
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="E-posta adresiniz" required className={INPUT_ICON} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type={showPass ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Şifreniz" required className={INPUT_PASS} />
                <PassToggle />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60">
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">veya</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button type="button" onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                <GoogleIcon />
                Google ile Giriş Yap
              </button>
              <p className="text-center text-xs text-gray-500 pt-2">
                Hesabınız yok mu?{' '}
                <button type="button" onClick={() => switchTab('kayit')} className="text-primary font-bold hover:underline">Kayıt Ol</button>
                {' '}·{' '}
                <button type="button" onClick={() => switchTab('kurumsal')} className="text-primary font-bold hover:underline">Kurumsal Kayıt</button>
              </p>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Kayıt (Bireysel / Kurumsal) ───────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => switchTab('kayit')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'kayit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Bireysel Kayıt
            </button>
            <button onClick={() => switchTab('kurumsal')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === 'kurumsal' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'}`}>
              🏢 Kurumsal
            </button>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0 ml-2">
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-6 pt-4">
          <Alerts />

          {tab === 'kayit' && (
            <form onSubmit={handleRegister} noValidate className="space-y-4">
              <p className="text-center text-xs text-gray-500 mb-1">
                Zaten hesabınız var mı?{' '}
                <button type="button" onClick={() => switchTab('giris')} className="text-primary font-bold hover:underline">Giriş Yap</button>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" value={regAd} onChange={(e) => setRegAd(e.target.value)} placeholder="Ad" required className={INPUT_ICON} />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" value={regSoyad} onChange={(e) => setRegSoyad(e.target.value)} placeholder="Soyad" required className={INPUT_ICON} />
                </div>
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="E-posta adresiniz" required className={INPUT_ICON} />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel" inputMode="numeric" maxLength={11} value={regPhone}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '')
                    if (v.startsWith('5')) v = '0' + v
                    setRegPhone(v.slice(0, 11))
                  }}
                  placeholder="Telefon (05XX XXX XX XX)" className={INPUT_ICON}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type={showPass ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Şifre (min. 6 karakter)" required minLength={6} className={INPUT_PASS} />
                <PassToggle />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60">
                {loading ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">veya</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <button type="button" onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
                <GoogleIcon />
                Google ile Kayıt Ol
              </button>
              <p className="text-xs text-center text-gray-400">
                Kayıt olarak{' '}
                <a href="/#/kullanim-kosullari" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Kullanım Koşulları</a>
                'nı kabul etmiş olursunuz.
              </p>
            </form>
          )}

          {tab === 'kurumsal' && (
            <form onSubmit={handleKurumsal} noValidate className="space-y-3">
              <p className="text-center text-xs text-gray-500 mb-1">
                Zaten hesabınız var mı?{' '}
                <button type="button" onClick={() => switchTab('giris')} className="text-primary font-bold hover:underline">Giriş Yap</button>
              </p>
              <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 flex gap-2 items-start">
                <Building2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Kurumsal hesaplar <strong>Vergi Kimlik No</strong> ile doğrulanır. Hesabınız 24–48 saat içinde aktif olur.
                </p>
              </div>
              <div>
                <label className={LABEL}>Firma Adı *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" value={firmaAdi} onChange={(e) => setFirmaAdi(e.target.value)} placeholder="ABC Teknoloji Ltd. Şti." required className={INPUT_ICON} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Vergi Kimlik No (VKN) *</label>
                  <input type="text" inputMode="numeric" maxLength={10} value={vkn} onChange={(e) => setVkn(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 hane" required className={INPUT_PLAIN} />
                </div>
                <div>
                  <label className={LABEL}>MERSİS No</label>
                  <input type="text" value={mersisNo} onChange={(e) => setMersisNo(e.target.value)} placeholder="opsiyonel" className={INPUT_PLAIN} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Yetkili Kişi *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" value={yetkiliKisi} onChange={(e) => setYetkiliKisi(e.target.value)} placeholder="Ad Soyad" required className={INPUT_ICON} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Sektör *</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={sektor} onChange={(e) => setSektor(e.target.value)} required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white appearance-none"
                  >
                    <option value="">Sektör seçiniz...</option>
                    {SEKTORLER.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Ticari Adres *</label>
                <input type="text" value={ticariAdres} onChange={(e) => setTicariAdres(e.target.value)} placeholder="Cadde, No, İlçe / İl" required className={INPUT_PLAIN} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>E-posta *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="email" value={kEmail} onChange={(e) => setKEmail(e.target.value)} placeholder="info@firma.com" required className={INPUT_ICON} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Telefon *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel" inputMode="numeric" maxLength={11} value={kPhone}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, '')
                        if (v.startsWith('5')) v = '0' + v
                        setKPhone(v.slice(0, 11))
                      }}
                      placeholder="05XX XXX XXXX" className={INPUT_ICON}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className={LABEL}>Şifre *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type={showPass ? 'text' : 'password'} value={kPassword} onChange={(e) => setKPassword(e.target.value)} placeholder="Min. 6 karakter" required minLength={6} className={INPUT_PASS} />
                  <PassToggle />
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs text-gray-500 space-y-1">
                <p>📋 <strong>Kurumsal Kural:</strong> Ticari ürün/hizmet ilanı verebilirsiniz. İkinci el bireysel satış için Bireysel Kayıt kullanın.</p>
                <p>🔐 VKN, GİB veritabanında otomatik doğrulanır. Sahte bilgiler hesap iptaline neden olur.</p>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60">
                {loading ? 'Kayıt gönderiliyor...' : '🏢 Kurumsal Hesap Oluştur'}
              </button>
              <p className="text-xs text-center text-gray-400">
                Kayıt olarak{' '}
                <a href="/#/kullanim-kosullari" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">Kullanım Koşulları</a>
                'nı ve{' '}
                <a href="/#/gizlilik-politikasi" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">KVKK Aydınlatma Metni</a>
                'ni kabul etmiş olursunuz.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
