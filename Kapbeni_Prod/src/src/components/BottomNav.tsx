import { House, Compass, CirclePlus, MessageSquare, Heart } from 'lucide-react'

interface Props {
  activeTab: string
  setActiveTab: (tab: string) => void
  onOpenSellModal: () => void
  unreadCount: number
}

export default function BottomNav({ activeTab, setActiveTab, onOpenSellModal, unreadCount }: Props) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg py-2 px-6 flex items-center justify-between z-50 safe-bottom">
      <button
        onClick={() => setActiveTab('home')}
        className={`flex flex-col items-center gap-0.5 ${activeTab === 'home' ? 'text-primary' : 'text-gray-400'}`}
      >
        <House className="h-6 w-6" />
        <span className="text-[10px] font-semibold">Ana Sayfa</span>
      </button>

      <button
        onClick={() => setActiveTab('discover')}
        className={`flex flex-col items-center gap-0.5 ${activeTab === 'discover' ? 'text-primary' : 'text-gray-400'}`}
      >
        <Compass className="h-6 w-6" />
        <span className="text-[10px] font-semibold">Keşfet</span>
      </button>

      <button
        onClick={onOpenSellModal}
        className="flex flex-col items-center -translate-y-4 bg-primary text-white p-3 rounded-full shadow-lg active:scale-95 transition-transform"
      >
        <CirclePlus className="h-6 w-6" />
      </button>

      <button
        onClick={() => setActiveTab('messages')}
        className={`flex flex-col items-center gap-0.5 relative ${activeTab === 'messages' ? 'text-primary' : 'text-gray-400'}`}
      >
        <MessageSquare className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 right-2 bg-primary text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
        <span className="text-[10px] font-semibold">Mesajlar</span>
      </button>

      <button
        onClick={() => setActiveTab('favorites')}
        className={`flex flex-col items-center gap-0.5 ${activeTab === 'favorites' ? 'text-primary' : 'text-gray-400'}`}
      >
        <Heart className="h-6 w-6" />
        <span className="text-[10px] font-semibold">Favoriler</span>
      </button>
    </div>
  )
}
