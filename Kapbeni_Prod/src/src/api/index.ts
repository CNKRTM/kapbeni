const BASE = '/api'

type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const isFormData = opts.body instanceof FormData
  const token = localStorage.getItem('sg_token')
  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  }
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    credentials: 'include',
    body: isFormData
      ? (opts.body as FormData)
      : opts.body
      ? JSON.stringify(opts.body)
      : undefined,
  })
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    // Die API antwortet mit dem Feld `hata` (tuerkisch), einzelne aeltere
    // Routen mit `message` oder `error`. Vorher wurde nur `message` gelesen —
    // deshalb kam beim Nutzer IMMER der nichtssagende Text "Hata oluştu" an,
    // auch wenn der Server genau geschrieben hatte, was fehlt.
    const e = err as { hata?: string; message?: string; error?: string }
    throw new Error(e.hata || e.message || e.error || 'Hata oluştu')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const ve = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  putForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'PUT', body }),
}

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    ve.post<{ token: string; user: User }>('/auth/giris', { email, password }),
  register: (ad: string, email: string, phone: string, password: string) =>
    ve.post<{ token: string; user: User }>('/auth/kayit', { ad, email, phone, password }),
  me: () => ve.get<User>('/auth/ben'),
  logoutAll: () => ve.post('/auth/cikis-tumcihaz'),
}

// ---- İlanlar ----
export const ilanlarApi = {
  getAll: (params?: Record<string, string>) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)))
      : ''
    return ve.get<any>(`/ilanlar${qs}`)
  },
  getMine: () => ve.get<any>('/ilanlar/benim'),
  /** Vollstaendiger Datensatz samt Fotoliste — Quelle fuer die Bearbeiten-Maske.
   *  Die Liste aus getMine() reicht dafuer nicht: ihr fehlen kategori_slug,
   *  der Zustandscode und die Fotos. */
  getOne: (id: string) => ve.get<any>(`/ilanlar/${id}`),
  create: (form: FormData) => ve.postForm<Listing>('/ilanlar', form),
  update: (id: string, form: FormData) => ve.putForm<any>(`/ilanlar/${id}`, form),
  delete: (id: string) => ve.del(`/ilanlar/${id}`),
}

// ---- Mesajlar ----
export const mesajlarApi = {
  getChats: () => ve.get<any[]>('/mesajlar/konusmalar'),
  getChat: (id: string) => ve.get<any[]>(`/mesajlar/konusma/${id}`),
  sendMessage: (id: string, text: string) =>
    ve.post(`/mesajlar/konusma/${id}`, { metin: text }),
}

// ---- Favoriler ----
export const favorilerApi = {
  /**
   * Die Route antwortet mit `{ ilanlar: [...] }`, nicht mit einem Array — die
   * frühere Typzusage `Listing[]` war schlicht falsch. Das Dashboard setzte
   * das Objekt direkt als Liste: `length` war undefined, der Leerzustand griff
   * nicht, und `.map(...)` warf beim Rendern. Ergebnis war eine weisse Seite.
   * Hier wird ausgepackt UND abgebildet, damit Aufrufer echte Listings
   * bekommen — die Rohzeilen tragen baslik/fiyat, nicht title/price.
   */
  getAll: async (): Promise<Listing[]> => {
    const d = await ve.get<any>('/favoriler')
    const roh = Array.isArray(d) ? d : (d && Array.isArray(d.ilanlar) ? d.ilanlar : [])
    return roh.map(ilanZuListing)
  },
  add: (id: string) => ve.post(`/favoriler/${id}`),
  remove: (id: string) => ve.del(`/favoriler/${id}`),
}

// ---- Ayarlar ----
export const ayarlarApi = {
  get: () => ve.get<any>('/ayarlar'),
  update: (data: any) => {
    const token = localStorage.getItem('sg_token')
    return fetch(`${BASE}/ayarlar`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.message || 'Hata') })
      return r.status === 204 ? undefined : r.json()
    })
  },
}

// ---- KYC ----
export const kycApi = {
  submit: (form: FormData) => ve.postForm<any>('/kyc/submit', form),
}

// ---- GSM ----
export const gsmApi = {
  gonder: (phone?: string) => ve.post<any>('/gsm/gonder', phone ? { phone } : undefined),
  dogrula: (code: string) => ve.post<any>('/gsm/dogrula', { code }),
}

// ---- Profile ----
export const profileApi = {
  uploadAvatar: (blob: Blob) => {
    const form = new FormData()
    form.append('avatar', blob, 'avatar.webp')
    return ve.postForm<any>('/users/avatar', form)
  },
  updateProfile: (data: any) => ve.put<any>('/users/profil', data),
}

// ---- Adresler ----
export const adreslerApi = {
  getAll: () => ve.get<any[]>('/adresler'),
  create: (data: any) => ve.post<any>('/adresler', data),
  update: (id: string | number, data: any) => ve.put<any>(`/adresler/${id}`, data),
  delete: (id: string | number) => ve.del(`/adresler/${id}`),
}

// ---- Değerlendirmeler ----
export const degerlendirmeApi = {
  getStats: () => ve.get<any>('/degerlendirme/istatistik'),
  getLast: (limit = 6) => ve.get<any>(`/degerlendirme/son?limit=${limit}`),
}

// ---- Destek ----
export const destekApi = {
  sendBot: (mesaj: string, konuId?: string) =>
    ve.post<any>('/destek/bot', { mesaj, konu_id: konuId }),
  sendTicket: (data: any) => ve.post<any>('/destek/ticket', data),
  sendOneri: (data: any) => ve.post<any>('/destek/oneri', data),
  getWhatsapp: () => ve.get<any>('/whatsapp-ayar'),
}

// ---- Abonelik ----
export const abonelikApi = {
  getPaketler: () => ve.get<any>('/abonelik/paketler'),
  checkKupon: (kod: string) => ve.get<any>(`/abonelik/kupon-kontrol?kod=${encodeURIComponent(kod)}`),
  satinAl: (data: any) => ve.post<any>('/abonelik/satin-al', data),
}

// ---- Types ----
export interface User {
  id: string
  ad?: string
  soyad?: string
  email?: string
  phone?: string
  telefon?: string
  avatar_url?: string
  hesap_tipi?: 'bireysel' | 'kurumsal'
  kvkk_onay?: boolean
  gsm_onay?: boolean
  phone_verified?: boolean
  kyc_durum?: string
  kyc_durumu?: string
  takma_ad?: string
  takma_ad_aktif?: boolean
  sehir?: string
  ilce?: string
  hakkinda?: string
  firma_adi?: string
  vkn?: string
  mersis_no?: string
  ticari_adres?: string
  yetkili_kisi?: string
  sektor?: string
}

export interface Listing {
  id: string
  title: string
  price: number
  category: string        // Anzeigename, z.B. "Araba"
  categorySlug?: string   // DB-Slug, z.B. "araba" — hiergegen filtert die UI
  location: string
  date: string
  image: string
  description: string
  sellerName: string
  sellerPhone: string
  isFavorite: boolean
  condition: string
}

/** Zustandsbezeichnungen der DB in die Anzeige uebersetzen. */
export const DURUM_ETIKET: Record<string, string> = {
  sifir: 'Sıfır Ayarında', az_kullanilmis: 'Az Kullanılmış', ikinci_el: 'İkinci El',
}

/**
 * Eine Inseratszeile der API in die Listing-Form bringen.
 *
 * Liegt hier und nicht in App.tsx, weil inzwischen mehrere Stellen aus
 * API-Antworten Karten bauen (Detail-Direktaufruf, "Benzer Ilanlar"). Zwei
 * Kopien waeren zwei Orte, an denen ein neues Feld vergessen werden kann.
 */
export const ilanZuListing = (d: any): Listing => ({
  id: String(d.uuid || d.id),
  title: d.baslik || '',
  price: Number(d.fiyat) || 0,
  category: d.kategori_ad || '',
  categorySlug: d.kategori_slug || '',
  location: [d.ilce, d.sehir].filter(Boolean).join(', '),
  date: 'Yeni',
  image: d.ana_foto || d.foto_url || (d.fotograflar && d.fotograflar[0]?.url) || '',
  description: d.aciklama || '',
  sellerName: [d.ad, d.soyad].filter(Boolean).join(' ') || 'Satıcı',
  sellerPhone: d.phone || '',
  isFavorite: false,
  condition: DURUM_ETIKET[d.durum] || 'İkinci El',
})

export interface Chat {
  id: string
  listingId?: string
  baslik?: string
  alici_id?: string
  alici_ad?: string
  satici_ad?: string
  son_mesaj?: string
  unread?: boolean
}

export interface Message {
  id: string
  sender?: string
  text?: string
  metin?: string
  timestamp?: string
  gonderen_id?: string
}

// ---- Satıcı (öffentliches Verkäuferprofil) ----
export const saticiApi = {
  getProfil: (id: string) => ve.get<any>(`/satici/${id}/profil`),
  getIlanlar: (id: string) => ve.get<any>(`/satici/${id}/ilanlar`),
}

// ---- Kayıtlı Aramalar (gespeicherte Suchen) ----
export const kayitliAramaApi = {
  getAll: () => ve.get<any[]>('/kayitli-aramalar'),
  save: (data: { arama_terimi?: string | null; kategori_id?: string | null; fiyat_min?: number | null; fiyat_max?: number | null }) =>
    ve.post<any>('/kayitli-aramalar', data),
  delete: (id: string | number) => ve.del(`/kayitli-aramalar/${id}`),
  toggleBildirim: (id: string | number) => ve.put<any>(`/kayitli-aramalar/${id}/bildirim`, {}),
}
