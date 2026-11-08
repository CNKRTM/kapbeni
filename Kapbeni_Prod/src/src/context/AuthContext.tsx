import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, User } from '../api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  /** Liefert einen Hinweistext, z. B. wenn die Anmeldung einen Loeschantrag widerrufen hat. */
  login: (email: string, password: string, turnstile?: string | null) => Promise<string | null>
  register: (ad: string, email: string, phone: string, password: string, turnstile?: string | null) => Promise<void>
  loginWithToken: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    // Rueckkehr vom Google-Login (v1.21, Geruest): #/google-giris?token=… -> Token uebernehmen, Adresse saeubern
    const m = window.location.hash.match(/^#\/google-giris\?token=([^&]+)/)
    if (m) { try { localStorage.setItem('sg_token', decodeURIComponent(m[1])) } catch { /* privat */ } window.history.replaceState(null, '', '#/') }
    return localStorage.getItem('sg_token')
  })

  useEffect(() => {
    if (!localStorage.getItem('sg_token')) return
    let abgebrochen = false

    // Nur eine ECHTE Ablehnung beendet die Sitzung. Vorher loeschte jeder
    // Fehlschlag den Token — ein 429 aus dem Rate-Limit, ein 500 oder ein
    // Netzaussetzer genuegte, und der Nutzer war mitten im Arbeiten abgemeldet.
    // Sichtbar wurde das als "ich bin ploetzlich wieder auf der Startseite".
    const holen = (versuch: number) => {
      authApi.me()
        .then((u) => { if (u && !abgebrochen) setUser(u) })
        .catch((err: any) => {
          if (abgebrochen) return
          if (err?.message === 'Unauthorized') {
            localStorage.removeItem('sg_token')
            setToken(null)
            return
          }
          // Voruebergehender Fehler: Sitzung behalten und einmal nachfassen.
          if (versuch < 2) setTimeout(() => holen(versuch + 1), 2500)
        })
    }
    holen(1)
    return () => { abgebrochen = true }
  }, [])

  const login = async (email: string, password: string, turnstile?: string | null) => {
    const data = await authApi.login(email, password, turnstile)
    localStorage.setItem('sg_token', data.token)
    setToken(data.token)
    let id: string | undefined
    try {
      const payload = JSON.parse(atob(data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      id = payload.id ?? payload.kullanici_id ?? payload.sub
    } catch {}
    setUser({ ...(data.user || {}), id: id ?? data.user?.id })
    try {
      const fresh = await authApi.me()
      if (fresh) setUser(fresh)
    } catch {}
    return (data as any).bilgi || null
  }

  const register = async (ad: string, email: string, phone: string, password: string, turnstile?: string | null) => {
    const data = await authApi.register(ad, email, phone, password, turnstile)
    localStorage.setItem('sg_token', data.token)
    setToken(data.token)
    let id: string | undefined
    try {
      const payload = JSON.parse(atob(data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      id = payload.id ?? payload.kullanici_id ?? payload.sub
    } catch {}
    setUser({ ...(data.user || {}), id: id ?? data.user?.id })
    try {
      const fresh = await authApi.me()
      if (fresh) setUser(fresh)
    } catch {}
  }

  const loginWithToken = (t: string, u: User) => {
    localStorage.setItem('sg_token', t)
    setToken(t)
    setUser(u)
  }

  const logout = () => {
    localStorage.removeItem('sg_token')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const u = await authApi.me()
      if (u) setUser(u)
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn: !!user, login, register, loginWithToken, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
