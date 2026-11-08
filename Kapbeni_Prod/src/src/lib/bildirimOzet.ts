// Zaehler fuer Glocke (Benachrichtigungen) und Mesajlar-Abzeichen (ungelesene
// Chat-Nachrichten), v1.35. Vorher kam das Mesajlar-Abzeichen aus Mock-Daten.
// Laedt alle 30 s (nur bei sichtbarem Tab), beim Zurueckkehren in den Tab und
// auf das Ereignis 'kapbeni:bildirim-yenile' (z.B. nach Oeffnen eines Chats).
import { useCallback, useEffect, useState } from 'react'
import { bildirimlerApi, type BildirimOzet } from '../api'

export const BILDIRIM_YENILE = 'kapbeni:bildirim-yenile'
export const bildirimYenile = () => { try { window.dispatchEvent(new Event(BILDIRIM_YENILE)) } catch { /* SSR/Test */ } }

const LEER: BildirimOzet = { bildirim: 0, mesaj: 0 }

export function useBildirimOzet(angemeldet: boolean) {
  const [ozet, setOzet] = useState<BildirimOzet>(LEER)
  const yenile = useCallback(async () => {
    if (!angemeldet) { setOzet(LEER); return }
    try {
      const d = await bildirimlerApi.ozet()
      if (d && typeof d.bildirim === 'number') setOzet({ bildirim: d.bildirim, mesaj: d.mesaj || 0 })
    } catch { /* offline/abgemeldet: alten Stand behalten */ }
  }, [angemeldet])

  useEffect(() => {
    yenile()
    if (!angemeldet) return
    const takt = setInterval(() => { if (document.visibilityState === 'visible') yenile() }, 30000)
    const sichtbar = () => { if (document.visibilityState === 'visible') yenile() }
    document.addEventListener('visibilitychange', sichtbar)
    window.addEventListener(BILDIRIM_YENILE, yenile)
    return () => {
      clearInterval(takt)
      document.removeEventListener('visibilitychange', sichtbar)
      window.removeEventListener(BILDIRIM_YENILE, yenile)
    }
  }, [angemeldet, yenile])

  return { ...ozet, yenile }
}
