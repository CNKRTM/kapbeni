// DestekMerkezi.tsx — 1:1 rekonstruiert aus dem Live-Bundle ($w, Fw, Iw, Vw, Ow)
// Support-Center-Overlay: Taleplerim (Ticketliste + Chat) | Yeni Talep | Önerileriniz
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, RefreshCw, Plus, ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ve } from '../api'

const FONT = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

// ── API-Service (Live: Qs) ─────────────────────────────────────
const destekApi = {
  create: (data: any) => ve.post<any>('/destek/ticket', data),
  getMine: () => ve.get<any>('/destek/ticket/benim'),
  getById: (id: any) => ve.get<any>(`/destek/tickets/${id}`),
  sendMessage: (id: any, metin: string) => ve.post<any>(`/destek/tickets/${id}/mesaj`, { metin }),
  sendOneri: (data: any) => ve.post<any>('/destek/oneri', data),
}

// ── Konfigurationen (Live: cr, hl) ─────────────────────────────
const ONCELIKLER: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  dusuk: { label: 'Düşük', color: '#6b7280', bg: '#f3f4f6', icon: 'ti-arrow-down' },
  normal: { label: 'Normal', color: '#2563eb', bg: '#eff6ff', icon: 'ti-minus' },
  yuksek: { label: 'Yüksek', color: '#d97706', bg: '#fffbeb', icon: 'ti-arrow-up' },
  acil: { label: 'Acil', color: '#dc2626', bg: '#fef2f2', icon: 'ti-alert-triangle' },
}
const DURUMLAR: Record<string, { label: string; color: string; bg: string }> = {
  beklemede: { label: 'Beklemede', color: '#92400e', bg: '#fef3c7' },
  inceleniyor: { label: 'İnceleniyor', color: '#1d4ed8', bg: '#eff6ff' },
  cevaplandi: { label: 'Cevaplandı', color: '#15803d', bg: '#f0fdf4' },
  kapatildi: { label: 'Kapatıldı', color: '#6b7280', bg: '#f3f4f6' },
}
const YANIT_SURELERI: Record<string, string> = { dusuk: '72 saat', normal: '24 saat', yuksek: '8 saat', acil: '2 saat' }

function OncelikBadge({ p }: { p: string }) {
  const c = ONCELIKLER[p] || ONCELIKLER.normal
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color, background: c.bg, ...FONT }}>
      <i className={`ti ${c.icon}`} style={{ fontSize: 11 }} />
      {c.label}
    </span>
  )
}

function DurumBadge({ s }: { s: string }) {
  const c = DURUMLAR[s] || DURUMLAR.beklemede
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color, background: c.bg, ...FONT }}>
      {c.label}
    </span>
  )
}

// ── Yeni Talep Formular (Live: Fw) ─────────────────────────────
function YeniTalepForm({ onCreated }: { onCreated: () => void }) {
  const [konu, setKonu] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [oncelik, setOncelik] = useState('normal')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!konu.trim() || !aciklama.trim()) return
    setSending(true); setErr('')
    try {
      await destekApi.create({ konu: konu.trim(), aciklama: aciklama.trim(), oncelik })
      onCreated()
    } catch (e: any) { setErr(e.message || 'Gönderilemedi, lütfen tekrar deneyin.') }
    finally { setSending(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10,
    ...FONT, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fafafa', transition: 'border 0.15s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 2px' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, ...FONT }}>
          Konu <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          value={konu} onChange={(e) => setKonu(e.target.value)} placeholder="Talebinizin konusu..." maxLength={120}
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a2e4a' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
        />
        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, ...FONT }}>{konu.length}/120</p>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, ...FONT }}>
          Öncelik <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {Object.keys(ONCELIKLER).map((key) => {
            const cfg = ONCELIKLER[key]
            const active = oncelik === key
            return (
              <button
                key={key} onClick={() => setOncelik(key)}
                style={{
                  padding: '8px 4px', borderRadius: 10,
                  border: active ? `2px solid ${cfg.color}` : '1.5px solid #e5e7eb',
                  background: active ? cfg.bg : '#fafafa', color: active ? cfg.color : '#6b7280',
                  cursor: 'pointer', ...FONT, fontSize: 11, fontWeight: 700,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s',
                }}
              >
                <i className={`ti ${cfg.icon}`} style={{ fontSize: 16 }} />
                {cfg.label}
              </button>
            )
          })}
        </div>
        {oncelik === 'acil' && (
          <p style={{ fontSize: 11, color: '#dc2626', marginTop: 6, ...FONT, background: '#fef2f2', borderRadius: 8, padding: '6px 10px' }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 4 }} />
            Acil talepler 2 saat içinde yanıtlanır. Lütfen yalnızca gerçekten acil durumlarda kullanın.
          </p>
        )}
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, ...FONT }}>
          Açıklama <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea
          value={aciklama} onChange={(e) => setAciklama(e.target.value)}
          placeholder="Sorununuzu veya talebinizi detaylıca açıklayın..." rows={5} maxLength={2000}
          style={{ ...inputStyle, fontSize: 13, resize: 'vertical', lineHeight: 1.6 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a2e4a' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
        />
        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, ...FONT }}>{aciklama.length}/2000</p>
      </div>
      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, ...FONT }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
          {err}
        </div>
      )}
      <button
        onClick={submit} disabled={!konu.trim() || !aciklama.trim() || sending}
        style={{
          padding: '12px', borderRadius: 12, border: 'none',
          background: !konu.trim() || !aciklama.trim() || sending ? '#9ca3af' : '#1a2e4a',
          color: '#fff', ...FONT, fontSize: 14, fontWeight: 700,
          cursor: !konu.trim() || !aciklama.trim() || sending ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s',
        }}
      >
        <Send size={16} />
        {sending ? 'Gönderiliyor...' : 'Destek Talebi Oluştur'}
      </button>
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', ...FONT }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>
          <i className="ti ti-clock" style={{ marginRight: 4 }} />
          Yanıt Süreleri
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 0', fontSize: 11, color: '#374151' }}>
          {Object.entries(ONCELIKLER).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
              <i className={`ti ${cfg.icon}`} style={{ color: cfg.color, fontSize: 11 }} />
              <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}:</span>
              <span>{YANIT_SURELERI[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Ticket-Detail mit Chat (Live: Iw) ──────────────────────────
function TicketDetail({ ticket, onBack }: { ticket: any; onBack: () => void }) {
  const [mesajlar, setMesajlar] = useState<any[]>(ticket.mesajlar || [])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const refresh = async () => {
    setRefreshing(true)
    try {
      const t = await destekApi.getById(ticket.id)
      setMesajlar(t.mesajlar || [])
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }

  useEffect(() => { refresh() }, [ticket.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mesajlar])

  const send = async () => {
    if (!text.trim() || sending) return
    const t = text.trim()
    setSending(true)
    try {
      await destekApi.sendMessage(ticket.id, t)
      setText('')
      await refresh()
    } catch { /* silent */ }
    finally { setSending(false) }
  }

  const closed = ticket.durum === 'kapatildi'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', ...FONT, fontSize: 13, fontWeight: 600, padding: 0 }}>
          <ChevronLeft size={16} /> Geri
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ ...FONT, fontWeight: 700, fontSize: 14, color: '#1a2e4a', margin: 0 }}>{ticket.konu}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <DurumBadge s={ticket.durum} />
            <OncelikBadge p={ticket.oncelik} />
            <span style={{ fontSize: 10, color: '#9ca3af', ...FONT }}>
              #{ticket.id} · {new Date(ticket.created_at).toLocaleDateString('tr-TR')}
            </span>
          </div>
        </div>
        <button onClick={refresh} disabled={refreshing} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: '#6b7280' }} title="Yenile">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4, ...FONT }}>İlk Açıklama</p>
        <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6, ...FONT }}>{ticket.aciklama}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, minHeight: 120 }}>
        {mesajlar.length === 0 && (
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '24px 0', ...FONT }}>
            <i className="ti ti-message-off" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
            Henüz mesaj yok. Destek ekibimiz en kısa sürede size ulaşacak.
          </div>
        )}
        {mesajlar.map((m: any) => {
          const isAdmin = m.gonderen === 'admin'
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: isAdmin ? 'row' : 'row-reverse', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: isAdmin ? '#1a2e4a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: isAdmin ? '#fff' : '#6b7280' }}>
                <i className={`ti ${isAdmin ? 'ti-headset' : 'ti-user'}`} />
              </div>
              <div style={{ maxWidth: '75%', background: isAdmin ? '#1a2e4a' : '#f3f4f6', color: isAdmin ? '#fff' : '#1f2937', borderRadius: isAdmin ? '16px 16px 16px 4px' : '16px 16px 4px 16px', padding: '10px 14px' }}>
                {isAdmin && <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4, ...FONT }}>KapBeni Destek</p>}
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6, ...FONT }}>{m.metin}</p>
                <p style={{ fontSize: 10, margin: '4px 0 0', color: isAdmin ? 'rgba(255,255,255,0.5)' : '#9ca3af', ...FONT }}>
                  {m.created_at ? new Date(m.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div style={{ background: '#f3f4f6', borderRadius: 10, padding: '12px 14px', textAlign: 'center', color: '#6b7280', fontSize: 13, ...FONT }}>
          <i className="ti ti-lock" style={{ marginRight: 6 }} />
          Bu talep kapatılmıştır.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesajınızı yazın..." rows={2}
            style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, ...FONT, fontSize: 13, outline: 'none', resize: 'none', background: '#fafafa', lineHeight: 1.5 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#1a2e4a' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button
            onClick={send} disabled={!text.trim() || sending}
            style={{ width: 42, height: 42, borderRadius: 10, border: 'none', background: !text.trim() || sending ? '#e5e7eb' : '#1a2e4a', color: !text.trim() || sending ? '#9ca3af' : '#fff', cursor: !text.trim() || sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Taleplerim-Liste (Live: Vw) ────────────────────────────────
function TaleplerimList({ onNew }: { onNew: () => void }) {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [filter, setFilter] = useState('hepsi')

  const load = async () => {
    setLoading(true)
    try {
      const t = await destekApi.getMine()
      setTickets(Array.isArray(t) ? t : [])
    } catch { setTickets([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (selected) return <TicketDetail ticket={selected} onBack={() => { setSelected(null); load() }} />

  const filtered = filter === 'hepsi' ? tickets : tickets.filter((t) => t.durum === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['hepsi', 'beklemede', 'inceleniyor', 'cevaplandi', 'kapatildi'].map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              style={{
                padding: '4px 10px', borderRadius: 20, border: '1px solid',
                borderColor: filter === f ? '#1a2e4a' : '#e5e7eb',
                background: filter === f ? '#1a2e4a' : '#fff',
                color: filter === f ? '#fff' : '#6b7280',
                ...FONT, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f === 'hepsi' ? 'Hepsi' : DURUMLAR[f].label}
            </button>
          ))}
        </div>
        <button onClick={load} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#6b7280', ...FONT, fontSize: 12 }}>
          <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} />
          Yenile
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', ...FONT }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#1a2e4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Talepler yükleniyor...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af', ...FONT }}>
          <i className="ti ti-ticket-off" style={{ fontSize: 40, display: 'block', marginBottom: 10 }} />
          <p style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            {filter === 'hepsi' ? 'Henüz destek talebiniz yok' : `${DURUMLAR[filter].label} durumda talep yok`}
          </p>
          <p style={{ fontSize: 12 }}>Bir sorunuz mu var? Yeni talep oluşturun.</p>
          <button
            onClick={onNew}
            style={{ marginTop: 14, padding: '9px 20px', borderRadius: 10, border: 'none', background: '#1a2e4a', color: '#fff', ...FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Yeni Talep
          </button>
        </div>
      )}

      {!loading && filtered.map((t: any) => (
        <div
          key={t.id} onClick={() => setSelected(t)}
          style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', gap: 12, alignItems: 'flex-start' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1a2e4a'; e.currentTarget.style.background = '#f8fafc' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff' }}
        >
          <div style={{ width: 4, borderRadius: 4, flexShrink: 0, alignSelf: 'stretch', background: ONCELIKLER[t.oncelik]?.color || '#e5e7eb' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <p style={{ ...FONT, fontWeight: 700, fontSize: 13, color: '#1a2e4a', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.konu}</p>
              <span style={{ fontSize: 10, color: '#9ca3af', ...FONT, flexShrink: 0 }}>#{t.id}</span>
            </div>
            <p style={{ ...FONT, fontSize: 12, color: '#6b7280', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.aciklama}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <DurumBadge s={t.durum} />
              <OncelikBadge p={t.oncelik} />
              <span style={{ fontSize: 10, color: '#9ca3af', ...FONT }}>{new Date(t.created_at).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>
          <i className="ti ti-chevron-right" style={{ color: '#9ca3af', fontSize: 18, flexShrink: 0, marginTop: 2 }} />
        </div>
      ))}
    </div>
  )
}

// ── Öneriler-Tab (Live: Ow) ────────────────────────────────────
function OnerilerForm({ musteriNo }: { musteriNo?: string }) {
  const { user } = useAuth()
  const [konu, setKonu] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!konu.trim() || !mesaj.trim()) return
    setSending(true); setErr('')
    try {
      await destekApi.sendOneri({
        konu: konu.trim(),
        mesaj: mesaj.trim(),
        musteri_no: musteriNo || (user as any)?.musteri_no,
        ad: user ? [user.ad, user.soyad].filter(Boolean).join(' ') : undefined,
        email: user?.email,
      })
      setDone(true)
    } catch (e: any) { setErr(e.message || 'Gönderilemedi, lütfen tekrar deneyin.') }
    finally { setSending(false) }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', ...FONT }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <i className="ti ti-circle-check" style={{ fontSize: 36, color: '#15803d' }} />
        </div>
        <p style={{ fontWeight: 800, fontSize: 16, color: '#1a2e4a', margin: '0 0 8px', ...FONT }}>Teşekkürler!</p>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, ...FONT }}>Öneriniz ekibimize iletildi. Geri bildiriminiz için teşekkür ederiz.</p>
        <button
          onClick={() => { setKonu(''); setMesaj(''); setDone(false) }}
          style={{ marginTop: 20, padding: '9px 20px', borderRadius: 10, border: 'none', background: '#1a2e4a', color: '#fff', ...FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Yeni Öneri Gönder
        </button>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10,
    ...FONT, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fafafa', transition: 'border 0.15s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 2px' }}>
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <i className="ti ti-bulb" style={{ fontSize: 20, color: '#0369a1', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', margin: '0 0 2px', ...FONT }}>Önerinizi Paylaşın</p>
          <p style={{ fontSize: 11, color: '#374151', margin: 0, lineHeight: 1.6, ...FONT }}>
            Platformumuzu geliştirmemize yardımcı olun. Her öneri ekibimiz tarafından dikkatlice değerlendirilir.
          </p>
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, ...FONT }}>
          Konu <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          value={konu} onChange={(e) => setKonu(e.target.value)} placeholder="Önerinizin konusu..." maxLength={120}
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a2e4a' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
        />
        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, ...FONT }}>{konu.length}/120</p>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, ...FONT }}>
          Öneri / Görüş <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea
          value={mesaj} onChange={(e) => setMesaj(e.target.value)}
          placeholder="Önerinizi veya görüşünüzü detaylıca yazın..." rows={5} maxLength={2000}
          style={{ ...inputStyle, fontSize: 13, resize: 'vertical', lineHeight: 1.6 }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1a2e4a' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb' }}
        />
        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, ...FONT }}>{mesaj.length}/2000</p>
      </div>
      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, ...FONT }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
          {err}
        </div>
      )}
      <button
        onClick={submit} disabled={!konu.trim() || !mesaj.trim() || sending}
        style={{
          padding: '12px', borderRadius: 12, border: 'none',
          background: !konu.trim() || !mesaj.trim() || sending ? '#9ca3af' : '#1a2e4a',
          color: '#fff', ...FONT, fontSize: 14, fontWeight: 700,
          cursor: !konu.trim() || !mesaj.trim() || sending ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s',
        }}
      >
        <Send size={16} />
        {sending ? 'Gönderiliyor...' : 'Öneriyi Gönder'}
      </button>
    </div>
  )
}

// ── Haupt-Overlay (Live: $w) ───────────────────────────────────
interface Props {
  onClose: () => void
  musteriNo?: string
  initialTab?: 'taleplerim' | 'yeni' | 'oneriler'
}

export default function DestekMerkezi({ onClose, musteriNo, initialTab = 'taleplerim' }: Props) {
  const [tab, setTab] = useState<string>(initialTab)
  const [created, setCreated] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleCreated = () => {
    setCreated(true)
    setTimeout(() => { setCreated(false); setTab('taleplerim') }, 2000)
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[95] p-3 md:p-4" onClick={onClose}>
      <div
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 840, maxHeight: '90vh', display: 'flex', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.40)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar mit Foto (nur Desktop) */}
        <div
          style={{ width: 260, flexShrink: 0, backgroundImage: 'url(/kacheln/destek.png)', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', flexDirection: 'column' }}
          className="hidden md:flex"
        >
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.70) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '22px 18px 0' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <i className="ti ti-headset" style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <p style={{ color: '#fff', ...FONT, fontWeight: 800, fontSize: 17, margin: 0, lineHeight: 1.3 }}>
              Destek<br />Merkezi
            </p>
            {musteriNo && (
              <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '2px 8px', ...FONT }}>
                {musteriNo}
              </span>
            )}
          </div>
          <div style={{ position: 'relative', zIndex: 1, padding: '0 18px 22px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setTab('taleplerim')}
                style={{ background: tab === 'taleplerim' || tab === 'yeni' ? '#dc2626' : 'rgba(220,38,38,0.75)', border: 'none', borderRadius: 30, padding: '7px 14px', color: '#fff', ...FONT, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
              >
                <i className="ti ti-headset" style={{ fontSize: 13 }} />
                Destek
              </button>
              <button
                onClick={() => setTab('oneriler')}
                style={{ background: tab === 'oneriler' ? '#dc2626' : 'rgba(220,38,38,0.75)', border: 'none', borderRadius: 30, padding: '7px 14px', color: '#fff', ...FONT, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
              >
                <i className="ti ti-bulb" style={{ fontSize: 13 }} />
                Önerileriniz
              </button>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <a href="tel:+905380324398" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontWeight: 600, ...FONT }}>
                  <i className="ti ti-phone" style={{ fontSize: 13, color: '#86efac' }} />
                  +90 538 032 43 98
                </a>
                <a href="mailto:destek@kapbeni.com" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontWeight: 600, ...FONT }}>
                  <i className="ti ti-mail" style={{ fontSize: 13, color: '#93c5fd' }} />
                  destek@kapbeni.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Hauptbereich */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ background: '#1a2e4a', padding: '18px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="flex md:hidden items-center gap-2">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-headset" style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <div>
                  <p style={{ color: '#fff', ...FONT, fontWeight: 800, fontSize: 14, margin: 0 }}>Destek Merkezi</p>
                  {musteriNo && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', ...FONT }}>{musteriNo}</span>}
                </div>
              </div>
              <div className="hidden md:block" />
              <button
                onClick={onClose}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { id: 'taleplerim', label: 'Taleplerim', icon: 'ti-list' },
                { id: 'yeni', label: 'Yeni Talep', icon: 'ti-plus' },
                { id: 'oneriler', label: 'Önerileriniz', icon: 'ti-bulb' },
              ].map((t) => (
                <button
                  key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: tab === t.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                    color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.55)',
                    ...FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.15s',
                  }}
                >
                  <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {tab === 'yeni' && !created && <YeniTalepForm onCreated={handleCreated} />}
            {tab === 'yeni' && created && (
              <div style={{ textAlign: 'center', padding: '48px 20px', ...FONT }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <i className="ti ti-circle-check" style={{ fontSize: 36, color: '#15803d' }} />
                </div>
                <p style={{ fontWeight: 800, fontSize: 16, color: '#1a2e4a', margin: '0 0 8px' }}>Talebiniz oluşturuldu!</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Destek ekibimiz en kısa sürede size ulaşacak.</p>
              </div>
            )}
            {tab === 'taleplerim' && <TaleplerimList onNew={() => setTab('yeni')} />}
            {tab === 'oneriler' && <OnerilerForm musteriNo={musteriNo} />}
          </div>

          <div className="md:hidden" style={{ borderTop: '1px solid #f0f0f0', padding: '10px 20px', background: '#fafafa', display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
            <a href="tel:+905380324398" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1a2e4a', textDecoration: 'none', fontWeight: 600, ...FONT }}>
              <i className="ti ti-phone" style={{ fontSize: 14, color: '#15803d' }} />
              +90 538 032 43 98
            </a>
            <a href="mailto:destek@kapbeni.com" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1a2e4a', textDecoration: 'none', fontWeight: 600, ...FONT }}>
              <i className="ti ti-mail" style={{ fontSize: 14, color: '#2563eb' }} />
              destek@kapbeni.com
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
