// ════════════════════════════════════════════════════════════════════════════
//  Zentrale Quelle für Kategorien + Live-Inseratszahlen.
//
//  Ersetzt die frühere statische Liste in data/categories.ts. Grund: die
//  statische Liste und die Tabelle `kategoriler` waren auseinandergelaufen
//  (269 vs. 351 Einträge, nur 74 gemeinsame Slugs). Dadurch fand der
//  Kategorie-Filter Inserate nicht, deren DB-Kategorie im Frontend gar nicht
//  existierte (z.B. spor-outdoor).
//
//  Die Zahlen kommen live aus GET /api/kategoriler; dort wird bei jedem Aufruf
//  frisch gezählt (`adet` = inkl. aller Unterkategorien, `adet_direkt` = nur
//  direkte Zuordnung). Es gibt keine gepflegte Zählerspalte, die veralten kann.
//  Nach dem Anlegen oder Löschen eines Inserats invalidateKategoriAgac()
//  aufrufen, dann laden alle Ansichten neu.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { ve } from '../api'

export interface SubCategory {
  id: string        // DB-Slug — identisch mit dem, was der Filter vergleicht
  dbId: number      // numerische kategoriler.id — die API erwartet sie beim Anlegen
  label: string
  group?: string    // Ebene-2-Name; bildet die Spalten im Mega-Menü
  adet: number      // aktive Inserate inkl. Unterkategorien
}

export interface Category {
  id: string        // DB-Slug
  dbId: number      // numerische kategoriler.id
  label: string
  icon: string      // Tabler-Klasse (ti-*)
  adet: number
  sub: SubCategory[]
}

// Die DB führt für Hauptkategorien nur Emojis. Die gewohnten Tabler-Icons
// bleiben über diese Zuordnung erhalten; unbekannte Slugs fallen auf das
// Emoji aus der DB zurück, neue Kategorien brauchen hier keinen Eintrag.
const TABLER_ICON: Record<string, string> = {
  'araba': 'ti-car',
  'telefon': 'ti-device-mobile',
  'elektronik': 'ti-cpu',
  'ev-yasam': 'ti-armchair',
  'motosiklet': 'ti-motorbike',
  'giyim-aksesuar': 'ti-shirt',
  'kisisel-bakim-kozmetik': 'ti-sparkles',
  'anne-bebek-oyuncak': 'ti-baby-carriage',
  'hobi-kitap-muzik': 'ti-music',
  'ofis-kirtasiye': 'ti-briefcase',
  'spor-outdoor': 'ti-barbell',
  'diger-araclar': 'ti-truck',
  'yapi-market-bahce': 'ti-hammer',
  'pet-shop': 'ti-paw',
  'antika': 'ti-building-arch',
}

interface ApiDetay { id: number; ad: string; slug: string; adet: number; adet_direkt: number }
interface ApiAlt { id: number; ad: string; slug: string; adet: number; adet_direkt: number; detaylar: ApiDetay[] }
interface ApiAna { id: number; ad: string; slug: string; icon: string; adet: number; adet_direkt: number; altKategoriler: ApiAlt[] }

// API-Baum → die Form, die Navigation, Dropdown, Sidebar und Mega-Menü erwarten.
// Ebene 2 wird selbst zum Eintrag UND zur Gruppenüberschrift ihrer Ebene-3-Kinder;
// so entstehen die Spalten "Araba / Oto Yedek Parça / Jant & Lastik / …".
export function adapt(api: ApiAna[]): Category[] {
  return (api || []).map(a => ({
    id: a.slug,
    dbId: a.id,
    label: a.ad,
    icon: TABLER_ICON[a.slug] || a.icon || 'ti-package',
    adet: a.adet ?? 0,
    sub: (a.altKategoriler || []).flatMap(al => [
      { id: al.slug, dbId: al.id, label: al.ad, group: al.ad, adet: al.adet ?? 0 },
      ...(al.detaylar || []).map(d => ({ id: d.slug, dbId: d.id, label: d.ad, group: al.ad, adet: d.adet ?? 0 })),
    ]),
  }))
}

// ── Modul-weiter Zustand: ein Fetch für alle Ansichten ──────────────────────
let cache: Category[] | null = null
let inflight: Promise<Category[]> | null = null
const abonnenten = new Set<(c: Category[]) => void>()

async function laden(): Promise<Category[]> {
  if (inflight) return inflight
  inflight = ve.get<ApiAna[]>('/kategoriler')
    .then(res => {
      cache = adapt(res)
      abonnenten.forEach(fn => fn(cache!))
      return cache
    })
    .catch(() => (cache = cache || []))
    .finally(() => { inflight = null })
  return inflight
}

/** Nach dem Anlegen/Löschen eines Inserats aufrufen — lädt die Zahlen neu. */
export function invalidateKategoriAgac() {
  cache = null
  laden()
}

export function useKategoriAgac(): { kategoriler: Category[]; loading: boolean } {
  const [kategoriler, setKategoriler] = useState<Category[]>(cache || [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let aktiv = true
    const abo = (c: Category[]) => { if (aktiv) setKategoriler(c) }
    abonnenten.add(abo)
    if (cache) { setKategoriler(cache); setLoading(false) }
    else laden().then(c => { if (aktiv) { setKategoriler(c); setLoading(false) } })
    return () => { aktiv = false; abonnenten.delete(abo) }
  }, [])

  return { kategoriler, loading }
}

/** Anzeigeform: "Araba (2)" — überall identisch, damit die vier Ansichten nicht auseinanderlaufen. */
export const mitAnzahl = (label: string, adet: number) => `${label} (${adet})`

/** Slug → numerische kategoriler.id. Wird beim Anlegen eines Inserats gebraucht,
 *  weil POST /api/ilanlar kategori_id erwartet. */
export function dbIdVonSlug(kats: Category[], slug: string | null): number | null {
  if (!slug) return null
  for (const k of kats) {
    if (k.id === slug) return k.dbId
    const s = k.sub.find(x => x.id === slug)
    if (s) return s.dbId
  }
  return null
}
