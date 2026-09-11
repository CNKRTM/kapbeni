import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, User } from '../api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<void>
  register: (ad: string, email: string, phone: string, password: string) => Promise<void>
  loginWithToken: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sg_token'))

  useEffect(() => {
    if (localStorage.getItem('sg_token')) {
      authApi.me()
        .then((u) => { if (u) setUser(u) })
        .catch(() => { localStorage.removeItem('sg_token'); setToken(null) })
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password)
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

  const register = async (ad: string, email: string, phone: string, password: string) => {
    const data = await authApi.register(ad, email, phone, password)
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
