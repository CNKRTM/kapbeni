import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const FONT = { fontFamily: "'Plus Jakarta Sans', sans-serif" }

const SLIDES = [
  {
    catLabel: 'ARABA',
    catId: 'araba',
    tagline: 'Sıfır mı, İkinci El mi?',
    sub: 'Hayalindeki araca en uygun fiyatla ulaş — güvenli, hızlı, kolay.',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1600&q=85&auto=format&fit=crop',
    imgPos: '60% center',
    gradient: 'linear-gradient(100deg, rgba(10,10,10,0.90) 0%, rgba(10,10,10,0.65) 42%, rgba(0,0,0,0.10) 70%, transparent 100%)',
    accentColor: '#e53935',
  },
  {
    catLabel: 'ELEKTRONİK',
    catId: 'elektronik',
    tagline: 'Teknolojide Akıllı Seçim',
    sub: 'Sıfır kutusunda ya da garantili ikinci el — fark yok, kalite aynı.',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.65) 45%, rgba(15,23,42,0.05) 72%, transparent 100%)',
    accentColor: '#3b82f6',
  },
  {
    catLabel: 'BİLGİSAYAR',
    catId: 'elektronik',
    tagline: 'Güçlü Bilgisayar, Uygun Fiyat',
    sub: 'Laptop, masaüstü, iMac — sıfır veya ikinci el en iyi fiyatla.',
    image: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(10,10,30,0.92) 0%, rgba(10,10,30,0.65) 44%, rgba(0,0,0,0.05) 72%, transparent 100%)',
    accentColor: '#6366f1',
  },
  {
    catLabel: 'LCD TELEVİZYON',
    catId: 'elektronik',
    tagline: 'Sinema Deneyimi Evinizde',
    sub: 'Smart TV, 4K, OLED — ikinci el kalite, yeni fiyatın yarısına.',
    image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(5,5,20,0.93) 0%, rgba(5,5,20,0.65) 44%, rgba(0,0,0,0.08) 72%, transparent 100%)',
    accentColor: '#0ea5e9',
  },
  {
    catLabel: 'TELEFON',
    catId: 'telefon',
    tagline: 'En Son Model, En İyi Fiyat',
    sub: 'Kutu açılmamış ya da az kullanılmış — cep telefonu alışverişi artık kolay.',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(30,10,60,0.92) 0%, rgba(30,10,60,0.65) 44%, rgba(0,0,0,0.05) 70%, transparent 100%)',
    accentColor: '#8b5cf6',
  },
  {
    catLabel: 'EMLAK',
    catId: 'emlak',
    tagline: 'Hayalindeki Yuva Burada',
    sub: 'Kiralık, satılık veya devren — şehrin dört bir yanında en iyi ilanlar.',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(8,40,20,0.92) 0%, rgba(8,40,20,0.65) 44%, rgba(0,0,0,0.08) 70%, transparent 100%)',
    accentColor: '#10b981',
  },
  {
    catLabel: 'SPLİT KLİMA',
    catId: 'ev-yasam',
    tagline: 'Yazı Serin Geçir, Akıllı Seç',
    sub: 'Inverter split klima, duvar tipi, kaset tipi — sıfır veya garantili ikinci el, montaj dahil.',
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(0,25,50,0.93) 0%, rgba(0,25,50,0.65) 44%, rgba(0,0,0,0.08) 70%, transparent 100%)',
    accentColor: '#06b6d4',
  },
  {
    catLabel: 'BEYAZ EŞYA',
    catId: 'ev-yasam',
    tagline: 'Mutfağınızı Yenileyin',
    sub: 'Buzdolabı, çamaşır makinesi, fırın — garantili ikinci el ile tasarruf et.',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center right',
    gradient: 'linear-gradient(100deg, rgba(20,40,20,0.92) 0%, rgba(20,40,20,0.65) 44%, rgba(0,0,0,0.05) 70%, transparent 100%)',
    accentColor: '#22c55e',
  },
  {
    catLabel: 'SPOR AYAKKABISI',
    catId: 'spor',
    tagline: 'Her Adımda Stil & Konfor',
    sub: 'Nike, Adidas, New Balance — orijinal spor ayakkabı, ikinci el fiyatına.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(40,5,5,0.92) 0%, rgba(40,5,5,0.65) 44%, rgba(0,0,0,0.05) 70%, transparent 100%)',
    accentColor: '#ef4444',
  },
  {
    catLabel: 'SAATLER',
    catId: 'spor',
    tagline: 'Zamanı Şıklıkla Tak',
    sub: 'Rolex, Omega, Tag Heuer — lüks ve koleksiyon saatler, güvenle al sat.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(25,20,5,0.93) 0%, rgba(25,20,5,0.65) 44%, rgba(0,0,0,0.08) 70%, transparent 100%)',
    accentColor: '#f59e0b',
  },
  {
    catLabel: 'YEDEK PARÇA',
    catId: 'araba',
    tagline: 'Aracına En Uygun Parça',
    sub: 'Orijinal ve muadil yedek parça — motor, şanzıman, aksesuar hepsi burada.',
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(15,15,15,0.93) 0%, rgba(15,15,15,0.65) 44%, rgba(0,0,0,0.08) 70%, transparent 100%)',
    accentColor: '#f97316',
  },
  {
    catLabel: 'MOD & GİYİM',
    catId: 'giyim',
    tagline: 'Markaları Fırsata Dönüştür',
    sub: 'Yeni sezon koleksiyonlar ve vintage parçalar — stilini bütçenle belirle.',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&q=85&auto=format&fit=crop',
    imgPos: '70% center',
    gradient: 'linear-gradient(100deg, rgba(60,10,30,0.92) 0%, rgba(60,10,30,0.65) 44%, rgba(0,0,0,0.05) 70%, transparent 100%)',
    accentColor: '#ec4899',
  },
  {
    catLabel: 'SPOR & OUTDOOR',
    catId: 'spor',
    tagline: 'Aktif Hayat, Akıllı Harcama',
    sub: 'Bisiklet, fitness ekipmanı, outdoor malzemeleri — ikinci el kalite.',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(10,25,5,0.93) 0%, rgba(10,25,5,0.65) 44%, rgba(0,0,0,0.08) 70%, transparent 100%)',
    accentColor: '#84cc16',
  },
  {
    catLabel: 'EV & YAŞAM',
    catId: 'ev-yasam',
    tagline: 'Evinize Yeni Bir Soluk',
    sub: 'Mobilya, dekorasyon ve ev eşyaları — uygun fiyata, hızlı teslimat.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center right',
    gradient: 'linear-gradient(100deg, rgba(40,25,5,0.92) 0%, rgba(40,25,5,0.65) 44%, rgba(0,0,0,0.08) 70%, transparent 100%)',
    accentColor: '#f97316',
  },
  {
    catLabel: 'TEKNE & YAT',
    catId: 'tekne-yat',
    tagline: 'Denize Aç, Özgürce Keşfet',
    sub: "Küçük tekne, balıkçı botu, kaik — Ege'nin turkuaz koylarında uygun fiyatla sahip ol.",
    image: 'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?w=1600&q=85&auto=format&fit=crop',
    imgPos: 'center',
    gradient: 'linear-gradient(100deg, rgba(0,25,55,0.92) 0%, rgba(0,25,55,0.65) 44%, rgba(0,0,0,0.05) 70%, transparent 100%)',
    accentColor: '#0ea5e9',
  },
]

interface Props {
  onOpenSellModal: () => void
  onExplore: () => void
  onSelectCategory?: (catId: string) => void
}

export default function HeroSlider({ onOpenSellModal, onExplore, onSelectCategory }: Props) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = useCallback((idx: number) => setCurrent(idx), [])
  const next = useCallback(() => setCurrent(i => (i + 1) % SLIDES.length), [])
  const prev = useCallback(() => setCurrent(i => (i - 1 + SLIDES.length) % SLIDES.length), [])

  useEffect(() => {
    if (paused) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [next, paused])

  const slide = SLIDES[current]

  const handleExplore = () => {
    if (onSelectCategory) onSelectCategory(slide.catId)
    else onExplore()
  }

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.22), 0 2px 12px rgba(0,0,0,0.12)',
        height: 260,
        ...FONT,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.catLabel + i}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url('${s.image}')`,
            backgroundSize: 'cover',
            backgroundPosition: s.imgPos,
            transition: 'opacity 1.0s cubic-bezier(0.4,0,0.2,1)',
            opacity: i === current ? 1 : 0,
            zIndex: i === current ? 1 : 0,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: slide.gradient,
          zIndex: 2,
          transition: 'background 1.0s ease',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 48px',
          maxWidth: 600,
        }}
      >
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            color: slide.accentColor, textTransform: 'uppercase' as const,
            background: `${slide.accentColor}22`,
            border: `1px solid ${slide.accentColor}55`,
            borderRadius: 6, padding: '3px 9px', backdropFilter: 'blur(4px)',
          }}>
            {slide.catLabel}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.50)',
            color: '#86efac', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.06em', borderRadius: 6, padding: '3px 9px',
            backdropFilter: 'blur(4px)',
          }}>
            ✦ YENİ
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(251,146,60,0.18)', border: '1px solid rgba(251,146,60,0.50)',
            color: '#fdba74', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.06em', borderRadius: 6, padding: '3px 9px',
            backdropFilter: 'blur(4px)',
          }}>
            ♻ İKİNCİ EL
          </span>
        </div>

        <h1 style={{
          color: '#fff', fontSize: 26, fontWeight: 900, lineHeight: 1.15,
          letterSpacing: '-0.02em', margin: '0 0 8px',
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {slide.tagline}
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: 500,
          lineHeight: 1.55, margin: '0 0 18px',
          textShadow: '0 1px 6px rgba(0,0,0,0.4)', maxWidth: 420,
        }}>
          {slide.sub}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleExplore}
            style={{
              background: '#e53935', color: '#fff', border: 'none', borderRadius: 50,
              padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(229,57,53,0.45)', letterSpacing: '0.01em',
              transition: 'all 0.2s', ...FONT,
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#c62828'; el.style.transform = 'scale(1.04)' }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#e53935'; el.style.transform = 'scale(1)' }}
          >
            İlanları Gör →
          </button>
          <button
            onClick={onOpenSellModal}
            style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              border: '1.5px solid rgba(255,255,255,0.38)', borderRadius: 50,
              padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(6px)', letterSpacing: '0.01em', transition: 'all 0.2s', ...FONT,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.26)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
          >
            + İlan Ver
          </button>
        </div>
      </div>

      <button
        onClick={prev}
        className="hero-slider-arrow"
        aria-label="Önceki"
        style={{
          position: 'absolute', bottom: 14, left: 14, zIndex: 10,
          width: 25, height: 25, borderRadius: '50%',
          background: 'transparent', border: '1.5px solid rgba(255,255,255,0.0)',
          color: 'rgba(255,255,255,0)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', transition: 'all 0.25s ease',
        }}
      >
        <ChevronLeft size={13} />
      </button>

      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: 5, alignItems: 'center',
      }}>
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Slayt ${i + 1}`}
            style={{
              width: i === current ? 20 : 6, height: 6, borderRadius: 99,
              background: i === current ? '#fff' : 'rgba(255,255,255,0.40)',
              border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.35s ease',
            }}
          />
        ))}
      </div>

      <button
        onClick={next}
        className="hero-slider-arrow"
        aria-label="Sonraki"
        style={{
          position: 'absolute', bottom: 14, right: 14, zIndex: 10,
          width: 25, height: 25, borderRadius: '50%',
          background: 'transparent', border: '1.5px solid rgba(255,255,255,0.0)',
          color: 'rgba(255,255,255,0)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', transition: 'all 0.25s ease',
        }}
      >
        <ChevronRight size={13} />
      </button>
    </section>
  )
}
