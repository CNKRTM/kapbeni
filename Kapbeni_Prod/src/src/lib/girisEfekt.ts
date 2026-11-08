// Login-Effekte nach Santral-Vorbild (v1.36, Vorlage: Santral docs/LOGIN-EFFEKTE.md),
// in den Kap-Beni-Farben. Dieselbe Logik steckt im Express-Admin (admin/public/index.html,
// kpStreifen/kpLicht/kpEinklappen) — Änderungen an beiden Stellen nachziehen.
// Reines DOM, damit React die Klassen intro/reveal/shake nicht kennen muss: die Karte
// trägt einen festen className, React fasst classList beim Neurendern also nicht an.

export const ruhig = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Schräg fallende Lichtstreifen; jede Runde neue Position, Neigung, Länge, Dauer, Deckkraft. */
export function lichtstreifen(ziel: HTMLElement | null, anzahl = 9): () => void {
  if (!ziel || ruhig()) return () => {}
  const box = document.createElement('div')
  box.className = 'kp-streifen'
  box.setAttribute('aria-hidden', 'true')
  ziel.prepend(box)
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  const setze = (s: HTMLSpanElement) => {
    const rot = rnd(-34, -20)
    s.style.left = rnd(-5, 105) + '%'
    s.style.setProperty('--rot', rot + 'deg')
    s.style.setProperty('--dx', Math.tan((-rot * Math.PI) / 180) * -125 + 'vh')
    s.style.setProperty('--h', rnd(28, 60) + 'vh')
    s.style.setProperty('--w', (s.classList.contains('soft') ? rnd(6, 12) : rnd(1.5, 3.5)) + 'px')
    s.style.setProperty('--dur', rnd(6, 12) + 's')
    s.style.setProperty('--op', rnd(0.45, 0.85).toFixed(2))
  }
  for (let i = 0; i < anzahl; i++) {
    const s = document.createElement('span')
    s.className = 'kp-streif' + (i % 3 === 0 ? ' soft' : '')
    setze(s)
    s.style.setProperty('--delay', (-rnd(0, 10)).toFixed(2) + 's')
    s.addEventListener('animationiteration', () => setze(s))
    box.append(s)
  }
  return () => box.remove()
}

/** Lichtschein in der Karte folgt der Maus; eingeklappt folgt die Kugel. */
export function lichtFolgt(flaeche: HTMLElement | null, karte: HTMLElement | null): () => void {
  if (!flaeche || !karte) return () => {}
  const f = (ev: PointerEvent) => {
    const c = karte.getBoundingClientRect()
    if (!c.width) return
    const x = ((ev.clientX - c.left) / c.width) * 100, y = ((ev.clientY - c.top) / c.height) * 100
    karte.style.setProperty('--mx', x + '%')
    karte.style.setProperty('--my', y + '%')
    if (karte.classList.contains('intro')) {
      karte.style.setProperty('--ox', Math.min(85, Math.max(15, x)) + '%')
      karte.style.setProperty('--oy', Math.min(85, Math.max(15, y)) + '%')
    }
  }
  flaeche.addEventListener('pointermove', f)
  return () => flaeche.removeEventListener('pointermove', f)
}

export function schuetteln(karte: HTMLElement | null) {
  if (!karte || ruhig()) return
  karte.classList.remove('shake')
  void karte.offsetWidth
  karte.classList.add('shake')
}

/**
 * Ruhezustand 170×170 (Raute + Kugel). Maus, Fokus oder Klick klappt auf, Verlassen klappt
 * nach 500 ms wieder zu — außer ein Feld hat den Fokus, die Maus steht über der Karte
 * (auch über dem Turnstile-iframe) oder `fehler()` meldet eine sichtbare Meldung.
 * Zielgröße: Breite = max-width der Karte (höchstens Platz im Container), Höhe = Summe der
 * Inhaltshöhen, höchstens max-height. Nach 800 ms fallen die festen Maße weg.
 * Rückgabe: Aufräumfunktion und `auf()` zum Aufklappen von außen (z. B. bei Fehler).
 */
export function einklappen(karte: HTMLElement | null, fehler: () => boolean = () => false) {
  const leer = { aufraeumen: () => {}, auf: () => {}, aktiv: false }
  if (!karte || ruhig()) return leer
  const inhalt = karte.querySelector<HTMLElement>('.kp-inhalt')
  const wrap = karte.parentElement
  if (!inhalt || !wrap) return leer
  inhalt.querySelectorAll<HTMLElement>('form > *, :scope > *').forEach((e, i) => e.style.setProperty('--i', String(i)))
  let offen = false
  let tmr: number | undefined, settle: number | undefined
  const px = (v: string, sonst: number) => { const n = parseFloat(v); return Number.isFinite(n) ? n : sonst }
  const breite = () => Math.min(wrap.clientWidth, px(getComputedStyle(karte).maxWidth, wrap.clientWidth))
  const hoehe = () => {
    let h = 0
    for (const k of Array.from(inhalt.children) as HTMLElement[]) h += k.scrollHeight
    return Math.min(h, px(getComputedStyle(karte).maxHeight, h))
  }
  const zu = (sofort = false) => {
    offen = false
    window.clearTimeout(settle)
    if (sofort) karte.style.transition = 'none'
    karte.style.width = karte.offsetWidth + 'px'
    karte.style.height = karte.offsetHeight + 'px'
    void karte.offsetHeight
    karte.style.width = '170px'
    karte.style.height = '170px'
    karte.classList.remove('reveal')
    karte.classList.add('intro')
    if (sofort) { void karte.offsetHeight; karte.style.transition = '' }
  }
  const auf = () => {
    window.clearTimeout(tmr)
    if (offen) return
    offen = true
    karte.style.width = breite() + 'px'
    karte.style.height = hoehe() + 'px'
    karte.classList.remove('intro')
    karte.classList.add('reveal')
    settle = window.setTimeout(() => { if (offen) { karte.style.width = ''; karte.style.height = '' } }, 800)
  }
  const bleibt = () => karte.contains(document.activeElement) || karte.matches(':hover') || fehler()
  const spaeter = () => { window.clearTimeout(tmr); tmr = window.setTimeout(() => { if (!bleibt()) zu() }, 500) }
  // Touch: pointerleave kommt direkt nach dem Tippen — dort nur über focusout zuklappen
  const verlassen = (e: PointerEvent) => { if (e.pointerType !== 'touch') spaeter() }
  karte.addEventListener('pointerenter', auf)
  karte.addEventListener('pointerleave', verlassen)
  karte.addEventListener('focusin', auf)
  karte.addEventListener('focusout', spaeter)
  karte.addEventListener('click', auf)
  // Santral Fill und Passwortmanager setzen Werte per Skript (input/change ohne Fokus/Maus) — dann
  // ebenfalls aufklappen. Die Felder bleiben eingeklappt im DOM (nur opacity 0), sonst greift das Füllen nicht.
  karte.addEventListener('input', auf)
  karte.addEventListener('change', auf)
  zu(true)
  if (fehler()) window.setTimeout(auf, 300)
  return {
    aktiv: true,
    auf,
    aufraeumen: () => {
      window.clearTimeout(tmr); window.clearTimeout(settle)
      karte.removeEventListener('pointerenter', auf)
      karte.removeEventListener('pointerleave', verlassen)
      karte.removeEventListener('focusin', auf)
      karte.removeEventListener('focusout', spaeter)
      karte.removeEventListener('click', auf)
      karte.removeEventListener('input', auf)
      karte.removeEventListener('change', auf)
      karte.classList.remove('intro', 'reveal')
      karte.style.width = ''; karte.style.height = ''
    },
  }
}
