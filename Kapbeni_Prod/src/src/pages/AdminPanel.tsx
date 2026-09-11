import { useState, useEffect } from 'react'
import { ve } from '../api'
import { useAuth } from '../context/AuthContext'

type AdminTab =
  | 'istatistik'
  | 'ilanlar'
  | 'boost'
  | 'kullanicilar'
  | 'sikayetler'
  | 'kyc'
  | 'teklifler'
  | 'payments'
  | 'paketler'
  | 'coupons'
  | 'destek'
  | 'ilan-takip'
  | 'geri-bildirimler'

const font: React.CSSProperties = { fontFamily: "\'Plus Jakarta Sans\', sans-serif" }
const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', ...font,
  fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #f0f0f0',
}
const td: React.CSSProperties = { padding: '8px 12px', ...font, fontSize: 12, color: '#374151' }

export default function AdminPanel() {
  const { user } = useAuth()
  const [tab, setTab] = useState<AdminTab>('istatistik')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [ncCode, setNcCode] = useState('')
  const [ncType, setNcType] = useState('percent')
  const [ncVal, setNcVal] = useState('')
  const [boostIlanId, setBoostIlanId] = useState('')
  const [boostType, setBoostType] = useState('onecikan')
  const [boostGun, setBoostGun] = useState('7')
  const [pkIsim, setPkIsim] = useState('')
  const [pkFiyat, setPkFiyat] = useState('')
  const [pkHak, setPkHak] = useState('')
  const [pkGun, setPkGun] = useState('30')
  const [pkTip, setPkTip] = useState('bireysel')
  const [destekDurum, setDestekDurum] = useState('beklemede')

  const u = user as any
  if (!u || (u.rol !== 'admin' && !u.is_admin && u.role !== 'admin')) {
    return <div style={{ textAlign: 'center', padding: 80, ...font, color: '#9ca3af' }}>Erişim reddedildi</div>
  }

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'istatistik', label: 'İstatistik', icon: 'ti-chart-bar' },
    { id: 'ilanlar', label: 'İlanlar', icon: 'ti-package' },
    { id: 'boost', label: 'Öne Çıkarma', icon: 'ti-star' },
    { id: 'kullanicilar', label: 'Kullanıcılar', icon: 'ti-users' },
    { id: 'sikayetler', label: 'Şikayetler', icon: 'ti-flag' },
    { id: 'kyc', label: 'KYC Kuyruğu', icon: 'ti-id-badge' },
    { id: 'teklifler', label: 'Teklifler', icon: 'ti-tag' },
    { id: 'payments', label: 'Ödemeler', icon: 'ti-credit-card' },
    { id: 'paketler', label: 'Paket Yönetimi', icon: 'ti-gift' },
    { id: 'coupons', label: 'Kuponlar', icon: 'ti-ticket' },
    { id: 'destek', label: 'Destek Talepleri', icon: 'ti-headset' },
    { id: 'ilan-takip', label: 'Takip', icon: 'ti-heart' },
    { id: 'geri-bildirimler', label: 'Geri Bildirim', icon: 'ti-message-report' },
  ]

  const reload = (overridePath?: string) => {
    setLoading(true); setData(null)
    const endpoints: Record<AdminTab, string> = {
      istatistik: '/admin/istatistik',
      ilanlar: '/admin/ilanlar?sayfa=1&limit=30',
      boost: '/admin/boost',
      kullanicilar: '/admin/kullanicilar?sayfa=1&limit=30',
      sikayetler: '/admin/sikayetler?durum=beklemede',
      kyc: '/admin/kyc?durum=beklemede',
      teklifler: '/admin/teklifler',
      payments: '/admin/payments',
      paketler: '/admin/paketler',
      coupons: '/admin/coupons',
      destek: `/admin/destek?durum=${destekDurum}`,
      'ilan-takip': '/admin/ilan-takip',
      'geri-bildirimler': '/admin/geri-bildirimler',
    }
    ve.get<any>(overridePath ?? endpoints[tab]).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }
  useEffect(reload, [tab])
  useEffect(() => { if (tab === 'destek') reload(`/admin/destek?durum=${destekDurum}`) }, [destekDurum])

  const btn = (bg: string, color: string, border: string): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 6, border: `1px solid ${border}`,
    background: bg, color, fontSize: 11, cursor: 'pointer', ...font, fontWeight: 600,
  })
  const tableWrap: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'auto' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 0' }}>
      <div style={{ ...font, fontWeight: 800, fontSize: 20, color: '#1a2e4a', marginBottom: 16 }}>
        <i className="ti ti-shield" style={{ marginRight: 8 }} />Admin Paneli
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f9fafb', borderRadius: 12, padding: 4, overflowX: 'auto' }} className="hide-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 9, border: 'none',
              background: tab === t.id ? '#1a2e4a' : 'transparent', color: tab === t.id ? '#fff' : '#6b7280',
              ...font, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 14 }} />{t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', ...font }}>Yükleniyor...</div>}

      {/* İSTATİSTİK */}
      {!loading && tab === 'istatistik' && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Toplam Kullanıcı', value: data.kullanici_sayisi, icon: 'ti-users', color: '#3b82f6' },
            { label: 'Aktif İlan', value: data.aktif_ilan, icon: 'ti-package', color: '#10b981' },
            { label: 'Boost Aktif', value: data.boost_sayisi, icon: 'ti-star', color: '#f59e0b' },
            { label: 'Bugün Yeni Üye', value: data.bugun_uye, icon: 'ti-user-plus', color: '#8b5cf6' },
            { label: 'Bekleyen Şikayet', value: data.bekleyen_sikayet, icon: 'ti-flag', color: '#ef4444' },
            { label: 'Bekleyen KYC', value: data.bekleyen_kyc, icon: 'ti-id-badge', color: '#f59e0b' },
            { label: 'Bekleyen Destek', value: data.bekleyen_destek, icon: 'ti-headset', color: '#6366f1' },
            { label: 'Toplam Teklif', value: data.toplam_teklif, icon: 'ti-tag', color: '#14b8a6' },
          ].map((stat, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #f0f0f0', textAlign: 'center' }}>
              <i className={`ti ${stat.icon}`} style={{ fontSize: 28, color: stat.color, display: 'block', marginBottom: 8 }} />
              <div style={{ ...font, fontWeight: 800, fontSize: 22, color: '#1a2e4a' }}>{stat.value ?? '—'}</div>
              <div style={{ ...font, fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* İLANLAR */}
      {!loading && tab === 'ilanlar' && data && (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}><tr>{['İlan', 'Kategori', 'Şehir', 'Fiyat', 'Durum', 'İşlem'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data.ilanlar || []).map((l: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ ...td, color: '#1a2e4a', maxWidth: 200 }}>{l.baslik}</td>
                  <td style={td}>{l.kategori_ad}</td>
                  <td style={td}>{l.sehir}</td>
                  <td style={{ ...td, color: '#1a2e4a', fontWeight: 700 }}>₺{l.fiyat}</td>
                  <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...font, background: l.ilan_durum === 'aktif' ? '#f0fdf4' : '#fef2f2', color: l.ilan_durum === 'aktif' ? '#15803d' : '#dc2626' }}>{l.ilan_durum}</span></td>
                  <td style={{ ...td, display: 'flex', gap: 6 }}>
                    {l.ilan_durum === 'aktif' && <button onClick={() => ve.patch(`/admin/ilanlar/${l.uuid}/durum`, { ilan_durum: 'pasif' }).then(() => reload())} style={btn('#fef2f2','#dc2626','#fca5a5')}>Pasif</button>}
                    {l.ilan_durum === 'pasif' && <button onClick={() => ve.patch(`/admin/ilanlar/${l.uuid}/durum`, { ilan_durum: 'aktif' }).then(() => reload())} style={btn('#f0fdf4','#15803d','#bbf7d0')}>Aktif</button>}
                    <button onClick={() => { if(window.confirm('Sil?')) ve.del(`/admin/ilanlar/${l.uuid}`).then(() => reload()) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><i className="ti ti-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BOOST */}
      {!loading && tab === 'boost' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #f0f0f0' }}>
            <div style={{ ...font, fontWeight: 700, fontSize: 14, color: '#1a2e4a', marginBottom: 14 }}><i className="ti ti-star" style={{ marginRight: 6, color: '#f59e0b' }} />İlan Öne Çıkar</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={boostIlanId} onChange={e => setBoostIlanId(e.target.value)} placeholder="İlan UUID" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13, width: 260 }} />
              <select value={boostType} onChange={e => setBoostType(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13 }}>
                <option value="onecikan">⭐ Öne Çıkan</option>
                <option value="super_ilan">⭐ Süper İlan</option>
                <option value="buyuk_ilan">🏠 Büyük İlan</option>
              </select>
              <select value={boostGun} onChange={e => setBoostGun(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13 }}>
                {['3','7','14','30'].map(g => <option key={g} value={g}>{g} Gün</option>)}
              </select>
              <button onClick={() => { if(!boostIlanId.trim()) return; ve.post('/admin/boost', { ilan_uuid: boostIlanId.trim(), boost_type: boostType, sure_gun: Number(boostGun) }).then(() => { setBoostIlanId(''); reload() }) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, cursor: 'pointer', ...font, fontSize: 13 }}>
                <i className="ti ti-plus" /> Öne Çıkar
              </button>
            </div>
          </div>
          {Array.isArray(data) && (
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}><tr>{['İlan Başlığı','UUID','Boost Türü','Bitiş',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.map((b: any) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, color: '#1a2e4a', maxWidth: 220 }}>{b.baslik || b.ilan_baslik}</td>
                      <td style={{ ...td, fontSize: 10, color: '#9ca3af' }}>{b.ilan_uuid || b.uuid}</td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...font, background: b.boost_type === 'super_ilan' ? '#fef3c7' : '#eff6ff', color: b.boost_type === 'super_ilan' ? '#92400e' : '#1d4ed8' }}>{b.boost_type === 'super_ilan' ? '⭐ Süper' : b.boost_type === 'buyuk_ilan' ? '🏠 Büyük' : '⭐ Öne Çıkan'}</span></td>
                      <td style={{ ...td, fontSize: 11, color: '#9ca3af' }}>{b.bitis_tarihi ? new Date(b.bitis_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                      <td style={td}><button onClick={() => ve.del(`/admin/boost/${b.id}`).then(() => reload())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><i className="ti ti-x" /></button></td>
                    </tr>
                  ))}
                  {data.length === 0 && <tr><td style={td} colSpan={5}>Aktif öne çıkarma yok</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KULLANICILAR */}
      {!loading && tab === 'kullanicilar' && data && (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}><tr>{['Ad','Email','Tip','KYC','GSM','İşlem'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data.kullanicilar || []).map((k: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ ...td, color: '#1a2e4a' }}>{k.ad} {k.soyad}</td>
                  <td style={td}>{k.email}</td>
                  <td style={{ ...td, color: k.hesap_tipi === 'kurumsal' ? '#1d4ed8' : '#6b7280' }}>{k.hesap_tipi || 'bireysel'}</td>
                  <td style={td}>{k.kyc_durum === 'onaylandi' ? <i className="ti ti-check" style={{ color: '#15803d' }} /> : <i className="ti ti-x" style={{ color: '#dc2626' }} />}</td>
                  <td style={td}>{k.phone_verified ? <i className="ti ti-check" style={{ color: '#15803d' }} /> : <i className="ti ti-x" style={{ color: '#dc2626' }} />}</td>
                  <td style={td}>{k.aktif !== false
                    ? <button onClick={() => ve.patch(`/admin/kullanicilar/${k.id}/durum`, { aktif: false }).then(() => reload())} style={btn('#fef2f2','#dc2626','#fca5a5')}>Engelle</button>
                    : <button onClick={() => ve.patch(`/admin/kullanicilar/${k.id}/durum`, { aktif: true }).then(() => reload())} style={btn('#f0fdf4','#15803d','#bbf7d0')}>Aktifleştir</button>
                  }</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ŞİKAYETLER */}
      {!loading && tab === 'sikayetler' && data && (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}><tr>{['İlan','Tür','Açıklama','Durum','İşlem'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data.sikayetler || []).map((s: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ ...td, color: '#1a2e4a' }}>#{s.ilan_id}</td>
                  <td style={td}>{s.sikayet_turu}</td>
                  <td style={{ ...td, maxWidth: 220 }}>{s.aciklama}</td>
                  <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...font, background: s.durum === 'beklemede' ? '#fef3c7' : '#f0fdf4', color: s.durum === 'beklemede' ? '#92400e' : '#15803d' }}>{s.durum}</span></td>
                  <td style={td}>{s.durum === 'beklemede' && <button onClick={() => ve.patch(`/admin/sikayetler/${s.id}`, { durum: 'incelendi' }).then(() => reload())} style={btn('#f0fdf4','#15803d','#bbf7d0')}>İncelendi</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* KYC */}
      {!loading && tab === 'kyc' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(data.list || []).length === 0 && <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', ...font }}><i className="ti ti-id-badge" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />Bekleyen KYC yok</div>}
          {(data.list || []).map((k: any, i: number) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...font, fontWeight: 700, fontSize: 13, color: '#1a2e4a' }}>{k.ad} {k.soyad}</div>
                <div style={{ ...font, fontSize: 11, color: '#6b7280' }}>{k.email}</div>
              </div>
              {k.belge_url && <a href={k.belge_url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#f9fafb', color: '#374151', fontSize: 12, textDecoration: 'none' }}>Belge</a>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => ve.patch(`/admin/kyc/${k.id}`, { durum: 'onaylandi' }).then(() => reload())} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 12, cursor: 'pointer', fontWeight: 700, ...font }}>Onayla</button>
                <button onClick={() => ve.patch(`/admin/kyc/${k.id}`, { durum: 'reddedildi' }).then(() => reload())} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 700, ...font }}>Reddet</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TEKLİFLER */}
      {!loading && tab === 'teklifler' && (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}><tr>{['İlan','Alıcı','Teklif','Asıl Fiyat','Mesaj','Durum','Tarih'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {Array.isArray(data) && data.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...td, color: '#1a2e4a', maxWidth: 180 }}>{t.ilan_baslik || `#${t.ilan_id}`}</td>
                  <td style={td}>{t.alici_ad || t.alici_email || '—'}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#e53935' }}>{Number(t.teklif_fiyat).toLocaleString('tr-TR')} ₺</td>
                  <td style={{ ...td, fontSize: 11, color: '#9ca3af' }}>{Number(t.ilan_fiyat || 0).toLocaleString('tr-TR')} ₺</td>
                  <td style={{ ...td, maxWidth: 160, color: '#6b7280' }}>{t.mesaj || '—'}</td>
                  <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, ...font, background: t.status === 'kabul' ? '#f0fdf4' : t.status === 'reddedildi' ? '#fef2f2' : '#fef3c7', color: t.status === 'kabul' ? '#15803d' : t.status === 'reddedildi' ? '#dc2626' : '#92400e' }}>{t.status === 'kabul' ? 'Kabul' : t.status === 'reddedildi' ? 'Reddedildi' : 'Bekliyor'}</span></td>
                  <td style={{ ...td, fontSize: 11, color: '#9ca3af' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('tr-TR') : '—'}</td>
                </tr>
              ))}
              {(!Array.isArray(data) || data.length === 0) && <tr><td style={td} colSpan={7}>Teklif kaydı yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ÖDEMELER */}
      {!loading && tab === 'payments' && Array.isArray(data) && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Kullanıcı','İlan','Tutar','Paket','Durum','Tarih'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={td}>{p.ad_soyad || p.email}</td>
                  <td style={td}>{p.ilan_baslik || (p.ilan_numarasi ? `#${p.ilan_numarasi}` : '—')}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{Number(p.amount).toLocaleString('tr-TR')} TL</td>
                  <td style={td}>{p.payment_type}</td>
                  <td style={td}><span style={{ ...font, fontSize: 11, fontWeight: 700, color: p.status === 'success' ? '#15803d' : p.status === 'failed' ? '#dc2626' : '#b45309' }}>{p.status}</span></td>
                  <td style={{ ...td, fontSize: 11, color: '#9ca3af' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('tr-TR') : ''}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td style={td} colSpan={6}>Ödeme kaydı yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* PAKET YÖNETİMİ */}
      {!loading && tab === 'paketler' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #f0f0f0' }}>
            <div style={{ ...font, fontWeight: 700, fontSize: 14, color: '#1a2e4a', marginBottom: 14 }}><i className="ti ti-gift" style={{ marginRight: 6, color: '#e53935' }} />Yeni Paket Ekle</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={pkIsim} onChange={e => setPkIsim(e.target.value)} placeholder="Paket Adı" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13, width: 160 }} />
              <input value={pkFiyat} onChange={e => setPkFiyat(e.target.value)} type="number" placeholder="Fiyat (₺)" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13, width: 110 }} />
              <input value={pkHak} onChange={e => setPkHak(e.target.value)} type="number" placeholder="İlan Hakkı" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13, width: 110 }} />
              <select value={pkGun} onChange={e => setPkGun(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13 }}>
                {['7','14','30','60','90','180','365'].map(g => <option key={g} value={g}>{g} Gün</option>)}
              </select>
              <select value={pkTip} onChange={e => setPkTip(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13 }}>
                <option value="bireysel">Bireysel</option>
                <option value="kurumsal">Kurumsal</option>
              </select>
              <button onClick={() => { if(!pkIsim||!pkFiyat||!pkHak) return; ve.post('/admin/paketler', { isim: pkIsim, fiyat: Number(pkFiyat), ilan_hakki: Number(pkHak), sure_gun: Number(pkGun), hesap_tipi: pkTip }).then(() => { setPkIsim(''); setPkFiyat(''); setPkHak(''); reload() }) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontWeight: 700, cursor: 'pointer', ...font, fontSize: 13 }}>
                <i className="ti ti-plus" /> Ekle
              </button>
            </div>
          </div>
          {Array.isArray(data) && (
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}><tr>{['Paket Adı','Fiyat','İlan Hakkı','Süre','Tip','Abonelik',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ ...td, color: '#1a2e4a', fontWeight: 600 }}>{p.isim}</td>
                      <td style={{ ...td, color: '#e53935', fontWeight: 700 }}>{Number(p.fiyat).toLocaleString('tr-TR')} ₺</td>
                      <td style={td}>{p.ilan_hakki}</td>
                      <td style={td}>{p.sure_gun} gün</td>
                      <td style={{ ...td, color: p.hesap_tipi === 'kurumsal' ? '#1d4ed8' : '#6b7280' }}>{p.hesap_tipi}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{p.abone_sayisi || 0}</td>
                      <td style={td}><button onClick={() => ve.del(`/admin/paketler/${p.id}`).then(() => reload())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><i className="ti ti-trash" /></button></td>
                    </tr>
                  ))}
                  {data.length === 0 && <tr><td style={td} colSpan={7}>Paket yok</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KUPONLAR */}
      {!loading && tab === 'coupons' && Array.isArray(data) && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={ncCode} onChange={e => setNcCode(e.target.value.toUpperCase())} placeholder="KOD" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13, width: 120 }} />
            <select value={ncType} onChange={e => setNcType(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13 }}>
              <option value="percent">Yüzde (%)</option>
              <option value="fixed">Sabit (TL)</option>
            </select>
            <input value={ncVal} onChange={e => setNcVal(e.target.value)} type="number" placeholder="Değer" style={{ padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, ...font, fontSize: 13, width: 100 }} />
            <button onClick={() => { if(ncCode && Number(ncVal) > 0) ve.post('/admin/coupons', { code: ncCode, name: ncCode, discount_type: ncType, discount_value: Number(ncVal), applicable_to: 'all' }).then(() => { setNcCode(''); setNcVal(''); reload() }) }}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontWeight: 700, cursor: 'pointer', ...font, fontSize: 13 }}>
              <i className="ti ti-plus" /> Kupon Ekle
            </button>
          </div>
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Kod','İndirim','Uygulama','Kullanım',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((k: any) => (
                  <tr key={k.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}><code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{k.code}</code></td>
                    <td style={{ ...td, color: '#e53935', fontWeight: 700 }}>{k.discount_type === 'percent' ? `%${k.discount_value}` : `${k.discount_value} TL`}</td>
                    <td style={td}>{k.applicable_to}</td>
                    <td style={td}>{k.use_count || 0}{k.max_uses ? `/${k.max_uses}` : ''}</td>
                    <td style={td}><button onClick={() => ve.del(`/admin/coupons/${k.id}`).then(() => reload())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53935' }}><i className="ti ti-trash" /></button></td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td style={td} colSpan={5}>Kupon yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DESTEK TALEPLERİ */}
      {!loading && tab === 'destek' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['beklemede','inceleniyor','cozuldu','kapandi'].map(d => (
              <button key={d} onClick={() => setDestekDurum(d)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', ...font, fontSize: 12, fontWeight: 600, background: destekDurum === d ? '#1a2e4a' : '#f0f0f0', color: destekDurum === d ? '#fff' : '#555' }}>
                {d === 'beklemede' ? 'Beklemede' : d === 'inceleniyor' ? 'İnceleniyor' : d === 'cozuldu' ? 'Çözüldü' : 'Kapandı'}
              </button>
            ))}
          </div>
          {Array.isArray(data) && data.length === 0 && <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', ...font }}><i className="ti ti-headset" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />Bu durumda destek talebi yok</div>}
          {Array.isArray(data) && data.map((t: any) => (
            <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ ...font, fontWeight: 700, fontSize: 13, color: '#1a2e4a' }}>{t.konu || t.kategori || 'Destek Talebi'}</div>
                  <div style={{ ...font, fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{t.email} · {t.created_at ? new Date(t.created_at).toLocaleDateString('tr-TR') : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {t.durum === 'beklemede' && <button onClick={() => ve.patch(`/admin/destek/${t.id}`, { durum: 'inceleniyor' }).then(() => reload())} style={btn('#eff6ff','#1d4ed8','#bfdbfe')}>İncele</button>}
                  {(t.durum === 'beklemede' || t.durum === 'inceleniyor') && <button onClick={() => ve.patch(`/admin/destek/${t.id}`, { durum: 'cozuldu' }).then(() => reload())} style={btn('#f0fdf4','#15803d','#bbf7d0')}>Çözüldü</button>}
                </div>
              </div>
              <p style={{ ...font, fontSize: 12, color: '#374151', margin: 0 }}>{t.mesaj || t.aciklama}</p>
            </div>
          ))}
          {data === null && <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', ...font }}><i className="ti ti-headset" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />API endpoint henüz aktif değil</div>}
        </div>
      )}

      {/* İLAN TAKİP */}
      {!loading && tab === 'ilan-takip' && Array.isArray(data) && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['İlan','İlan No','Takipçi'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ ...td, color: '#1a2e4a' }}>{r.baslik}</td>
                  <td style={{ ...td, fontSize: 11, color: '#9ca3af' }}>{r.ilan_numarasi ? `#${r.ilan_numarasi}` : '—'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{r.takipci_sayisi}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td style={td} colSpan={3}>Kayıt yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* GERİ BİLDİRİMLER */}
      {!loading && tab === 'geri-bildirimler' && Array.isArray(data) && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Kategori','Konu','Mesaj','E-posta','Tarih'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.map((g: any) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={td}>{g.kategori}</td>
                  <td style={td}>{g.konu}</td>
                  <td style={{ ...td, maxWidth: 260 }}>{g.mesaj}</td>
                  <td style={{ ...td, fontSize: 11 }}>{g.email}</td>
                  <td style={{ ...td, fontSize: 11, color: '#9ca3af' }}>{g.created_at ? new Date(g.created_at).toLocaleDateString('tr-TR') : ''}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td style={td} colSpan={5}>Geri bildirim yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
