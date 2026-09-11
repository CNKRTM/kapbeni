import { Heart, MapPin, Clock } from 'lucide-react'
import type { Listing } from '../api'

interface Props {
  listing: Listing
  isGridView: boolean
  onSelect: () => void
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR').format(p) + ' ₺'
}

export default function ProductCard({ listing, isGridView, onSelect, onToggleFavorite }: Props) {
  const title = listing.title || ''
  const price = listing.price ?? 0
  const image = listing.image || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70'
  const location = listing.location || ''
  const date = listing.date || ''
  const isFav = listing.isFavorite || false

  if (isGridView) {
    return (
      <div
        onClick={onSelect}
        className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs hover:shadow-md transition-shadow cursor-pointer group"
      >
        <div className="relative aspect-square overflow-hidden">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <button
            onClick={(e) => onToggleFavorite(listing.id!, e)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm"
          >
            <Heart className={`h-4.5 w-4.5 transition-colors ${isFav ? 'fill-primary text-primary' : 'text-gray-400 hover:text-primary'}`} />
          </button>
          {listing.condition && (
            <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {listing.condition}
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight mb-1">{title}</p>
          <p className="text-base font-extrabold text-primary">{formatPrice(price)}</p>
          {location && (
            <div className="flex items-center gap-1 mt-1.5 text-gray-400">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="text-[10px] truncate">{location}</span>
            </div>
          )}
          {date && (
            <div className="flex items-center gap-1 mt-0.5 text-gray-400">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className="text-[10px]">{date}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // List View
  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs hover:shadow-md transition-shadow cursor-pointer flex gap-3 p-3"
    >
      <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight pr-2">{title}</p>
          <button
            onClick={(e) => onToggleFavorite(listing.id!, e)}
            className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-50 flex items-center justify-center"
          >
            <Heart className={`h-4.5 w-4.5 transition-colors ${isFav ? 'fill-primary text-primary' : 'text-gray-400 hover:text-primary'}`} />
          </button>
        </div>
        <p className="text-base font-extrabold text-primary mt-1">{formatPrice(price)}</p>
        <div className="flex items-center gap-3 mt-1.5 text-gray-400">
          {location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="text-[10px] truncate">{location}</span>
            </div>
          )}
          {date && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="text-[10px]">{date}</span>
            </div>
          )}
        </div>
        {listing.condition && (
          <span className="inline-block mt-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {listing.condition}
          </span>
        )}
      </div>
    </div>
  )
}
