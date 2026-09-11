// CategoryNav — KapBeni v14
// GLOBAL ICON RULE: Tabler Icons webfont — ALWAYS both classes: "ti ti-icon-name"
// Icon circle style: 38-42px, background:#fff, box-shadow: 2px 3px 10px rgba(26,46,74,.14)
// Active color: #e53935 | Base icon color: #1a2e4a
//
// STICKY FIX: Navbar height is 87px (mobile) / 91px (desktop).
// CategoryNav must stick at that offset so it never overlaps the logo.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useKategoriAgac, mitAnzahl, type Category } from '../data/kategoriAgac'

// DB-Slugs. Fehlt einer (z.B. weil umbenannt), wird mit weiteren
// Hauptkategorien aufgefuellt — die Leiste bleibt so immer vollstaendig.
const PILL_CATEGORY_IDS = [
  'araba', 'elektronik', 'telefon', 'giyim-aksesuar',
  'ev-yasam', 'spor-outdoor', 'anne-bebek-oyuncak', 'motosiklet',
]
const PILL_ANZAHL = 8

interface Props {
  selectedCategory: string | null
  onSelectCategory: (catId: string | null) => void
}

function isMainCatActive(mainId: string, selected: string | null, kats: Category[]): boolean {
  if (!selected) return false
  if (selected === mainId) return true
  const cat = kats.find(c => c.id === mainId)
  return !!cat?.sub.some(s => s.id === selected)
}

export default function CategoryNav({ selectedCategory, onSelectCategory }: Props) {
  const { kategoriler } = useKategoriAgac()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hoveredMain, setHoveredMain] = useState<string>('')
  const menuRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
        barRef.current && !barRef.current.contains(e.target as Node)) {
      setMenuOpen(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  useEffect(() => {
    if (!hoveredMain && kategoriler.length) setHoveredMain(kategoriler[0].id)
  }, [kategoriler, hoveredMain])

  useEffect(() => {
    if (selectedCategory) {
      const main = kategoriler.find(c =>
        c.id === selectedCategory || c.sub.some(s => s.id === selectedCategory)
      )
      if (main) setHoveredMain(main.id)
    }
  }, [selectedCategory, kategoriler])

  const gewuenscht = PILL_CATEGORY_IDS
    .map(id => kategoriler.find(c => c.id === id))
    .filter(Boolean) as Category[]
  const rest = kategoriler.filter(c => !gewuenscht.some(g => g.id === c.id))
  const pillCategories = [...gewuenscht, ...rest].slice(0, PILL_ANZAHL)

  const activeSubs = kategoriler.find(c => c.id === hoveredMain)?.sub ?? []

  const handlePillClick = (catId: string) => {
    // Hauptkategorie-Pill → immer zur Kategorie-Seite navigieren (kein Toggle-off)
    onSelectCategory(catId)
    setMenuOpen(false)
  }

  const handleMainSelect = (catId: string) => {
    onSelectCategory(catId)
    setMenuOpen(false)
  }

  const handleSubSelect = (subId: string) => {
    onSelectCategory(subId)
    setMenuOpen(false)
  }

  return (
    <>
      {/* ─── PILL BAR — sticky below navbar ─────────────────────── */}
      <div id="kapbeni-category-bar" ref={barRef}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 16px',
            height: 46,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
          className="hide-scrollbar"
        >
          <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', flexWrap: 'nowrap' }}>
            {pillCategories.map(cat => {
              const active = isMainCatActive(cat.id, selectedCategory, kategoriler)
              return (
                <button
                  key={cat.id}
                  onClick={() => handlePillClick(cat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 12px',
                    borderRadius: 20,
                    border: active ? '1.5px solid #e53935' : '1.5px solid #e8e8e8',
                    background: active ? '#fff5f5' : '#fff',
                    color: active ? '#e53935' : '#374151',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all .15s',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  <i
                    className={`ti ${cat.icon}`}
                    style={{ fontSize: 14, color: active ? '#e53935' : '#6b7280', lineHeight: 1 }}
                  />
                  {mitAnzahl(cat.label, cat.adet)}
                </button>
              )
            })}
          </div>

          <div style={{ width: 1, height: 24, background: '#e8e8e8', flexShrink: 0 }} />

          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 20,
              border: menuOpen ? '1.5px solid #e53935' : '1.5px solid #d1d5db',
              background: menuOpen ? '#fff5f5' : '#f9fafb',
              color: menuOpen ? '#e53935' : '#374151',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all .15s',
              lineHeight: 1,
            }}
          >
            <i className="ti ti-layout-grid" style={{ fontSize: 14, color: menuOpen ? '#e53935' : '#6b7280' }} />
            Tüm Kategoriler
            <i
              className={menuOpen ? 'ti ti-chevron-up' : 'ti ti-chevron-down'}
              style={{ fontSize: 11, color: menuOpen ? '#e53935' : '#9ca3af' }}
            />
          </button>
        </div>
      </div>

      {/* ─── MEGA MENU ────────────────────────────────────────────── */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 98,
              background: 'rgba(26,46,74,0.18)',
            }}
          />

          {/* Menu panel — display:flex + height:'100%' so children can scroll */}
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 1280,
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 120px)',
              overflow: 'hidden',
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderTop: 'none',
              borderRadius: '0 0 16px 16px',
              boxShadow: '0 20px 48px rgba(26,46,74,.20), 0 4px 16px rgba(0,0,0,.10)',
            }}
            className="kapbeni-mega-menu-panel"
          >
            {/* Inner row — takes all available height */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* LEFT: Category list — scrollable */}
              <div
                style={{
                  width: 220,
                  minWidth: 180,
                  flexShrink: 0,
                  minHeight: 0,
                  borderRight: '1px solid #f3f4f6',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '8px 0',
                  background: '#fafafa',
                }}
              >
                {kategoriler.map(cat => {
                  const isHov = hoveredMain === cat.id
                  const isActive = isMainCatActive(cat.id, selectedCategory, kategoriler)
                  return (
                    <button
                      key={cat.id}
                      onMouseEnter={() => setHoveredMain(cat.id)}
                      onClick={() => handleMainSelect(cat.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 14px',
                        background: isHov ? '#fff' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderLeft: isHov ? '3px solid #e53935' : '3px solid transparent',
                        transition: 'all .12s',
                      }}
                    >
                      <span
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: isHov || isActive
                            ? '2px 3px 14px rgba(229,57,53,.18)'
                            : '2px 3px 10px rgba(26,46,74,.14), 0 1px 3px rgba(0,0,0,.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'box-shadow .12s',
                        }}
                      >
                        <i
                          className={`ti ${cat.icon}`}
                          style={{
                            fontSize: 18,
                            color: isHov || isActive ? '#e53935' : '#1a2e4a',
                            transition: 'color .12s',
                            lineHeight: 1,
                          }}
                        />
                      </span>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: isHov || isActive ? 700 : 500,
                          color: isHov || isActive ? '#e53935' : '#374151',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          lineHeight: 1.3,
                          transition: 'color .12s',
                          flex: 1,
                          textAlign: 'left',
                        }}
                      >
                        {mitAnzahl(cat.label, cat.adet)}
                      </span>
                      {isHov && (
                        <i className="ti ti-chevron-right" style={{ fontSize: 12, color: '#e53935' }} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* RIGHT: Subcategories — scrollable */}
              <div style={{ flex: 1, minHeight: 0, padding: '16px 20px', overflowY: 'auto', overflowX: 'hidden' }}>
                {(() => {
                  const mainCat = kategoriler.find(c => c.id === hoveredMain)
                  if (!mainCat) return null
                  const hasGroups = mainCat.sub.some(s => s.group)

                  if (hasGroups) {
                    const groups: Record<string, typeof mainCat.sub> = {}
                    mainCat.sub.forEach(s => {
                      const g = s.group || 'Diğer'
                      if (!groups[g]) groups[g] = []
                      groups[g].push(s)
                    })
                    return (
                      <>
                        <div style={{ marginBottom: 14 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}>
                            {mitAnzahl(mainCat.label, mainCat.adet)} — Alt Kategoriler
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 16px' }}>
                          {Object.entries(groups).map(([groupName, subs]) => (
                            <div key={groupName}>
                              <div style={{
                                fontSize: 11, fontWeight: 700, color: '#6b7280',
                                marginBottom: 6,
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                borderBottom: '1px solid #f3f4f6',
                                paddingBottom: 4,
                              }}>
                                {groupName}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {subs.map(sub => {
                                  const isActive = selectedCategory === sub.id
                                  return (
                                    <button
                                      key={sub.id}
                                      onClick={() => handleSubSelect(sub.id)}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        border: 'none',
                                        background: isActive ? '#fff5f5' : 'transparent',
                                        color: isActive ? '#e53935' : '#4b5563',
                                        fontSize: 12.5,
                                        fontWeight: isActive ? 700 : 400,
                                        cursor: 'pointer',
                                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                                        textAlign: 'left',
                                        transition: 'all .12s',
                                        borderBottom: '1px solid #f3f4f6',
                                      }}
                                    >
                                      {mitAnzahl(sub.label, sub.adet)}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  }

                  return (
                    <>
                      <div style={{ marginBottom: 14 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#9ca3af',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                        }}>
                          {mitAnzahl(mainCat.label, mainCat.adet)} — Alt Kategoriler
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {activeSubs.map(sub => {
                          const isActive = selectedCategory === sub.id
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSubSelect(sub.id)}
                              style={{
                                padding: '7px 10px',
                                border: 'none',
                                borderBottom: '1px solid #f3f4f6',
                                background: isActive ? '#fff5f5' : 'transparent',
                                color: isActive ? '#e53935' : '#374151',
                                fontSize: 13,
                                fontWeight: isActive ? 700 : 400,
                                cursor: 'pointer',
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                textAlign: 'left',
                                transition: 'all .12s',
                              }}
                            >
                              {mitAnzahl(sub.label, sub.adet)}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>

            </div>{/* end inner row */}
          </div>
        </>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        #kapbeni-category-bar {
          position: sticky;
          top: 87px;
          z-index: 40;
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          box-shadow: 0 2px 8px rgba(26,46,74,.07);
        }
        @media (min-width: 768px) {
          #kapbeni-category-bar { top: 91px; }
        }

        .kapbeni-mega-menu-panel { top: 133px; }
        @media (min-width: 768px) {
          .kapbeni-mega-menu-panel { top: 137px; }
        }
      `}</style>
    </>
  )
}
