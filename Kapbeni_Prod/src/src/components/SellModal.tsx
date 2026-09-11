import { useRef, useState } from 'react'
import { X, Sparkles, ChevronDown } from 'lucide-react'
import { CITIES } from '../data/cities'
import { Listing } from '../api'
import { useKategoriAgac, mitAnzahl } from '../data/kategoriAgac'



// Grenzen bewusst hier als Konstanten: dieselben Zahlen stehen in
// api/src/routes/ilanlar.js. Weichen sie ab, laeuft der Verkaeufer erst beim
// Absenden in eine Fehlermeldung statt beim Auswaehlen.
const FOTO_MAX = 8
const FOTO_BYTE = 10 * 1024 * 1024
const VIDEO_BYTE = 20 * 1024 * 1024
const VIDEO_TYPEN = ['video/mp4', 'video/webm', 'video/quicktime']

interface Props {
  onClose: () => void
  onAddListing: (listing: Listing, images?: File[], video?: File | null) => void
}

export default function SellModal({ onClose, onAddListing }: Props) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [city, setCity] = useState('İstanbul')
  const [district, setDistrict] = useState('')
  const [condition, setCondition] = useState('Sıfır Ayarında')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [videoVorschau, setVideoVorschau] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const { kategoriler: ALL_CATEGORIES } = useKategoriAgac()
  const selectedCat = ALL_CATEGORIES.find((c) => c.id === categoryId)

  const selectCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all'
  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all'
  const labelCls = 'block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5'

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const gewaehlt = Array.from(e.target.files || [])
    const newFiles = gewaehlt.filter((f) => f.type.startsWith('image/') && f.size <= FOTO_BYTE)
    const zuGross = gewaehlt.length - newFiles.length
    const combined = [...images, ...newFiles].slice(0, FOTO_MAX)
    const abgeschnitten = images.length + newFiles.length - combined.length
    setErrors((p) => {
      const { foto, ...rest } = p
      if (zuGross > 0) return { ...rest, foto: `${zuGross} dosya atlandı (en fazla 10MB, sadece görsel).` }
      if (abgeschnitten > 0) return { ...rest, foto: `En fazla ${FOTO_MAX} fotoğraf eklenebilir.` }
      return rest
    })
    setImages(combined)
    Promise.all(
      combined.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = (ev) => resolve(ev.target?.result as string)
            reader.readAsDataURL(file)
          })
      )
    ).then(setPreviews)
    if (e.target) e.target.value = ''
  }

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx))
    setPreviews(previews.filter((_, i) => i !== idx))
  }

  // Reihenfolge = Reihenfolge in der Galerie, das erste Bild wird das Titelbild.
  // Pfeile statt Ziehen: funktioniert auch auf dem Telefon und mit der Tastatur.
  const verschiebe = (idx: number, richtung: -1 | 1) => {
    const ziel = idx + richtung
    if (ziel < 0 || ziel >= images.length) return
    const tausche = <T,>(a: T[]) => { const k = [...a]; ;[k[idx], k[ziel]] = [k[ziel], k[idx]]; return k }
    setImages(tausche(images))
    setPreviews(tausche(previews))
  }

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = (e.target.files || [])[0]
    if (e.target) e.target.value = ''
    if (!f) return
    if (!VIDEO_TYPEN.includes(f.type)) {
      setErrors((p) => ({ ...p, video: 'Sadece MP4, WebM veya MOV yükleyebilirsiniz.' }))
      return
    }
    if (f.size > VIDEO_BYTE) {
      setErrors((p) => ({ ...p, video: `Video en fazla 20MB olabilir (seçilen: ${(f.size / 1048576).toFixed(1)}MB).` }))
      return
    }
    setErrors((p) => { const { video, ...rest } = p; return rest })
    if (videoVorschau) URL.revokeObjectURL(videoVorschau)
    setVideo(f)
    setVideoVorschau(URL.createObjectURL(f))
  }

  const removeVideo = () => {
    if (videoVorschau) URL.revokeObjectURL(videoVorschau)
    setVideo(null)
    setVideoVorschau(null)
    setErrors((p) => { const { video, ...rest } = p; return rest })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Bu alan zorunludur.'
    if (!price || parseFloat(price) <= 0) errs.price = 'Lütfen geçerli bir fiyat girin.'
    if (!categoryId) errs.kategori = 'Lütfen kategori seçin.'
    if (!city) errs.sehir = 'Lütfen şehir seçin.'
    if (!description.trim() || description.trim().length < 10) errs.description = 'En az 10 karakter girin.'
    if (images.length === 0 && !imageUrl.trim()) errs.foto = 'En az 1 fotoğraf ekleyin veya görsel URL girin.'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const subLabel = selectedCat?.sub?.find((s) => s.id === subCategoryId)?.label
    const categoryLabel = [selectedCat?.label, subLabel].filter(Boolean).join(' > ')
    const location = district ? `${city}, ${district}` : city

    const listing: Listing = {
      id: `listing_${Date.now()}`,
      title,
      price: parseFloat(price),
      category: categoryLabel,
      // Slug der feinsten gewaehlten Ebene — App.tsx loest daraus die
      // numerische kategori_id auf und sendet sie an die API.
      categorySlug: subCategoryId || categoryId,
      location,
      date: 'Şimdi',
      image: previews[0] || imageUrl || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=70',
      description,
      sellerName: 'Siz',
      sellerPhone: '',
      isFavorite: false,
      condition,
    }
    onAddListing(listing, images.length ? images : undefined, video)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4 overflow-y-auto">
      <div className="bg-white rounded-none md:rounded-3xl w-full max-w-xl shadow-2xl relative border border-gray-100 h-[100dvh] md:h-auto md:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Hemen İlan Verin</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-4 flex-grow scrollbar-hide">
          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>
                Fotoğraf <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">{images.length}/{FOTO_MAX}</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFiles}
            />
            <div className="grid grid-cols-4 gap-2">
              {images.length < FOTO_MAX && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-red-50 transition-colors"
                >
                  <span className="text-2xl">📷</span>
                  <span className="text-[10px] text-gray-500">Ekle</span>
                </button>
              )}
              {previews.map((src, idx) => (
                <div key={idx} className="aspect-square relative rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label="Fotoğrafı kaldır"
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500"
                  >
                    ×
                  </button>
                  {/* Reihenfolge — das erste Bild ist das Titelbild */}
                  <div className="absolute inset-x-1 bottom-1 flex items-center gap-1">
                    {idx === 0 ? (
                      <span className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded">Kapak</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => verschiebe(idx, -1)}
                        aria-label="Öne al"
                        className="w-5 h-5 bg-black/60 text-white rounded-full text-[11px] leading-none flex items-center justify-center hover:bg-primary"
                      >
                        ‹
                      </button>
                    )}
                    {idx < previews.length - 1 && (
                      <button
                        type="button"
                        onClick={() => verschiebe(idx, 1)}
                        aria-label="Geri al"
                        className="w-5 h-5 bg-black/60 text-white rounded-full text-[11px] leading-none flex items-center justify-center hover:bg-primary ml-auto"
                      >
                        ›
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">En az 1, en fazla {FOTO_MAX} fotoğraf. JPG, PNG, WebP. Maks 10MB/fotoğraf. İlk fotoğraf kapak olur, oklarla sıralayın.</p>
            <input
              type="text"
              placeholder="Veya görsel URL'si yapıştırın (opsiyonel)..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={inputCls + ' mt-2'}
            />
            {errors.foto && <span className="text-red-500 text-xs mt-1 block">{errors.foto}</span>}
          </div>

          {/* Video — optional, genau eines je Inserat */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>Video <span className="text-gray-400 normal-case font-semibold">(opsiyonel)</span></label>
              <span className="text-xs text-gray-400">{video ? '1/1' : '0/1'}</span>
            </div>
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={handleVideo}
            />
            {videoVorschau ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black">
                <video src={videoVorschau} controls playsInline className="w-full max-h-56 object-contain" />
                <button
                  type="button"
                  onClick={removeVideo}
                  aria-label="Videoyu kaldır"
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-sm flex items-center justify-center hover:bg-red-500"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-5 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-red-50 transition-colors"
              >
                <span className="text-2xl">🎬</span>
                <span className="text-[11px] text-gray-500">Video ekle</span>
              </button>
            )}
            <p className="text-[11px] text-gray-400 mt-2">1 video, en fazla 20MB. MP4, WebM veya MOV.</p>
            {errors.video && <span className="text-red-500 text-xs mt-1 block">{errors.video}</span>}
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>İlan Başlığı</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Tertemiz Çiziksiz iPhone 15 Pro"
              className={inputCls}
            />
            {errors.title && <span className="text-red-500 text-xs mt-1 block">{errors.title}</span>}
          </div>

          {/* Category */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Kategori</label>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setSubCategoryId('') }}
                  className={selectCls}
                >
                  <option value="">Kategori seçin</option>
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{mitAnzahl(c.label, c.adet)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>
              {errors.kategori && <span className="text-red-500 text-xs mt-1 block">{errors.kategori}</span>}
            </div>
            {selectedCat?.sub && selectedCat.sub.length > 0 && (
              <div>
                <label className={labelCls}>Alt Kategori</label>
                <div className="relative">
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Alt kategori seçin</option>
                    {selectedCat.sub.map((s) => (
                      <option key={s.id} value={s.id}>{mitAnzahl(s.label, s.adet)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Price & Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fiyat (₺)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Örn: 45000"
                className={inputCls}
              />
              {errors.price && <span className="text-red-500 text-xs mt-1 block">{errors.price}</span>}
            </div>
            <div>
              <label className={labelCls}>Durum</label>
              <div className="relative">
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className={selectCls}>
                  <option value="Sıfır">Sıfır</option>
                  <option value="Sıfır Ayarında">Sıfır Ayarında</option>
                  <option value="İkinci El - Çok Temiz">İkinci El - Çok Temiz</option>
                  <option value="İkinci El - Az Kullanılmış">İkinci El - Az Kullanılmış</option>
                  <option value="İkinci El">İkinci El</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* City & District */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Şehir</label>
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setDistrict('') }}
                  className={selectCls}
                >
                  <option value="">Şehir Seçin</option>
                  {Object.keys(CITIES).sort((a, b) => a.localeCompare(b, 'tr')).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>
              {errors.sehir && <span className="text-red-500 text-xs mt-1 block">{errors.sehir}</span>}
            </div>
            <div>
              <label className={labelCls}>İlçe</label>
              <div className="relative">
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!city}
                  className={`${selectCls} disabled:opacity-50`}
                >
                  <option value="">İlçe Seçin</option>
                  {city && CITIES[city]?.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Açıklama</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürünün teknik özellikleri, kullanım ömrü, çizik veya deformasyon durumları hakkında detaylı bilgi verin..."
              className={`${inputCls} resize-none`}
            />
            {errors.description && <span className="text-red-500 text-xs mt-1 block">{errors.description}</span>}
          </div>

          {/* Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl font-bold text-sm transition-all text-center cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="w-1/2 bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-95 text-center cursor-pointer"
            >
              İlanı Yayınla
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
