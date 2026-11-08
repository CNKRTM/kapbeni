// ════════════════════════════════════════════════════════════════════════════
//  Browser-Zurück für Fenster und Overlays (Auftragssammlung K, v1.30).
//
//  Jedes Modal/Overlay legt beim Öffnen einen eigenen History-Eintrag an
//  (gleiche URL, im State steht die Liste offener Overlays `ov`). Dann gilt:
//    - Browser-Zurück / Wischgeste schließt das oberste Fenster,
//    - X, Escape, „Vazgeç" rufen history.back() auf — es bleibt kein toter
//      Eintrag zurück,
//    - schließt die App ein Fenster selbst (z. B. nach dem Speichern), wird
//      der Eintrag ebenfalls per history.back() entfernt.
//
//  history.back() ist asynchron. Damit ein unmittelbar folgender pushState
//  (neue Ansicht, nächstes Fenster) nicht vom noch ausstehenden Zurück wieder
//  entfernt wird, laufen alle Pushes über nachZurueck(): solange ein Zurück
//  aussteht, werden sie bis zum popstate zurückgestellt.
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef } from 'react'

let ausstehend = 0
let letztesPopVonUns = false
const warteschlange: (() => void)[] = []
let zaehler = 0

// Muss VOR allen anderen popstate-Handlern laufen (Modul wird früh importiert).
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    letztesPopVonUns = ausstehend > 0
    if (ausstehend > 0) ausstehend--
    if (ausstehend === 0 && warteschlange.length) {
      // erst nach den übrigen popstate-Handlern ausführen
      const jetzt = warteschlange.splice(0)
      setTimeout(() => jetzt.forEach((f) => f()), 0)
    }
  })
}

/** War das gerade verarbeitete popstate ein von der App ausgelöstes Zurück
 *  (Fenster geschlossen)? Dann ändert sich die Ansicht nicht. */
export const popVonOverlay = () => letztesPopVonUns

/** Push/Replace erst ausführen, wenn kein Zurück mehr aussteht. */
export function nachZurueck(fn: () => void) {
  if (ausstehend > 0) warteschlange.push(fn)
  else fn()
}

// Mehrere Fenster koennen im selben Moment zugehen (z. B. Bestaetigung +
// Verkaufsmaske). Zwei history.back() direkt hintereinander fassen manche
// Browser zusammen — deshalb gesammelt als EIN history.go(-n).
let geplant = 0
function zurueck() {
  geplant++
  if (geplant > 1) return
  queueMicrotask(() => {
    const n = geplant
    geplant = 0
    ausstehend++
    window.history.go(-n)
  })
}

const offeneOverlays = (): string[] => {
  const s = window.history.state
  return s && Array.isArray(s.ov) ? s.ov : []
}

/**
 * Fenster an die Browser-History koppeln.
 * @param acik   ob das Fenster gerade offen ist
 * @param kapat  schließt das Fenster wirklich (State im Aufrufer)
 * @returns      Schließen-Funktion für X/Escape/Vazgeç (geht per history.back())
 */
export function useGeriKapat(acik: boolean, kapat: () => void, { escape = false }: { escape?: boolean } = {}): () => void {
  const schluessel = useRef<string>('')
  const kapatRef = useRef(kapat)
  kapatRef.current = kapat

  useEffect(() => {
    if (!acik) return
    const k = `ov${++zaehler}`
    schluessel.current = k
    nachZurueck(() => {
      if (schluessel.current !== k) return   // inzwischen schon wieder zu
      const s = window.history.state || {}
      window.history.pushState({ ...s, ov: [...offeneOverlays(), k] }, '', window.location.href)
    })
    const onPop = () => {
      // Unser Eintrag ist nicht mehr im Stapel → Fenster schließen.
      if (schluessel.current === k && !offeneOverlays().includes(k)) {
        schluessel.current = ''
        kapatRef.current()
      }
    }
    // Escape schliesst nur das OBERSTE Fenster (z. B. die Bestaetigung ueber der Verkaufsmaske)
    const taste = (e: KeyboardEvent) => {
      if (!escape || e.key !== 'Escape' || schluessel.current !== k) return
      const ov = offeneOverlays()
      if (ov.length && ov[ov.length - 1] !== k) return
      e.stopPropagation()
      if (ov.includes(k)) zurueck(); else { schluessel.current = ''; kapatRef.current() }
    }
    window.addEventListener('popstate', onPop)
    document.addEventListener('keydown', taste)
    return () => {
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('keydown', taste)
      // Von der App geschlossen (nicht per Zurück): eigenen Eintrag entfernen.
      if (schluessel.current === k) {
        schluessel.current = ''
        if (offeneOverlays().includes(k)) zurueck()
        else warteschlange.length && nachZurueck(() => {})   // Push wurde nie ausgeführt
      }
    }
  }, [acik])

  return useCallback(() => {
    const k = schluessel.current
    if (k && offeneOverlays().includes(k)) zurueck()
    else { schluessel.current = ''; kapatRef.current() }
  }, [])
}

/** Beim Laden: steht ein Overlay-Eintrag oben (Reload bei offenem Fenster),
 *  ist das Fenster jetzt zu — den toten Eintrag vor dem Start entfernen. */
export function startNachOverlayBereinigung(start: () => void) {
  if (offeneOverlays().length) {
    window.addEventListener('popstate', () => start(), { once: true })
    window.history.back()
  } else start()
}
