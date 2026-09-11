import { createPortal } from 'react-dom'
import { useState } from 'react'
import { Smartphone, X, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { gsmApi } from '../api'

interface Props {
  onClose: () => void
}

export default function GSMModal({ onClose }: Props) {
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState<'phone' | 'code' | 'done'>('phone')
  const [phone, setPhone] = useState(user?.phone || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendCode = async () => {
    setError('')
    setLoading(true)
    try {
      await gsmApi.gonder(phone.trim() || undefined)
      setState('code')
    } catch {
      setError('Kod gönderilemedi. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setError('')
    setLoading(true)
    try {
      await gsmApi.dogrula(code.trim())
      await refreshUser()
      setState('done')
    } catch {
      setError('Kod hatalı. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-900">GSM Doğrulama</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {state === 'phone' && (
            <>
              <p className="text-sm text-gray-500">
                Telefon numaranıza bir doğrulama kodu göndereceğiz.
              </p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={sendCode}
                disabled={loading || phone.trim().length < 10}
                className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? 'Gönderiliyor...' : 'Kodu Gönder'}
              </button>
            </>
          )}

          {state === 'code' && (
            <>
              <p className="text-sm text-gray-500">
                <strong>{phone}</strong> numarasına gönderilen 6 haneli kodu girin.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="______"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-xl tracking-[0.4em] font-bold focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={verify}
                disabled={loading || code.length < 6}
                className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </button>
              <button
                onClick={() => setState('phone')}
                className="w-full text-xs text-gray-400 hover:text-gray-600"
              >
                Numarayı değiştir
              </button>
            </>
          )}

          {state === 'done' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-bold text-gray-900">GSM Doğrulaması Tamamlandı</p>
              <p className="text-sm text-gray-500 mt-1">Telefon numaranız başarıyla doğrulandı.</p>
              <button
                onClick={onClose}
                className="mt-5 w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-all"
              >
                Tamam
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
