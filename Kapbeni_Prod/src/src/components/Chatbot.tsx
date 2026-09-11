import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Mail, Send, ChevronLeft, ThumbsUp, ThumbsDown, Headphones, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ve } from '../api'

const WELCOME_MESSAGE = `Merhaba! 👋 Ben **KapBeni Bot**. Size nasıl yardımcı olabilirim?

Aşağıdaki konulardan birini seçebilir ya da sorunuzu yazabilirsiniz:`

const QUICK_QUESTIONS = [
  'İlan nasıl veririm?',
  'İlan süresi ne kadar?',
  'Güvenli nasıl alışveriş yapabilirim?',
  'Kimlik doğrulama (KYC) nedir?',
  'Mesajlaşma nasıl çalışır?',
  'Paket ve abonelik fiyatları?',
  'Şifremi unuttum',
  'Kurumsal hesap nedir?',
]

function parseMarkdown(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1
      ? <strong key={i}>{part}</strong>
      : <span key={i}>{part}</span>
  )
}

type ChatView = 'chat' | 'rating' | 'ticket' | 'ticket-sent'

interface Message {
  role: 'user' | 'bot'
  text: string
  timestamp: Date
}

export default function Chatbot() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<ChatView>('chat')
  const [lastBotReply, setLastBotReply] = useState('')
  const [ticket, setTicket] = useState({ isim: '', email: '', konu: '', mesaj: '' })
  const [ticketNo, setTicketNo] = useState('')
  const [whatsapp, setWhatsapp] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ve.get('/whatsapp-ayar').then((d: any) => setWhatsapp(d)).catch(() => setWhatsapp(null))
  }, [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('kapbeni-bot-open', handler)
    return () => window.removeEventListener('kapbeni-bot-open', handler)
  }, [])

  useEffect(() => {
    if (user) {
      setTicket((t) => ({
        ...t,
        isim: t.isim || user.ad || '',
        email: t.email || user.email || '',
      }))
    }
  }, [user])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: WELCOME_MESSAGE, timestamp: new Date() }])
    }
  }, [open, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, view, loading])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages((prev) => [...prev, { role: 'user', text: trimmed, timestamp: new Date() }])
    setInput('')
    setLoading(true)
    try {
      const res: any = await ve.post('/destek/bot', { soru: trimmed })
      const reply = res?.cevap || 'Üzgünüm, bu konuda bilgi bulamadım. Destek ekibimize bağlanmamı ister misiniz?'
      setLastBotReply(reply)
      setMessages((prev) => [...prev, { role: 'bot', text: reply, timestamp: new Date() }])
      setTimeout(() => setView('rating'), 500)
    } catch {
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: 'Şu anda yanıt veremiyorum. Lütfen destek ekibimizle iletişime geçin.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleRating = (helpful: boolean) => {
    if (helpful) {
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: '✅ Harika! Size yardımcı olabildik. Başka bir sorunuz varsa yazabilirsiniz.',
        timestamp: new Date(),
      }])
      setView('chat')
    } else {
      setView('ticket')
    }
  }

  const submitTicket = async () => {
    if (!ticket.email || !ticket.konu || !ticket.mesaj) return
    try {
      const res: any = await ve.post('/destek/ticket', { ...ticket, bot_cevap: lastBotReply })
      setTicketNo(res?.ticket_no || 'KB' + Date.now())
      setView('ticket-sent')
    } catch {
      setTicketNo('KB' + Date.now())
      setView('ticket-sent')
    }
  }

  const openLiveSupport = () => {
    if ((window as any).Tawk_API?.maximize) {
      (window as any).Tawk_API.maximize()
    } else {
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: 'Canlı destek şu anda kullanılamıyor. Lütfen bir destek talebi oluşturun ya da WhatsApp üzerinden bize ulaşın.',
        timestamp: new Date(),
      }])
    }
  }

  const waUrl = whatsapp?.telefon
    ? `https://wa.me/${whatsapp.telefon.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Merhaba KapBeni Destek')}`
    : ''

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="KapBeni Bot"
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-[70] hover:scale-105 active:scale-95 transition-transform"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {open ? <X className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
      </button>

      {/* Chat window */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'tween', duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="fixed right-4 sm:right-6 z-[70] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
              style={{
                bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
                width: 'min(360px, calc(100vw - 2rem))',
                height: 'min(540px, calc(100vh - 10rem))',
              }}
            >
              {/* Header */}
              <div className="bg-primary px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold text-white text-sm">K</div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm leading-tight">KapBeni Bot</p>
                  <p className="text-red-100 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Çevrimiçi · Genellikle anında yanıtlar
                  </p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Kapat" className="ml-auto text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {parseMarkdown(msg.text)}
                    </div>
                  </div>
                ))}

                {/* Quick questions (only on first bot message) */}
                {messages.length === 1 && view === 'chat' && !loading && (
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 text-gray-700 hover:border-primary hover:text-primary transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Rating prompt */}
                {view === 'rating' && !loading && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                    <p className="text-sm text-gray-700 mb-3 font-medium">Yardımcı olabildik mi?</p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => handleRating(true)}
                        className="flex items-center gap-1.5 bg-green-100 text-green-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-200 transition-colors"
                      >
                        <ThumbsUp className="w-4 h-4" /> Evet
                      </button>
                      <button
                        onClick={() => handleRating(false)}
                        className="flex items-center gap-1.5 bg-red-100 text-red-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-200 transition-colors"
                      >
                        <ThumbsDown className="w-4 h-4" /> Hayır
                      </button>
                    </div>
                  </div>
                )}

                {/* Ticket form */}
                {view === 'ticket' && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={() => setView('chat')} aria-label="Geri" className="text-gray-400 hover:text-gray-600">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <p className="text-sm font-bold text-gray-900">Destek Talebi Oluştur</p>
                    </div>
                    <p className="text-xs text-gray-500">Ekibimiz en kısa sürede size dönecektir.</p>

                    {[
                      { key: 'isim', label: 'Adınız', type: 'text', placeholder: 'Ad Soyad' },
                      { key: 'email', label: 'E-posta', type: 'email', placeholder: 'ornek@mail.com' },
                      { key: 'konu', label: 'Konu', type: 'text', placeholder: 'Destek konusu' },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-gray-600 block mb-1">{field.label}</label>
                        <input
                          type={field.type}
                          value={(ticket as any)[field.key]}
                          onChange={(e) => setTicket({ ...ticket, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ))}

                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Mesajınız</label>
                      <textarea
                        value={ticket.mesaj}
                        onChange={(e) => setTicket({ ...ticket, mesaj: e.target.value })}
                        rows={3}
                        placeholder="Sorununuzu detaylıca açıklayın..."
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>

                    <button
                      onClick={submitTicket}
                      disabled={!ticket.email || !ticket.konu || !ticket.mesaj}
                      className="w-full bg-primary text-white rounded-lg py-2 text-xs font-bold disabled:opacity-50 hover:bg-primary/95 transition-colors"
                    >
                      Talep Gönder
                    </button>
                  </div>
                )}

                {/* Ticket sent */}
                {view === 'ticket-sent' && (
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="font-bold text-gray-900 text-sm">Talebiniz Alındı!</p>
                    <p className="text-xs text-gray-500 mt-1">Talep No: <strong>{ticketNo}</strong></p>
                    <p className="text-xs text-gray-400 mt-1">En kısa sürede e-posta ile dönüş yapılacaktır.</p>
                    <button onClick={() => setView('chat')} className="mt-3 text-xs text-primary hover:underline">
                      Yeni Soru Sor
                    </button>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input (only in chat view) */}
              {view === 'chat' && (
                <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(input)
                      }
                    }}
                    placeholder="Sorunuzu yazın..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    aria-label="Gönder"
                    className="bg-primary text-white rounded-xl w-9 h-9 flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Footer bar */}
              <div className="border-t border-gray-100 px-4 py-2 flex justify-between items-center flex-shrink-0 bg-gray-50">
                <button
                  onClick={openLiveSupport}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
                >
                  <Headphones className="w-3.5 h-3.5" /> Canlı Destek
                </button>

                {whatsapp?.aktif && whatsapp?.telefon && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.558 4.14 1.533 5.878L0 24l6.293-1.513A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.003 0-3.864-.543-5.463-1.49l-3.815.916.934-3.723A9.76 9.76 0 012.182 12c0-5.42 4.398-9.818 9.818-9.818 5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
                    </svg>
                    <span className="flex items-center gap-1">
                      WhatsApp
                      {whatsapp.durum === 'online' ? (
                        <span className="flex items-center gap-0.5 text-green-600">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Çevrimiçi
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-gray-400">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />Çevrimdışı
                        </span>
                      )}
                    </span>
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
