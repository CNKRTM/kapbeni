import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, Home, Compass, MessageCircle, Plus, User, X, Menu, SlidersHorizontal } from 'lucide-react'
import type { User as UserType } from '../api'
import ProfileDrawer from './ProfileDrawer'

interface Props {
  activeTab: string
  setActiveTab: (tab: string) => void
  searchTerm: string
  setSearchTerm: (v: string) => void
  onOpenSellModal: () => void
  unreadCount: number
  showFilters: boolean
  onToggleFilters: () => void
  onProfileClick: (action?: string) => void
  user: UserType | null
}

export default function Navbar({
  activeTab, setActiveTab, searchTerm, setSearchTerm,
  onOpenSellModal, unreadCount, showFilters, onToggleFilters,
  onProfileClick, user,
}: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const navigate = (tab: string) => {
    setActiveTab(tab)
    setMobileMenuOpen(false)
  }

  const handleDrawerNavigate = (tab: string) => {
    // Map profile drawer tabs to App actions
    if (tab === 'profil') { onProfileClick('profil'); return }
    if (tab === 'kyc') { onProfileClick('kyc'); return }
    if (tab === 'gsm') { onProfileClick('gsm'); return }
    if (tab === 'kampanyalar') { onProfileClick('kampanyalar'); return }
    if (tab === 'ayarlar') { onProfileClick('ayarlar'); return }
    if (tab === 'favoriler') { setActiveTab('favorites'); return }
    if (tab === 'mesajlar') { setActiveTab('messages'); return }
    // ilanlarim, tekliflerim, degerlendirmeler, aramalar → Dashboard mit passendem Tab
    onProfileClick(tab)
  }

  return (
    <>
    <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100">
      <div className="max-w-7xl mx-auto w-full px-3 md:px-4 py-2.5 md:py-3">
        <div className="flex items-center gap-2 md:gap-6">

          {/* Logo */}
          <button onClick={() => navigate('home')} className="flex-shrink-0">
            <img src="/logo-navbar.png" alt="Kap Beni" className="h-[66px] w-auto object-contain" />
          </button>

          {/* Search */}
          <div className="flex-grow max-w-xl relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-full py-2.5 pl-10 pr-10 text-sm placeholder:text-gray-400 font-medium outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
              placeholder="Ne arıyorsunuz?"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                if (activeTab !== 'home' && activeTab !== 'discover') setActiveTab('discover')
              }}
            />
            <button
              onClick={onToggleFilters}
              className={`absolute inset-y-0 right-3.5 flex items-center ${showFilters ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
              title="Filtreler"
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => navigate('home')}
              className={`font-semibold text-sm flex items-center gap-1.5 ${activeTab === 'home' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
            >
              <Home className="h-4 w-4" /> Ana Sayfa
            </button>
            <button
              onClick={() => navigate('discover')}
              className={`font-semibold text-sm flex items-center gap-1.5 ${activeTab === 'discover' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
            >
              <Compass className="h-4 w-4" /> Keşfet
            </button>
            <button
              onClick={() => navigate('messages')}
              className={`font-semibold text-sm flex items-center gap-1.5 relative ${activeTab === 'messages' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
            >
              <MessageCircle className="h-4 w-4" /> Mesajlar
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenSellModal}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-full font-semibold text-sm shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="h-4.5 w-4.5" /> Sat
            </button>
            {user ? (
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm overflow-hidden"
                title="Profil"
              >
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (user.ad || user.email || 'K')[0].toUpperCase()}
              </button>
            ) : (
              <button
                onClick={() => onProfileClick('login')}
                className="font-semibold text-sm text-gray-600 hover:text-primary px-2 flex items-center gap-1"
              >
                <User className="h-4 w-4" /> Giriş
              </button>
            )}
          </nav>

          {/* Mobile buttons */}
          <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onOpenSellModal}
              className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-sm active:scale-95"
              title="Sat"
            >
              <Plus className="h-5.5 w-5.5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center"
              title="Menü"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-2 border-t border-gray-100 pt-2 flex flex-col">
            {([
              ['home', 'Ana Sayfa', Home],
              ['discover', 'Keşfet', Compass],
              ['messages', 'Mesajlar', MessageCircle],
              ['profile', 'Profil', User],
            ] as [string, string, React.ElementType][]).map(([tab, label, Icon]) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'profile') {
                    setMobileMenuOpen(false)
                    if (user) { setDrawerOpen(true) } else { onProfileClick('login') }
                  } else {
                    navigate(tab)
                  }
                }}
                className={`flex items-center gap-3 px-2 py-3 text-sm font-semibold rounded-lg ${activeTab === tab ? 'text-primary bg-primary/5' : 'text-gray-600'}`}
              >
                <Icon className="h-5 w-5" />
                {label}
                {tab === 'messages' && unreadCount > 0 && (
                  <span className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>

    <AnimatePresence>
      {drawerOpen && (
        <ProfileDrawer
          onClose={() => setDrawerOpen(false)}
          onNavigate={handleDrawerNavigate}
        />
      )}
    </AnimatePresence>
  </>
  )
}
