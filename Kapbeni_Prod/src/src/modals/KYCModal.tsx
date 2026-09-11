import { useState, useRef } from 'react'
import { X, Upload, Camera, ShieldCheck, ShieldAlert, Loader, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { kycApi } from '../api'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function KYCModal({ isOpen, onClose }: Props) {
  const { refreshUser } = useAuth()
  const [step, setStep] = useState(1)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState('')
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const idInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      setCameraOn(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 50)
    } catch {
      setError('Kameraya erişilemedi. Lütfen dosya yükleyin.')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) {
        setSelfieFile(blob as File)
        setSelfiePreview(URL.createObjectURL(blob))
        stopCamera()
      }
    }, 'image/jpeg', 0.9)
  }

  const submit = async () => {
    if (!idFile || !selfieFile) return
    setLoading(true)
    setError('')
    setStep(3)
    try {
      const form = new FormData()
      form.append('idPhoto', idFile, 'kimlik.jpg')
      form.append('selfie', selfieFile, 'selfie.jpg')
      const res = await kycApi.submit(form)
      setResult(res)
      if (res?.durum === 'onaylandi') {
        try { await refreshUser() } catch {}
      }
    } catch (e: any) {
      setError(e.message || 'Hata')
      setResult({ durum: 'reddedildi' })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        <h2 className="text-lg font-bold text-gray-900 mb-1">Kimlik Doğrulama</h2>
        <p className="text-xs text-gray-500 mb-4">Güvenli alışveriş için kimliğinizi doğrulayın.</p>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full ${s <= step ? 'bg-primary w-8' : 'bg-gray-200 w-5'}`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-2 rounded-lg mb-3">{error}</div>
        )}

        {/* Step 1: ID photo */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">1. Kimlik Fotoğrafı</p>
            <div
              onClick={() => idInputRef.current?.click()}
              className="aspect-[16/10] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-gray-50"
            >
              {idPreview ? (
                <img src={idPreview} className="w-full h-full object-contain" alt="" />
              ) : (
                <>
                  <Upload className="h-7 w-7 text-gray-400" />
                  <span className="text-sm text-gray-400 mt-2">Kimlik fotoğrafını yükle</span>
                </>
              )}
            </div>
            <input
              ref={idInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setIdFile(f); setIdPreview(URL.createObjectURL(f)) }
              }}
            />
            <button
              disabled={!idFile}
              onClick={() => setStep(2)}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-40"
            >
              İleri →
            </button>
          </div>
        )}

        {/* Step 2: Selfie */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">2. Selfie</p>
            {cameraOn ? (
              <div className="space-y-3">
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-black">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Camera className="h-4 w-4" /> Çek
                  </button>
                  <button onClick={stopCamera} className="px-4 border rounded-xl text-gray-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : selfiePreview ? (
              <div className="aspect-[3/4] rounded-xl overflow-hidden border bg-gray-100">
                <img src={selfiePreview} className="w-full h-full object-cover" alt="" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={startCamera}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center"
                >
                  <Camera className="h-6 w-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Kamera</span>
                </button>
                <button
                  onClick={() => selfieInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center"
                >
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Yükle</span>
                </button>
              </div>
            )}
            <input
              ref={selfieInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setSelfieFile(f); setSelfiePreview(URL.createObjectURL(f)) }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-5 border rounded-xl text-gray-500 font-semibold"
              >
                Geri
              </button>
              <button
                disabled={!selfieFile}
                onClick={submit}
                className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-40"
              >
                Gönder
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && (
          <div className="text-center py-6">
            {loading ? (
              <>
                <Loader className="h-9 w-9 animate-spin text-primary mx-auto" />
                <p className="mt-4 font-semibold text-gray-700">Kontrol ediliyor...</p>
              </>
            ) : result?.durum === 'onaylandi' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="mt-3 font-bold text-green-700">Kimliğiniz doğrulandı ✅</h3>
                <button
                  onClick={handleClose}
                  className="mt-5 bg-primary text-white font-bold px-6 py-2.5 rounded-full"
                >
                  Tamam
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                  <ShieldAlert className="h-7 w-7 text-red-600" />
                </div>
                <h3 className="mt-3 font-bold text-red-700">
                  {result?.durum === 'manuel_inceleme' ? 'Manuel inceleme' : 'Doğrulama başarısız'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{result?.mesaj || ''}</p>
                <button
                  onClick={() => {
                    setStep(1)
                    setResult(null)
                    setIdFile(null)
                    setIdPreview('')
                    setSelfieFile(null)
                    setSelfiePreview('')
                  }}
                  className="mt-5 bg-primary text-white font-bold px-6 py-2.5 rounded-full"
                >
                  Tekrar Dene
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
