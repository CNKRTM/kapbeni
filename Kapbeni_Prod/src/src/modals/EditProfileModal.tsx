import { createPortal } from 'react-dom'
import { useState, useRef, useCallback } from 'react'
import { X, User, Camera, ShieldCheck, ShieldAlert, Smartphone, Check, Info, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileApi } from '../api'
import { CITIES } from '../data/cities'
import { ChevronDown } from 'lucide-react'

function normalizePhone(n: string) {
  let s = (n || '').replace(/\D/g, '')
  if (s.startsWith('90') && s.length >= 12) s = s.slice(2)
  if (s.length === 10 && s.startsWith('5')) s = '0' + s
  if (s.length > 11) s = s.slice(0, 11)
  return s
}

const CROP_SIZE = 280
const OUTPUT_SIZE = 400

function AvatarCropper({ file, onCancel, onCropped }: { file: File; onCancel: () => void; onCropped: (b: Blob) => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [src, setSrc] = useState(() => URL.createObjectURL(file))
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [baseScale, setBaseScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const isRotated = rotation === 90 || rotation === 270
  const displayW = isRotated ? imgSize.h : imgSize.w
  const displayH = isRotated ? imgSize.w : imgSize.h
  const scaledW = displayW * baseScale
  const scaledH = displayH * baseScale

  const clampOffset = useCallback((o: { x: number; y: number }, z: number) => {
    const cx = Math.max(0, (scaledW * z - CROP_SIZE) / 2)
    const cy = Math.max(0, (scaledH * z - CROP_SIZE) / 2)
    return { x: Math.max(-cx, Math.min(cx, o.x)), y: Math.max(-cy, Math.min(cy, o.y)) }
  }, [scaledW, scaledH])

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const { naturalWidth: w, naturalHeight: h } = img
    setImgSize({ w, h })
    const ns = Math.max(CROP_SIZE / w, CROP_SIZE / h)
    setBaseScale(ns)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setRotation(0)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    setOffset(clampOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    }, zoom))
  }
  const onPointerUp = () => { dragRef.current = null }
  const onWheel = (e: React.WheelEvent) => {
    const nz = Math.max(1, Math.min(4, zoom + (e.deltaY < 0 ? 0.12 : -0.12)))
    setZoom(nz)
    setOffset((o) => clampOffset(o, nz))
  }
  const rotate = () => {
    const nr = (rotation + 90) % 360
    const nIsRot = nr === 90 || nr === 270
    const nW = nIsRot ? imgSize.h : imgSize.w
    const nH = nIsRot ? imgSize.w : imgSize.h
    setBaseScale(Math.max(CROP_SIZE / nW, CROP_SIZE / nH))
    setRotation(nr)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }
  const changeZoom = (nz: number) => {
    const cz = Math.max(1, Math.min(4, nz))
    setZoom(cz)
    setOffset((o) => clampOffset(o, cz))
  }

  const crop = () => {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    const totalScale = baseScale * zoom
    const sw = scaledW * zoom
    const sh = scaledH * zoom
    const imgX = CROP_SIZE / 2 + offset.x - sw / 2
    const imgY = CROP_SIZE / 2 + offset.y - sh / 2
    const srcX = (0 - imgX) / totalScale
    const srcY = (0 - imgY) / totalScale
    const srcS = CROP_SIZE / totalScale
    const dstS = OUTPUT_SIZE / srcS
    ctx.save()
    ctx.translate(-srcX * dstS, -srcY * dstS)
    ctx.scale(dstS, dstS)
    ctx.translate(displayW / 2, displayH / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(img, -imgSize.w / 2, -imgSize.h / 2, imgSize.w, imgSize.h)
    ctx.restore()
    canvas.toBlob((b) => { if (b) onCropped(b) }, 'image/webp', 0.92)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 text-center">Kaydırarak konumlandırın, yakınlaştırın veya döndürün.</p>
      <div
        className="relative mx-auto rounded-full overflow-hidden bg-gray-100 border-2 border-primary/30 cursor-move select-none touch-none"
        style={{ width: CROP_SIZE, height: CROP_SIZE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {src && (
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onLoad}
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: imgSize.w * baseScale,
              height: imgSize.h * baseScale,
              transform: `translate(-50%,-50%) translate(${offset.x}px,${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              maxWidth: 'none',
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/10 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.04)]" />
      </div>
      <div className="flex items-center gap-3 px-2">
        <ZoomOut className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => changeZoom(parseFloat(e.target.value))}
          className="flex-1 accent-[var(--color-primary)]"
        />
        <ZoomIn className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <button
          type="button"
          onClick={rotate}
          title="Döndür"
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 flex-shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5"
        >
          <X className="h-4 w-4" /> Vazgeç
        </button>
        <button
          type="button"
          onClick={crop}
          className="flex-1 bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <Check className="h-4 w-4" /> Kırp & Kullan
        </button>
      </div>
    </div>
  )
}

interface Props {
  onClose: () => void
  onOpenKyc: () => void
  onOpenGsm: () => void
}

const INPUT_CLS = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all'
const LABEL_CLS = 'block text-xs font-bold text-gray-700 mb-1.5'

export default function EditProfileModal({ onClose, onOpenKyc, onOpenGsm }: Props) {
  const { user, refreshUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [saved, setSaved] = useState(false)

  const [ad, setAd] = useState(user?.ad || '')
  const [soyad, setSoyad] = useState(user?.soyad || '')
  const [takmaAd, setTakmaAd] = useState(user?.takma_ad || '')
  const [takmaAdAktif, setTakmaAdAktif] = useState(user?.takma_ad_aktif === true)
  const [sehir, setSehir] = useState(user?.sehir || '')
  const [ilce, setIlce] = useState(user?.ilce || '')
  const [phone, setPhone] = useState(normalizePhone(user?.phone || ''))
  const [hakkinda, setHakkinda] = useState(user?.hakkinda || '')

  const isKyc = user?.kyc_durum === 'onaylandi' || user?.kyc_durumu === 'onaylandi'
  const isPhone = user?.phone_verified === true
  const avatarUrl = user?.avatar_url

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (f && f.type.startsWith('image/')) setCropFile(f)
  }

  const handleCropped = async (blob: Blob) => {
    setCropFile(null)
    setUploading(true)
    setSaveErr('')
    try {
      await profileApi.uploadAvatar(blob)
      await refreshUser()
    } catch {
      setSaveErr('Fotoğraf yüklenemedi.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaveErr('')
    setSaving(true)
    try {
      await profileApi.updateProfile({
        ad: ad.trim(),
        soyad: soyad.trim(),
        takma_ad: takmaAd.trim(),
        takma_ad_aktif: takmaAdAktif,
        sehir,
        ilce,
        phone: normalizePhone(phone),
        hakkinda: hakkinda.trim(),
      })
      await refreshUser()
      setSaved(true)
      setTimeout(onClose, 900)
    } catch (e: any) {
      setSaveErr(
        e?.message?.includes('kullanılıyor')
          ? 'Bu telefon numarası zaten kullanılıyor.'
          : 'Kaydedilemedi. Lütfen tekrar deneyin.'
      )
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-0 md:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-none md:rounded-3xl w-full max-w-lg shadow-2xl relative h-[100dvh] md:h-auto md:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Profili Düzenle</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-grow">
          {cropFile ? (
            <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onCropped={handleCropped} />
          ) : (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full bg-primary/5 border-2 border-primary/20 overflow-hidden flex items-center justify-center group"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-primary/40" />
                  )}
                  <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="h-6 w-6 text-white" />
                  </span>
                  {uploading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Camera className="h-3.5 w-3.5" />{' '}
                  {avatarUrl ? 'Fotoğrafı Değiştir' : 'Profil Fotoğrafı Ekle'}
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Fotoğrafı kırpabilir, yakınlaştırabilir ve döndürebilirsiniz.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Verification rows */}
              <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  {isKyc ? (
                    <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">Kimlik (Fotoğraf) Doğrulama</p>
                    <p className={`text-xs ${isKyc ? 'text-green-600' : 'text-amber-600'}`}>
                      {isKyc ? 'Doğrulandı' : 'Doğrulanmadı'}
                    </p>
                  </div>
                  {!isKyc && (
                    <button onClick={onOpenKyc} className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-full">
                      Doğrula
                    </button>
                  )}
                  {isKyc && <Check className="h-4 w-4 text-green-600" />}
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  {isPhone ? (
                    <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Smartphone className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">GSM (Telefon) Doğrulama</p>
                    <p className={`text-xs ${isPhone ? 'text-green-600' : 'text-amber-600'}`}>
                      {isPhone ? 'Doğrulandı' : 'Doğrulanmadı'}
                    </p>
                  </div>
                  {!isPhone && (
                    <button onClick={onOpenGsm} className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-full">
                      Doğrula
                    </button>
                  )}
                  {isPhone && <Check className="h-4 w-4 text-green-600" />}
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Ad</label>
                  <input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={100} className={INPUT_CLS} placeholder="Adınız" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Soyad</label>
                  <input value={soyad} onChange={(e) => setSoyad(e.target.value)} maxLength={100} className={INPUT_CLS} placeholder="Soyadınız" />
                </div>
              </div>

              {/* Nickname */}
              <div>
                <label className={LABEL_CLS}>Takma Ad (Nickname)</label>
                <input value={takmaAd} onChange={(e) => setTakmaAd(e.target.value)} maxLength={60} className={INPUT_CLS} placeholder="Örn: burako_34" />
                <label className="flex items-start gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={takmaAdAktif}
                    onChange={(e) => setTakmaAdAktif(e.target.checked)}
                    className="mt-0.5 accent-[var(--color-primary)] w-4 h-4"
                  />
                  <span className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">Takma adım herkese görünsün</span>{' '}
                    — İlanlarınızda ve profilinizde gerçek ad-soyad yerine takma adınız gösterilir.
                  </span>
                </label>
                <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Gizliliğiniz için gerçek adınızı paylaşmak istemiyorsanız bir takma ad kullanabilirsiniz. Kapalıysa profilinizde adınız ve soyadınız görünür.
                  </p>
                </div>
              </div>

              {/* City/District */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>İl</label>
                  <div className="relative">
                    <select
                      value={sehir}
                      onChange={(e) => { setSehir(e.target.value); setIlce('') }}
                      className={INPUT_CLS + ' appearance-none pr-9'}
                    >
                      <option value="">İl Seçin</option>
                      {Object.keys(CITIES).sort((a, b) => a.localeCompare(b, 'tr')).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>İlçe</label>
                  <div className="relative">
                    <select
                      value={ilce}
                      onChange={(e) => setIlce(e.target.value)}
                      disabled={!sehir}
                      className={INPUT_CLS + ' appearance-none pr-9 disabled:opacity-50'}
                    >
                      <option value="">İlçe Seçin</option>
                      {sehir && (CITIES[sehir] || []).map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className={LABEL_CLS}>GSM Numarası</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  onBlur={() => setPhone((p) => normalizePhone(p))}
                  maxLength={11}
                  className={INPUT_CLS}
                  placeholder="05XX XXX XX XX"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Numaranızı başında 0 ile veya 0 olmadan girebilirsiniz; her durumda <strong>05XXXXXXXXX</strong> olarak kaydedilir. (En fazla 11 hane)
                </p>
                {!isPhone && phone.length === 11 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Numaranızı değiştirdiyseniz tekrar GSM doğrulaması yapmanız gerekir.
                  </p>
                )}
              </div>

              {/* About */}
              <div>
                <label className={LABEL_CLS}>
                  Hakkında <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
                <textarea
                  rows={3}
                  value={hakkinda}
                  onChange={(e) => setHakkinda(e.target.value.slice(0, 200))}
                  maxLength={200}
                  className={INPUT_CLS + ' resize-none'}
                  placeholder="Kendinizden kısaca bahsedin..."
                />
                <p className="text-[11px] text-gray-400 mt-1 text-right">{hakkinda.length}/200</p>
              </div>

              {saveErr && <p className="text-red-500 text-sm">{saveErr}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        {!cropFile && (
          <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              {saved ? (
                <><Check className="h-4 w-4" /> Kaydedildi</>
              ) : saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
