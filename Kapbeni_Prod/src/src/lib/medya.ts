// Namensregel der kleinen Bildvariante — identisch zu api/src/lib/bild.js kleinUrl().
//   /uploads/ilanlar/<uuid>_0_lg.webp → …_0_sm.webp   (ab v1.27)
//   /uploads/ilanlar/<uuid>_0.webp    → …_0_sm.webp   (Bestand, per Skript nachgezogen)
// Fremde Adressen (Unsplash u. a.) haben keine kleine Variante → null.
export function kleinUrl(url?: string | null): string | null {
  if (!url || !/^\/uploads\/ilanlar\/[^/]+\.webp$/.test(url)) return null
  if (/_sm\.webp$/.test(url)) return url
  if (/_lg\.webp$/.test(url)) return url.replace(/_lg\.webp$/, '_sm.webp')
  return url.replace(/\.webp$/, '_sm.webp')
}

/** sizes-Vorgaben je Ort (Breite, in der das Bild tatsaechlich erscheint). */
export const SIZES = {
  karteRaster: '(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw',
  karteListe: '96px',
  kachel: '200px',
  mini: '120px',
}
