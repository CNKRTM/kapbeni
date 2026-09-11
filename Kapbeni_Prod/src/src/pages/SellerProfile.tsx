import { useState, useEffect } from 'react'
import { saticiApi, Listing } from '../api'
import ProductCard from '../components/ProductCard'

interface Props {
  sellerId: string
  onBack: () => void
  onSelectProduct: (l: Listing) => void
}

export default function SellerProfile({ sellerId, onBack, onSelectProduct }: Props) {
  const [profil, setProfil] = useState<any>(null)
  const [ilanlar, setIlanlar] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      saticiApi.getProfil(sellerId),
      saticiApi.getIlanlar(sellerId),
    ]).then(([p, d]: [any, any]) => {
      setProfil(p)
      const arr: Listing[] = ((d && d.ilanlar) || []).map((l: any) => ({
        id: String(l.uuid || l.id), title: l.baslik || '',
        price: Number(l.fiyat) || 0, category: l.kategori_ad || '', categorySlug: l.kategori_slug || '',
        location: [l.ilce, l.sehir].filter(Boolean).join(', '),
        date: 'Yeni',
        image: l.ana_foto || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
        description: l.aciklama || '', sellerName: p?.ad || '',
        sellerPhone: '', isFavorite: false, condition: 'İkinci El',
      }))
      setIlanlar(arr)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [sellerId])

  const font = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, ...font, color: '#9ca3af' }}>Yükleniyor...</div>
  if (!profil) return <div style={{ textAlign: 'center', padding: 60, ...font, color: '#9ca3af' }}>Kullanıcı bulunamadı</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 0' }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', ...font, fontSize: 13 }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />Geri
      </button>

      <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #f0f0f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff5f5', color: '#e53935', fontWeight: 800, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {profil.avatar_url
              ? <img src={profil.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : (profil.ad?.[0] || '?')}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ ...font, fontWeight: 700, fontSize: 18, color: '#1a2e4a' }}>{profil.ad}</span>
              {profil.kyc_onaylandi && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#15803d', fontSize: 11, fontWeight: 700, ...font }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 11 }} />Doğrulandı
                </span>
              )}
              {profil.hesap_tipi === 'kurumsal' && profil.firma_adi && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, ...font }}>
                  <i className="ti ti-building" style={{ fontSize: 11 }} />{profil.firma_adi}
                </span>
              )}
            </div>
            {profil.sehir && <div style={{ ...font, fontSize: 12, color: '#6b7280', marginTop: 4 }}><i className="ti ti-map-pin" style={{ fontSize: 12 }} /> {profil.sehir}</div>}
            {profil.hakkinda && <div style={{ ...font, fontSize: 13, color: '#374151', marginTop: 8 }}>{profil.hakkinda}</div>}
            <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
              <div>
                <div style={{ ...font, fontWeight: 800, fontSize: 20, color: '#1a2e4a' }}>{profil.ilan_sayisi}</div>
                <div style={{ ...font, fontSize: 11, color: '#9ca3af' }}>Aktif İlan</div>
              </div>
              {profil.degerlendirme_sayisi > 0 && (
                <div>
                  <div style={{ ...font, fontWeight: 800, fontSize: 20, color: '#1a2e4a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="ti ti-star-filled" style={{ color: '#f59e0b', fontSize: 18 }} />{profil.degerlendirme_ortalama}
                  </div>
                  <div style={{ ...font, fontSize: 11, color: '#9ca3af' }}>{profil.degerlendirme_sayisi} Değerlendirme</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {profil.son_degerlendirmeler?.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <div style={{ ...font, fontWeight: 700, fontSize: 12, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Son Değerlendirmeler</div>
            {profil.son_degerlendirmeler.map((d: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
                  {Array.from({ length: 5 }, (_, j) => (
                    <i key={j} className={`ti ti-star${j < d.puan ? '-filled' : ''}`} style={{ color: j < d.puan ? '#f59e0b' : '#d1d5db', fontSize: 13 }} />
                  ))}
                </div>
                {d.yorum && <div style={{ ...font, fontSize: 12.5, color: '#374151' }}>{d.yorum}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...font, fontWeight: 700, fontSize: 14, color: '#1a2e4a', marginBottom: 12 }}>
        {profil.ad} İlanları ({ilanlar.length})
      </div>
      {ilanlar.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', ...font }}>Aktif ilan yok</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {ilanlar.map(l => <ProductCard key={l.id} listing={l} isGridView={true} onSelect={() => onSelectProduct(l)} onToggleFavorite={() => {}} />)}
          </div>
      }
    </div>
  )
}
