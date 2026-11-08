// Zuerst: registriert den popstate-Waechter fuer Fenster (Auftragssammlung K)
import { startNachOverlayBereinigung } from './lib/geriTusu'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import App from './App'

// Scrollposition stellt App.tsx je History-Station selbst wieder her.
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

startNachOverlayBereinigung(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
))
