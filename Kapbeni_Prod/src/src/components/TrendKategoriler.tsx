import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const FOTO_KATEGORILER = [
  { name: 'Araba',        catId: 'araba',      img: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=280&h=280&fit=crop&auto=format' },
  { name: 'Emlak',        catId: 'emlak',      img: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=280&h=280&fit=crop&auto=format' },
  { name: 'Elektronik',   catId: 'elektronik', img: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=280&h=280&fit=crop&auto=format' },
  { name: 'Moda',         catId: 'giyim',      img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=280&h=280&fit=crop&auto=format' },
  { name: 'Ev & Yaşam',   catId: 'ev-yasam',   img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=280&h=280&fit=crop&auto=format' },
  { name: 'Spor',         catId: 'spor',       img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=280&h=280&fit=crop&auto=format' },
  { name: 'Anne & Bebek', catId: 'anne-bebek', img: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=280&h=280&fit=crop&auto=format' },
  { name: 'Telefon',      catId: 'telefon',    img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=280&h=280&fit=crop&auto=format' },
  { name: 'Hobi',         catId: 'hobi',       img: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=280&h=280&fit=crop&auto=format' },
  { name: 'Antika',       catId: 'antika',     img: 'https://images.unsplash.com/photo-1481833761820-0509d3217039?w=280&h=280&fit=crop&auto=format' },
]

interface Props {
  selectedCategory: string | null
  onSelectCategory: (catId: string | null) => void
  onViewAllCategories: () => void
}

export default function TrendKategoriler({ selectedCategory, onSelectCategory, onViewAllCategories }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' })
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Trend Kategoriler</h2>
        <div className="flex items-center gap-2">
          {/* Rote Navigations-Pfeile wie Burak_Backup */}
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            aria-label="Geri"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            aria-label="İleri"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={onViewAllCategories}
            className="text-primary font-semibold text-xs md:text-sm flex items-center hover:underline cursor-pointer ml-1"
          >
            Tümünü Gör <ChevronRight className="h-4 w-4 ml-0.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {FOTO_KATEGORILER.map((cat) => {
          const isActive = selectedCategory === cat.catId
          return (
            <div
              key={cat.name}
              onClick={() => onSelectCategory(isActive ? null : cat.catId)}
              className="flex-shrink-0 cursor-pointer group"
            >
              <div
                className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-md'
                    : 'group-hover:scale-105 group-hover:shadow-md'
                }`}
                style={{ width: 110, height: 90 }}
              >
                <img
                  src={cat.img}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Dunkler Gradient am Boden für Label-Lesbarkeit */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                {isActive && <div className="absolute inset-0 bg-primary/20" />}
                {/* Label INNERHALB der Kachel – wie Burak_Backup */}
                <p className="absolute bottom-0 left-0 right-0 text-center text-white text-[11px] font-bold py-1.5 px-1 leading-tight">
                  {cat.name}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
