// Dashboard — KapBeni Customer Area (overnight3, an echten Stack angepasst)
import { useState, useEffect, useRef } from 'react'
import FehlerGrenze, { Inhalt } from '../components/FehlerGrenze'
import { useAuth } from '../context/AuthContext'
import { ilanlarApi, favorilerApi, degerlendirmeApi, ve, Listing } from '../api'
import ProductCard from '../components/ProductCard'

type Tab = 'ilanlarim' | 'tekliflerim' | 'favorilerim' | 'degerlendirmeler' | 'aramalar' | 'kazancim' | 'dogrulamalar' | 'guven' | 'sikayetlerim'

interface Props {
  onSelectProduct: (l: Listing) => void
  onOpenKyc: () => void
  onOpenGsm: () => void
  onNavigateMessages: () => void
  onNavigateSettings?: () => void
  initialTab?: string
  /** Meldet den Reiterwechsel nach oben — App.tsx braucht ihn fuer die Browser-History. */
  onTabChange?: (tab: string) => void
  /** Bearbeiten aus "İlanlarım" heraus — oeffnet dieselbe Maske wie die Detailseite. */
  onEditListing?: (ilanId: string) => void
  /**
   * Zaehler, den App.tsx nach dem Bearbeiten oder Loeschen erhoeht.
   * Das Dashboard laedt je Reiter nur EINMAL (siehe `loaded`); ohne dieses
   * Signal bliebe ein geloeschtes Inserat sichtbar stehen — genau das
   * Symptom, das den Loeschknopf wirkungslos aussehen liess.
   */
  refreshSignal?: number
}

export default function Dashboard({ onSelectProduct, onOpenKyc, onOpenGsm, onNavigateSettings, initialTab, onTabChange, onEditListing, refreshSignal }: Props) {
  const { user, logout } = useAuth()
  const [geriBildirimOpen, setGeriBildirimOpen] = useState(false)
  const [gbKategori, setGbKategori] = useState('oneri')
  const [gbKonu, setGbKonu] = useState('')
  const [gbMetin, setGbMetin] = useState('')
  const [gbSent, setGbSent] = useState(false)
  const gonderGeriBildirim = async () => {
    if (!gbMetin.trim()) return
    try {
      await ve.post('/geri-bildirim', {
        kategori: gbKategori, konu: gbKonu, metin: gbMetin, email: (user as any)?.email,
      })
      setGbSent(true)
      setTimeout(() => { setGeriBildirimOpen(false); setGbSent(false); setGbKonu(''); setGbMetin('') }, 1600)
    } catch {
      alert('Geri bildirim gönderilemedi. Lütfen tekrar deneyin.')
    }
  }
  const [tab, setTab] = useState<Tab>((initialTab as Tab) || 'ilanlarim')
  // Auch undefined uebernehmen: beim Zuruecknavigieren auf '#/panel' (ohne
  // Unterreiter) muss der Standardreiter wieder greifen, sonst bleibt die
  // Ansicht auf dem alten Reiter stehen, waehrend die URL etwas anderes sagt.
  useEffect(() => { setTab((initialTab as Tab) || 'ilanlarim') }, [initialTab])
  const [ilanlar, setIlanlar] = useState<Listing[]>([])
  const [favoriler, setFavoriler] = useState<Listing[]>([])
  const [degerlendirmeler, setDegerlendirmeler] = useState<any[]>([])
  const [degStats, setDegStats] = useState<{ ortalama: number; sayi: number } | null>(null)
  const [sikayetler, setSikayetler] = useState<any[]>([])
  const [teklifler, setTeklifler] = useState<any[]>([])
  const [teklifRol, setTeklifRol] = useState<'alici' | 'satici'>('alici')
  const [kazanc, setKazanc] = useState<{ bakiye: number; hareketler: any[] } | null>(null)
  const [aramalar, setAramalar] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState<Set<Tab>>(new Set())

  const u = user as any
  const isKyc = u?.kyc_durum === 'onaylandi' || u?.kyc_durumu === 'onaylandi'
  const isGsm = u?.phone_verified === true || u?.gsm_onay === true
  const displayName = u?.takma_ad_aktif && u?.takma_ad
    ? u.takma_ad
    : [u?.ad, u?.soyad].filter(Boolean).join(' ') || 'Kullanıcı'

  // Aussen wurde etwas geaendert oder geloescht: den Merker leeren, damit der
  // Ladeeffekt unten wieder greift.
  const ersterLauf = useRef(true)
  useEffect(() => {
    if (ersterLauf.current) { ersterLauf.current = false; return }
    setLoaded(new Set())
  }, [refreshSignal])

  // `loaded` gehoert in die Abhaengigkeiten: sonst laeuft dieser Effect nur bei
  // einem Reiterwechsel, und das Leeren des Merkers durch refreshSignal
  // bliebe wirkungslos. Eine Schleife entsteht nicht — nach dem Laden steht
  // der Reiter wieder im Merker und der naechste Durchlauf bricht oben ab.
  useEffect(() => {
    if (loaded.has(tab)) return
    setLoading(true)
    const done = () => { setLoading(false); setLoaded(prev => new Set(prev).add(tab)) }

    if (tab === 'ilanlarim') {
      ilanlarApi.getMine().then((d: any) => {
        const arr = (d?.ilanlar || d || [])
        setIlanlar(arr.map((l: any) => ({
          id: String(l.uuid || l.id), title: l.baslik || l.title || '',
          price: Number(l.fiyat || l.price) || 0, category: l.kategori_ad || l.category || '', categorySlug: l.kategori_slug || '',
          location: [l.ilce, l.sehir].filter(Boolean).join(', ') || l.location || '',
          date: 'Yeni',
          image: l.ana_foto || l.image || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
          description: l.aciklama || l.description || '',
          sellerName: u?.ad || '', sellerPhone: '', isFavorite: false, condition: 'İkinci El',
        })))
      }).catch(() => {}).finally(done)
    } else if (tab === 'favorilerim') {
      // Zusaetzlich absichern: eine unerwartete Antwortform darf nie wieder
      // die ganze Seite mitreissen, auch wenn sich die Route erneut aendert.
      favorilerApi.getAll()
        .then((d) => setFavoriler(Array.isArray(d) ? d : []))
        .catch(() => setFavoriler([]))
        .finally(done)
    } else if (tab === 'degerlendirmeler') {
      Promise.all([
        degerlendirmeApi.getLast(20).catch(() => []),
        ve.get<any>('/dashboard/stats').catch(() => null),
      ]).then(([list, stats]: [any, any]) => {
        setDegerlendirmeler((list?.degerlendirmeler || list || []) as any[])
        if (stats) setDegStats({ ortalama: stats.degerlendirme_ortalama || 0, sayi: stats.degerlendirme_sayisi || 0 })
      }).finally(done)
    } else if (tab === 'sikayetlerim') {
      ve.get<any[]>('/sikayet/benim').then(d => setSikayetler(d || [])).catch(() => {}).finally(done)
    } else if (tab === 'kazancim') {
      ve.get<any>('/kazanc').then((d: any) => setKazanc({ bakiye: Number(d?.bakiye) || 0, hareketler: d?.hareketler || [] })).catch(() => {}).finally(done)
    } else if (tab === 'aramalar') {
      ve.get<any[]>('/kayitli-aramalar').then(d => setAramalar((d as any[]) || [])).catch(() => {}).finally(done)
    } else {
      done()
    }
  }, [tab, loaded])

  // Tekliflerim: lädt bei Tab-Wechsel und bei Rollen-Umschaltung (echtes Backend: GET /teklifler?rol=)
  useEffect(() => {
    if (tab !== 'tekliflerim') return
    setLoading(true)
    ve.get<any[]>(`/teklifler?rol=${teklifRol}`)
      .then(d => setTeklifler((d as any[]) || []))
      .catch(() => setTeklifler([]))
      .finally(() => setLoading(false))
  }, [tab, teklifRol])

  const handleTeklifStatus = async (id: number | string, status: 'kabul' | 'reddedildi') => {
    try {
      await ve.put(`/teklifler/${id}`, { status })
      setTeklifler(prev => prev.map((t: any) => (t.id === id ? { ...t, status } : t)))
    } catch { /* ignore */ }
  }

  const handleAramaSil = async (id: number | string) => {
    try { await ve.del(`/kayitli-aramalar/${id}`); setAramalar(prev => prev.filter((a: any) => a.id !== id)) } catch { /* ignore */ }
  }

  const durumRenk: Record<string, [string, string]> = {
    bekliyor: ['#92400e', '#fef3c7'], kabul: ['#15803d', '#f0fdf4'], reddedildi: ['#dc2626', '#fef2f2'], suresi_doldu: ['#6b7280', '#f3f4f6'],
  }
  const durumEtiket: Record<string, string> = {
    bekliyor: 'Cevap Bekliyor', kabul: 'Kabul Edildi', reddedildi: 'Reddedildi', suresi_doldu: 'Süresi Doldu',
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'ilanlarim', label: 'İlanlarım', icon: 'ti-package' },
    { id: 'tekliflerim', label: 'Tekliflerim', icon: 'ti-tag' },
    { id: 'favorilerim', label: 'Favorilerim', icon: 'ti-heart' },
    { id: 'degerlendirmeler', label: 'Değerlendirmeler', icon: 'ti-star' },
    { id: 'aramalar', label: 'Kayıtlı Aramalar', icon: 'ti-bookmark' },
    { id: 'kazancim', label: 'Kapbeni Kazancım', icon: 'ti-wallet' },
    { id: 'dogrulamalar', label: 'Doğrulamalar', icon: 'ti-shield-check' },
    { id: 'guven', label: 'Güven Puanım', icon: 'ti-award' },
    { id: 'sikayetlerim', label: 'Şikayetlerim', icon: 'ti-flag' },
  ]

  const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #f0f0f0', marginBottom: 16 }
  const tagStyle = (color: string, bg: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: bg, color,
    fontSize: 11, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
  })
  const fontBase: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" }
  const emptyStyle: React.CSSProperties = { textAlign: 'center', padding: 48, color: '#9ca3af', ...fontBase }

  const navSections: { grup: string; items: { key: Tab; label: string; icon: string }[] }[] = [
    { grup: 'İlan & Görünürlük', items: [{ key: 'ilanlarim', label: 'İlanlarım', icon: 'ti-package' }] },
    { grup: 'İşlemlerim', items: [
      { key: 'tekliflerim', label: 'Tekliflerim', icon: 'ti-tag' },
      { key: 'kazancim', label: 'Kapbeni Kazancım', icon: 'ti-wallet' },
      { key: 'dogrulamalar', label: 'Satıcı Doğrulama', icon: 'ti-shield-check' },
      { key: 'degerlendirmeler', label: 'Değerlendirmeler', icon: 'ti-star' },
    ] },
    { grup: 'Favoriler & Takip', items: [
      { key: 'favorilerim', label: 'Favorilerim', icon: 'ti-heart' },
      { key: 'aramalar', label: 'Kayıtlı Aramalarım', icon: 'ti-bookmark' },
    ] },
    // BUG-G FIX: guven + sikayetlerim waren nicht in navSections → jetzt erreichbar
    { grup: 'Güven & Şikayetler', items: [
      { key: 'guven', label: 'Güven Puanım', icon: 'ti-award' },
      { key: 'sikayetlerim', label: 'Şikayetlerim', icon: 'ti-flag' },
    ] },
  ]
  const grpStyle: React.CSSProperties = { padding: '8px 20px 4px', fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.5px', textTransform: 'uppercase' }
  const navBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 20px',
    background: active ? '#ffeaea' : 'transparent', border: 'none',
    borderLeft: active ? '3px solid #e53935' : '3px solid transparent',
    color: active ? '#e53935' : '#333', fontWeight: active ? 600 : 400, fontSize: 14,
    cursor: 'pointer', textAlign: 'left', ...fontBase,
  })

  return (
    <>
    <style>{`
      @media (max-width: 768px) {
        .dash-two-panel { flex-direction: column !important; }
        .dash-sidebar { width: 100% !important; position: static !important; height: auto !important; }
      }
    `}</style>
    <div className="dash-two-panel" style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 140px)', padding: '16px 0' }}>
      {/* LINKE SIDEBAR */}
      <aside
        className="hide-scrollbar dash-sidebar"
        style={{ width: 260, flexShrink: 0, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, position: 'sticky', top: 88, height: 'calc(100vh - 108px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '8px 0' }}
      >
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f0f0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff5f5', color: '#e53935', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {u?.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (u?.ad?.[0] || '?')}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...fontBase, fontWeight: 700, fontSize: 13, color: '#1a2e4a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ ...fontBase, fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u?.email}</div>
          </div>
        </div>
        {navSections.map(sec => (
          <div key={sec.grup}>
            <div style={grpStyle}>{sec.grup}</div>
            {sec.items.map(it => (
              <button key={it.key} onClick={() => { setTab(it.key); onTabChange?.(it.key) }} style={navBtn(tab === it.key)}>
                <i className={`ti ${it.icon}`} style={{ fontSize: 18, color: tab === it.key ? '#e53935' : '#555' }} />
                <span style={{ flex: 1 }}>{it.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div style={grpStyle}>Bize Ulaşın</div>
        <button onClick={() => setGeriBildirimOpen(true)} style={navBtn(false)}>
          <i className="ti ti-message-report" style={{ fontSize: 18, color: '#555' }} /><span style={{ flex: 1 }}>Geri Bildirim Ver</span>
        </button>
        <button onClick={() => onNavigateSettings?.()} style={navBtn(false)}>
          <i className="ti ti-settings" style={{ fontSize: 18, color: '#555' }} /><span style={{ flex: 1 }}>Ayarlar</span>
        </button>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <button onClick={() => logout()} style={{ ...navBtn(false), color: '#e53935' }}>
            <i className="ti ti-logout" style={{ fontSize: 18, color: '#e53935' }} /><span style={{ flex: 1 }}>Çıkış</span>
          </button>
        </div>
      </aside>

      {/* RECHTER CONTENT-BEREICH */}
      <main style={{ flex: 1, minWidth: 0 }}>

      {/* Fehlergrenze um die Reiter-Inhalte: ein Fehler beim Rendern nimmt
          sonst den gesamten React-Baum mit — Seitenleiste, Navigation und
          Fußzeile inklusive (siehe "Favorilerim" in CLAUDE.md). Der Schlüssel
          ist der Reiter, damit eine Meldung beim Wechseln verschwindet. */}
      <FehlerGrenze schluessel={tab}>
      <Inhalt render={() => (<>

      {loading && <div style={emptyStyle}>Yükleniyor...</div>}

      {!loading && tab === 'ilanlarim' && (
        ilanlar.length === 0
          ? <div style={emptyStyle}><i className="ti ti-package" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />Henüz ilanınız yok</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {ilanlar.map(l => (
                // ProductCard hat keinen Platz fuer Aktionen — der Knopf liegt
                // deshalb als Overlay darueber, genau wie in Profile.tsx.
                // Links statt rechts, damit er nicht auf dem Herz-Icon der
                // Karte sitzt (das steht auf absolute top-2 right-2).
                <div key={l.id} className="relative">
                  <ProductCard listing={l} isGridView={true} onSelect={() => onSelectProduct(l)} onToggleFavorite={() => {}} />
                  {onEditListing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditListing(l.id) }}
                      className="absolute top-2 left-2 z-10 flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-primary bg-white/95 border border-gray-200 hover:border-primary rounded-lg px-2 py-1 shadow-sm transition-colors cursor-pointer"
                    >
                      <i className="ti ti-pencil" style={{ fontSize: 13 }} /> Düzenle
                    </button>
                  )}
                </div>
              ))}
            </div>
      )}

      {!loading && tab === 'favorilerim' && (
        !Array.isArray(favoriler) || favoriler.length === 0
          ? <div style={emptyStyle}><i className="ti ti-heart" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />Henüz favori ilanınız yok</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {favoriler.map((l: any) => <ProductCard key={l.id} listing={l} isGridView={true} onSelect={() => onSelectProduct(l)} onToggleFavorite={() => {}} />)}
            </div>
      )}

      {!loading && tab === 'tekliflerim' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['alici', 'satici'] as const).map(r => (
              <button key={r} onClick={() => setTeklifRol(r)}
                style={{ padding: '8px 18px', borderRadius: 22, border: 'none', cursor: 'pointer', ...fontBase, fontSize: 12.5, fontWeight: 600,
                  background: teklifRol === r ? '#e53935' : '#f0f0f0', color: teklifRol === r ? '#fff' : '#444' }}>
                {r === 'alici' ? 'Alıcıyım' : 'Satıcıyım'}
              </button>
            ))}
          </div>
          {teklifler.length === 0
            ? <div style={emptyStyle}><i className="ti ti-tag" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />Henüz teklif yok</div>
            : teklifler.map((t: any) => (
                <div key={t.id} style={{ ...cardStyle, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: '#f5f5f5', overflow: 'hidden', flexShrink: 0 }}>
                    {t.foto ? <img src={t.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-photo" style={{ color: '#ccc' }} /></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...fontBase, fontWeight: 600, fontSize: 13, color: '#1a2e4a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.baslik}</div>
                    <div style={{ ...fontBase, fontSize: 14, color: '#e53935', fontWeight: 700, marginTop: 2 }}>{Number(t.teklif_fiyat).toLocaleString('tr-TR')} TL</div>
                    {t.mesaj && <div style={{ ...fontBase, fontSize: 11, color: '#6b7280', marginTop: 2 }}>{t.mesaj}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <span style={tagStyle(durumRenk[t.status]?.[0] || '#6b7280', durumRenk[t.status]?.[1] || '#f3f4f6')}>{durumEtiket[t.status] || t.status}</span>
                    {teklifRol === 'satici' && t.status === 'bekliyor' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleTeklifStatus(t.id, 'kabul')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 11, cursor: 'pointer', ...fontBase }}>Kabul</button>
                        <button onClick={() => handleTeklifStatus(t.id, 'reddedildi')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 11, cursor: 'pointer', ...fontBase }}>Reddet</button>
                      </div>
                    )}
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {!loading && tab === 'aramalar' && (
        <div style={cardStyle}>
          <div style={{ ...fontBase, fontWeight: 700, fontSize: 15, color: '#1a2e4a', marginBottom: 16 }}>Kayıtlı Aramalarım</div>
          {aramalar.length === 0
            ? <div style={{ ...emptyStyle, padding: 32 }}><i className="ti ti-bookmark" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />Kayıtlı arama yok</div>
            : aramalar.map((a: any) => (
                <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <i className="ti ti-search" style={{ fontSize: 18, color: '#9ca3af' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...fontBase, fontWeight: 600, fontSize: 13, color: '#1a2e4a' }}>{a.arama_terimi || 'Filtre araması'}</div>
                    <div style={{ ...fontBase, fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {[a.fiyat_min ? `Min ${a.fiyat_min}₺` : '', a.fiyat_max ? `Max ${a.fiyat_max}₺` : ''].filter(Boolean).join(' · ') || 'Tüm sonuçlar'}
                    </div>
                  </div>
                  <button onClick={() => handleAramaSil(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53935' }}><i className="ti ti-trash" /></button>
                </div>
              ))
          }
        </div>
      )}

      {!loading && tab === 'kazancim' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="ti ti-wallet" style={{ fontSize: 24 }} /></div>
            <div>
              <div style={{ ...fontBase, fontSize: 12, color: '#6b7280' }}>Kapbeni Bakiyem</div>
              <div style={{ ...fontBase, fontWeight: 800, fontSize: 26, color: '#1a2e4a' }}>{(kazanc?.bakiye || 0).toLocaleString('tr-TR')} TL</div>
            </div>
          </div>
          {(!kazanc || kazanc.hareketler.length === 0)
            ? <div style={{ ...emptyStyle, padding: 24 }}>Henüz kazanç hareketi yok</div>
            : kazanc.hareketler.map((h: any) => (
                <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ ...fontBase, fontSize: 13, color: '#1a2e4a', fontWeight: 600 }}>{h.aciklama || h.tip}</div>
                    <div style={{ ...fontBase, fontSize: 11, color: '#9ca3af' }}>{h.created_at?.slice(0, 10)}</div>
                  </div>
                  <div style={{ ...fontBase, fontWeight: 700, fontSize: 14, color: Number(h.miktar) >= 0 ? '#15803d' : '#dc2626' }}>{Number(h.miktar) >= 0 ? '+' : ''}{Number(h.miktar).toLocaleString('tr-TR')} TL</div>
                </div>
              ))
          }
        </div>
      )}

      {!loading && tab === 'degerlendirmeler' && (
        <div style={cardStyle}>
          {degStats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ ...fontBase, fontWeight: 800, fontSize: 36, color: '#1a2e4a' }}>{degStats.ortalama || '—'}</div>
              <div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {Array.from({ length: 5 }, (_, j) => (
                    <i key={j} className={`ti ti-star${j < Math.round(degStats.ortalama) ? '-filled' : ''}`} style={{ color: j < Math.round(degStats.ortalama) ? '#f59e0b' : '#d1d5db', fontSize: 18 }} />
                  ))}
                </div>
                <div style={{ ...fontBase, fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{degStats.sayi} değerlendirme</div>
              </div>
            </div>
          )}
          {degerlendirmeler.length === 0
            ? <div style={emptyStyle}><i className="ti ti-star" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />Henüz değerlendirme yok</div>
            : degerlendirmeler.map((d: any, i: number) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {Array.from({ length: 5 }, (_, j) => (
                      <i key={j} className={`ti ti-star${j < d.puan ? '-filled' : ''}`} style={{ color: j < d.puan ? '#f59e0b' : '#d1d5db', fontSize: 14 }} />
                    ))}
                    <span style={{ ...fontBase, fontSize: 11, color: '#9ca3af' }}>{d.yorum_sahibi_ad || d.degerlendiren_ad || 'Anonim'}</span>
                  </div>
                  {d.yorum && <div style={{ ...fontBase, fontSize: 13, color: '#374151' }}>{d.yorum}</div>}
                </div>
              ))
          }
        </div>
      )}

      {!loading && tab === 'dogrulamalar' && (
        <div style={cardStyle}>
          <div style={{ ...fontBase, fontWeight: 700, fontSize: 15, color: '#1a2e4a', marginBottom: 16 }}>Doğrulamalarım</div>
          {[
            { label: 'Telefon Numarası', desc: 'SMS ile doğrulama', done: isGsm, action: !isGsm ? onOpenGsm : undefined, icon: 'ti-device-mobile' },
            { label: 'Kimlik Doğrulama', desc: 'KYC belgesi ile doğrulama', done: isKyc, action: !isKyc ? onOpenKyc : undefined, icon: 'ti-id-badge' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: item.done ? '#f0fdf4' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 20, color: item.done ? '#15803d' : '#9ca3af' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...fontBase, fontWeight: 600, fontSize: 13, color: '#1a2e4a' }}>{item.label}</div>
                <div style={{ ...fontBase, fontSize: 11, color: '#9ca3af' }}>{item.desc}</div>
              </div>
              {item.done
                ? <span style={tagStyle('#15803d', '#f0fdf4')}><i className="ti ti-check" style={{ fontSize: 12 }} />Doğrulandı</span>
                : <button onClick={item.action} style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid #e53935', background: '#fff', color: '#e53935', fontSize: 12, fontWeight: 700, cursor: 'pointer', ...fontBase }}>Doğrula</button>
              }
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'guven' && (
        <div style={cardStyle}>
          <div style={{ ...fontBase, fontWeight: 700, fontSize: 15, color: '#1a2e4a', marginBottom: 20 }}>Güven Puanım</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: 'Kimlik Doğrulama', puan: isKyc ? 30 : 0, max: 30, icon: 'ti-id-badge', color: '#10b981' },
              { label: 'GSM Doğrulama', puan: isGsm ? 20 : 0, max: 20, icon: 'ti-device-mobile', color: '#3b82f6' },
              { label: 'Değerlendirme', puan: degStats ? Math.min(Math.round(degStats.ortalama * 4), 20) : 0, max: 20, icon: 'ti-star', color: '#f59e0b' },
              { label: 'İlan Aktivitesi', puan: ilanlar.length > 0 ? 10 : 0, max: 10, icon: 'ti-package', color: '#e53935' },
              { label: 'Üyelik Süresi', puan: 10, max: 20, icon: 'ti-calendar', color: '#8b5cf6' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 24, color: item.puan > 0 ? item.color : '#d1d5db', display: 'block', marginBottom: 8 }} />
                <div style={{ ...fontBase, fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{item.label}</div>
                <div style={{ ...fontBase, fontSize: 18, fontWeight: 800, color: item.puan > 0 ? item.color : '#d1d5db' }}>
                  {item.puan}<span style={{ fontSize: 11, color: '#9ca3af' }}>/{item.max}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div style={{ ...fontBase, fontSize: 12, color: '#166534' }}>
              Toplam güven puanı: <strong>{(isKyc ? 30 : 0) + (isGsm ? 20 : 0) + 20} / 100</strong>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === 'sikayetlerim' && (
        <div style={cardStyle}>
          <div style={{ ...fontBase, fontWeight: 700, fontSize: 15, color: '#1a2e4a', marginBottom: 16 }}>Şikayetlerim</div>
          {sikayetler.length === 0
            ? <div style={{ ...emptyStyle, padding: 32 }}><i className="ti ti-flag" style={{ fontSize: 36, display: 'block', marginBottom: 10 }} />Henüz şikayet bulunmuyor</div>
            : sikayetler.map((s: any, i: number) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...fontBase, fontWeight: 600, fontSize: 13, color: '#1a2e4a' }}>{s.sikayet_turu}</div>
                    {s.aciklama && <div style={{ ...fontBase, fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.aciklama}</div>}
                    <div style={{ ...fontBase, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{s.created_at?.slice(0, 10)}</div>
                  </div>
                  <span style={s.durum === 'beklemede' ? tagStyle('#92400e', '#fef3c7') : tagStyle('#15803d', '#f0fdf4')}>{s.durum}</span>
                </div>
              ))
          }
        </div>
      )}
      </>)} />
      </FehlerGrenze>
      </main>
    </div>

    {/* Geri Bildirim Ver — Overlay (overnight8) */}
    {geriBildirimOpen && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={(e) => { if (e.target === e.currentTarget) setGeriBildirimOpen(false) }}
      >
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 'min(420px, 92vw)', ...fontBase }}>
          {gbSent ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#15803d' }}>
              <i className="ti ti-circle-check" style={{ fontSize: '3rem' }} />
              <p style={{ margin: '12px 0 0', fontWeight: 600 }}>Geri bildiriminiz iletildi!</p>
            </div>
          ) : (
            <>
              <h3 style={{ margin: '0 0 18px', color: '#1a2e4a', fontSize: '1.2rem', fontWeight: 700 }}>Geri Bildirim Ver</h3>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Kategori</label>
              <select value={gbKategori} onChange={(e) => setGbKategori(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, ...fontBase }}>
                <option value="tesekkur">Teşekkür</option>
                <option value="hata">Hata Bildirimi</option>
                <option value="oneri">Öneri</option>
                <option value="sikayet">Şikayet</option>
              </select>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Konu</label>
              <input value={gbKonu} onChange={(e) => setGbKonu(e.target.value)} placeholder="Kısa başlık" style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, marginBottom: 12, boxSizing: 'border-box', ...fontBase }} />
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Mesajınız</label>
              <textarea value={gbMetin} onChange={(e) => setGbMetin(e.target.value)} rows={4} placeholder="Görüşünüzü yazın..." style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.9rem' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={gonderGeriBildirim} disabled={!gbMetin.trim()} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: gbMetin.trim() ? '#e53935' : '#ccc', color: '#fff', fontWeight: 700, cursor: gbMetin.trim() ? 'pointer' : 'not-allowed' }}>Gönder</button>
                <button onClick={() => setGeriBildirimOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#555', cursor: 'pointer' }}>İptal</button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  )
}
