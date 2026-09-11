import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { ve } from '../api'

export default function Reviews() {
  const [stats, setStats] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [page, setPage] = useState(0)

  useEffect(() => {
    ve.get('/degerlendirme/istatistik').then((d: any) => setStats(d)).catch(() => {})
    ve.get('/degerlendirme/son?limit=6').then((d: any) => setReviews(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  if (!stats || !stats.toplam || Number(stats.toplam) < 1 || reviews.length === 0) return null

  const dist = stats.dagilim ?? {}
  const total = Number(stats.toplam) || 0
  const avg = Number(stats.ortalama) || 0

  const renderStars = (score: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < Math.round(score) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
    ))

  const visible = reviews.slice(page, page + 3)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5">Kullanıcı Değerlendirmeleri</h2>

      {/* Summary */}
      <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-100">
        <div className="text-center flex-shrink-0">
          <p className="text-5xl font-bold text-gray-900">{avg.toFixed(1)}</p>
          <div className="flex justify-center mt-1">{renderStars(avg)}</div>
          <p className="text-xs text-gray-400 mt-1">{total} değerlendirme</p>
        </div>

        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = Number(dist[String(star)]) || 0
            const pct = total ? Math.round((count / total) * 100) : 0
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-2 text-right text-gray-500">{star}</span>
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-gray-400">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Review cards */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        {visible.map((r: any) => (
          <div key={r?.id ?? Math.random()} className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
            <div className="flex gap-1 mb-2">{renderStars(Number(r?.puan) || 0)}</div>
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
              {r?.yorum || 'Çok memnun kaldım.'}
            </p>
            <p className="text-xs text-gray-400 mt-2 font-medium">{r?.degerlendiren_ad || 'Kullanıcı'}</p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {reviews.length > 3 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.ceil(reviews.length / 3) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i * 3)}
              aria-label={`Sayfa ${i + 1}`}
              className={`h-2 rounded-full transition-all ${Math.floor(page / 3) === i ? 'bg-primary w-5' : 'bg-gray-300 w-2'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
