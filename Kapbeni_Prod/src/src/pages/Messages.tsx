import { useState, useEffect, useRef } from 'react'
import { mesajlarApi } from '../api'
import { useAuth } from '../context/AuthContext'

interface MessagesProps {
  /** Konversation, die beim Eintritt geoeffnet werden soll (aus der URL). */
  initialChatId?: string | null
  /** Meldet die Auswahl nach oben — App.tsx braucht sie fuer die Browser-History. */
  onChatChange?: (id: string | null) => void
  /** Mobiler Zurueck-Pfeil: soll eine History-Station zurueckgehen statt eine neue anzulegen. */
  onCloseChat?: () => void
  /** Vorformulierter Text (z.B. aus "Hemen Al") — landet im Eingabefeld, wird NICHT automatisch gesendet. */
  initialText?: string | null
  /** Meldet zurueck, dass der Vorschlagstext uebernommen wurde. */
  onTextUebernommen?: () => void
}

export default function Messages({ initialChatId, onChatChange, onCloseChat, initialText, onTextUebernommen }: MessagesProps = {}) {
  const { user } = useAuth()
  const [chats, setChats] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Vorformulierten Text einmalig ins Eingabefeld uebernehmen, sobald die
  // passende Konversation offen ist. Bewusst nur vorausfuellen: der Nutzer
  // soll den Text anpassen und selbst absenden koennen.
  useEffect(() => {
    if (!initialText || !activeChat) return
    setInput(initialText)
    onTextUebernommen?.()
  }, [initialText, activeChat])

  // Aus der URL vorgegebene Konversation oeffnen, sobald die Liste geladen ist.
  useEffect(() => {
    if (!initialChatId || !chats.length) return
    if (activeChat && String(activeChat.id) === String(initialChatId)) return
    const treffer = chats.find((c: any) => String(c.id) === String(initialChatId))
    if (treffer) setActiveChat(treffer)
  }, [initialChatId, chats])
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const getName = (chat: any) =>
    (user && chat.alici_id === user.id ? chat.satici_ad : chat.alici_ad) || 'Kullanıcı'

  const loadChats = async () => {
    try {
      const data = await mesajlarApi.getChats()
      setChats(Array.isArray(data) ? data : [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (chatId: string | number) => {
    try {
      const data = await mesajlarApi.getChat(String(chatId))
      setMessages(Array.isArray(data) ? data : [])
    } catch {}
  }

  useEffect(() => {
    if (user) loadChats()
  }, [user])

  useEffect(() => {
    if (!activeChat) return
    loadMessages(activeChat.id)
    pollRef.current = setInterval(() => loadMessages(activeChat.id), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return
    const text = input
    setInput('')
    try {
      await mesajlarApi.sendMessage(String(activeChat.id), text)
      loadMessages(activeChat.id)
      loadChats()
    } catch {
      setInput(text)
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <span className="text-4xl">💬</span>
        <p>Mesajları görmek için giriş yapın</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow overflow-hidden">
      {/* Chat list */}
      <div className={`w-80 border-r flex flex-col flex-shrink-0 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-3 border-b font-semibold text-gray-800">Mesajlar</div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Yükleniyor...</div>
        ) : chats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm text-center px-4">
            Henüz mesajınız yok
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => { setActiveChat(chat); onChatChange?.(String(chat.id)) }}
                className={`w-full px-4 py-3 flex gap-3 items-start hover:bg-gray-50 border-b text-left ${activeChat?.id === chat.id ? 'bg-red-50 border-l-2 border-l-[var(--color-primary)]' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold flex-shrink-0">
                  {getName(chat)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">{getName(chat)}</span>
                  <p className="text-xs text-gray-500 truncate">{chat.baslik}</p>
                  <p className="text-xs text-gray-400 truncate">{chat.son_mesaj || '–'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat window */}
      <div className={`flex-1 flex flex-col ${activeChat ? 'flex' : 'hidden md:flex'}`}>
        {activeChat ? (
          <>
            <div className="px-4 py-3 border-b flex items-center gap-3">
              <button onClick={() => { if (onCloseChat) { onCloseChat() } else { setActiveChat(null); onChatChange?.(null) } }} className="md:hidden text-gray-500 mr-1">←</button>
              <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm">
                {getName(activeChat)[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{getName(activeChat)}</p>
                <p className="text-xs text-gray-500">{activeChat.baslik}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
              {messages.map((msg) => {
                const isMine = msg.gonderen_id === user?.id
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMine ? 'bg-[var(--color-primary)] text-white rounded-br-sm' : 'bg-white border text-gray-800 rounded-bl-sm'}`}>
                      <p>{msg.metin}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className="px-4 py-3 border-t flex gap-2">
              <input
                className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                placeholder="Mesaj yazın..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
              />
              <button
                onClick={sendMessage}
                className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90"
              >
                Gönder
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 gap-3 flex-col">
            <span className="text-5xl">💬</span>
            <p>Bir konuşma seçin</p>
          </div>
        )}
      </div>
    </div>
  )
}
