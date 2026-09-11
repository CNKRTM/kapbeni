import { useState } from 'react'
import { Mail, AtSign, Phone, Lightbulb, Send, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ve } from '../api'

const QUICK_QUESTIONS = [
  'İlan nasıl verilir?',
  'Güvenli alışveriş nasıl yapılır?',
  'Hesabım neden askıya alındı?',
  'KYC doğrulama nedir?',
]

export default function Support() {
  const { user } = useAuth()
  const [form, setForm] = useState({ konu: '', mesaj: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const openBot = () => window.dispatchEvent(new CustomEvent('kapbeni-bot-open'))

  const senderName =
    [user?.ad, user?.soyad].filter(Boolean).join(' ') || user?.email || ''

  const submit = async () => {
    if (!form.konu.trim() || !form.mesaj.trim()) return
    setSending(true)
    try {
      await ve.post('/destek/oneri', {
        konu: form.konu.trim(),
        mesaj: form.mesaj.trim(),
        kullanici_id: user?.id ?? null,
      })
      setSubmitted(true)
    } catch {
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="bg-gray-50 py-12 px-4 font-['Plus_Jakarta_Sans']">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">7/24 Destek Ekibi</h2>
          <p className="text-gray-500 mt-2 text-sm">Sorularınız için buradayız. Çoğu sorunuza anında yanıt alırsınız.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Bot card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900">KapBeni Bot</p>
                <p className="text-xs text-gray-400">Anında yanıt · 7/24 aktif</p>
              </div>
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium flex-shrink-0">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Çevrimiçi
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={openBot}
                  className="w-full text-left text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-primary hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            <button
              onClick={openBot}
              className="mt-auto w-full bg-primary hover:bg-primary/95 text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" /> Bize Ulaşın
            </button>

            <div className="flex justify-around mt-4 pt-4 border-t border-gray-100">
              <a
                href="mailto:destek@kapbeni.com"
                className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
              >
                <AtSign className="w-4 h-4" /> destek@kapbeni.com
              </a>
              <a
                href="tel:+905380324398"
                className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" /> +90 538 032 43 98
              </a>
            </div>
          </div>

          {/* Suggestion card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900">Önerileriniz</p>
                <p className="text-xs text-gray-400">Platformu birlikte geliştirelim</p>
              </div>
            </div>

            {submitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-bold text-gray-900 mb-1">Teşekkürler!</p>
                <p className="text-sm text-gray-500">Öneriniz ekibimize iletildi. Geri bildiriminiz için teşekkür ederiz.</p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ konu: '', mesaj: '' }) }}
                  className="mt-4 text-sm text-primary hover:underline font-semibold"
                >
                  Yeni Öneri Gönder
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 flex-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Konu</label>
                    <input
                      value={form.konu}
                      onChange={(e) => setForm({ ...form, konu: e.target.value })}
                      placeholder="Öneri konusu..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mesaj</label>
                    <textarea
                      value={form.mesaj}
                      onChange={(e) => setForm({ ...form, mesaj: e.target.value })}
                      rows={5}
                      placeholder="Önerinizi detaylıca açıklayın..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none resize-none"
                    />
                  </div>
                  {senderName && (
                    <p className="text-xs text-gray-400">
                      Gönderen: <strong className="text-gray-600">{senderName}</strong>
                    </p>
                  )}
                </div>

                <button
                  onClick={submit}
                  disabled={!form.konu.trim() || !form.mesaj.trim() || sending}
                  className="mt-4 w-full bg-primary hover:bg-primary/95 text-white rounded-xl py-3 text-sm font-bold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Gönderiliyor...' : 'Öneri Gönder'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
