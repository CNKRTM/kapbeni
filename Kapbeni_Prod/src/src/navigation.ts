// ════════════════════════════════════════════════════════════════════════════
//  Browser-History für die SPA.
//
//  Vorher hatte die App gar keine History-Anbindung: die Ansicht steckte
//  ausschließlich in React-State (activeTab, selectedListing, …), der Browser
//  kannte nur den initialen Seitenaufruf. Zurück verließ deshalb kapbeni.com.
//
//  Hier wird der sichtbare Zustand auf eine Hash-URL abgebildet und zurück.
//  Hash statt Pfad, weil die Legal-Seiten bereits Hash nutzen (#/kullanim-…)
//  und nginx alles auf index.html leitet — so bleiben beide Systeme verträglich.
// ════════════════════════════════════════════════════════════════════════════

export interface NavState {
  tab: string
  ilanId?: string | null      // UUID — Detailansicht
  kategori?: string | null    // Slug — Kategorie-Ansicht
  saticiId?: string | null    // Verkäuferprofil
  panelTab?: string | null    // Unterreiter im Panel
  sohbetId?: string | null    // geöffnete Konversation
  q?: string | null           // abgeschickter Suchbegriff
}

// Hash-Adressen der Legal-Seiten. Diese verwaltet App.tsx weiterhin selbst;
// hashZuNav() gibt für sie null zurück, damit sich beide nicht ins Gehege kommen.
export const LEGAL_HASHES = [
  '#/kullanim-kosullari', '#/gizlilik-politikasi', '#/mesafeli-satis',
  '#/cerez-politikasi', '#/iade-politikasi', '#/hakkimizda',
  '#/nasil-calisir', '#/guvenli-alisveris',
]

const TAB_ZU_PFAD: Record<string, string> = {
  home: '/', discover: '/kesfet', messages: '/mesajlar', favorites: '/favoriler',
  dashboard: '/panel', admin: '/admin', profile: '/profil', ayarlar: '/ayarlar',
}
const PFAD_ZU_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_ZU_PFAD).map(([t, p]) => [p, t])
)

/** Sichtbarer Zustand → Hash. Reihenfolge = Spezifität: das Konkreteste gewinnt. */
export function navZuHash(s: NavState): string {
  if (s.tab === 'details' && s.ilanId) return `#/ilan/${encodeURIComponent(s.ilanId)}`
  if (s.tab === 'satici' && s.saticiId) return `#/satici/${encodeURIComponent(s.saticiId)}`
  if (s.tab === 'messages' && s.sohbetId) return `#/mesajlar/${encodeURIComponent(s.sohbetId)}`
  if (s.tab === 'dashboard' && s.panelTab) return `#/panel/${encodeURIComponent(s.panelTab)}`
  if (s.tab === 'discover') {
    if (s.kategori) return `#/kategori/${encodeURIComponent(s.kategori)}`
    if (s.q) return `#/arama?q=${encodeURIComponent(s.q)}`
  }
  return '#' + (TAB_ZU_PFAD[s.tab] || '/')
}

/**
 * Hash → sichtbarer Zustand.
 * null bedeutet: nicht zuständig (Legal-Seite oder unbekannt) — App.tsx
 * entscheidet dann selbst, damit wir keine fremden Hashes überschreiben.
 */
/** decodeURIComponent wirft bei kaputtem Percent-Encoding ("100%", "%E0%A4%A").
 *  Ein einziges verstuemmeltes Zeichen in einem geteilten Link wuerde sonst die
 *  gesamte App beim Start abbrechen — weisse Seite ohne Navbar und Footer. */
const sicherDecode = (v: string): string => {
  try { return decodeURIComponent(v) } catch { return v }
}

export function hashZuNav(hash: string): NavState | null {
  const h = (hash || '').trim()
  if (!h || h === '#' || h === '#/') return { tab: 'home' }
  if (LEGAL_HASHES.includes(h)) return null

  const [pfadTeil, queryTeil] = h.replace(/^#/, '').split('?')
  let params: URLSearchParams
  try { params = new URLSearchParams(queryTeil || '') } catch { params = new URLSearchParams() }
  const teile = pfadTeil.split('/').filter(Boolean)
  if (!teile.length) return { tab: 'home' }

  const [kopf, rest] = [teile[0], teile[1] ? sicherDecode(teile[1]) : null]
  switch (kopf) {
    case 'ilan':     return rest ? { tab: 'details', ilanId: rest } : { tab: 'home' }
    case 'satici':   return rest ? { tab: 'satici', saticiId: rest } : { tab: 'home' }
    case 'kategori': return rest ? { tab: 'discover', kategori: rest } : { tab: 'discover' }
    case 'arama':    return { tab: 'discover', q: sicherDecode(params.get('q') || '') }
    case 'mesajlar': return { tab: 'messages', sohbetId: rest }
    case 'panel':    return { tab: 'dashboard', panelTab: rest }
    default: {
      const tab = PFAD_ZU_TAB['/' + kopf]
      return tab ? { tab } : null
    }
  }
}

/** Vergleichsschlüssel — verhindert doppelte History-Einträge für denselben Zustand. */
export const navSchluessel = (s: NavState) =>
  [s.tab, s.ilanId || '', s.kategori || '', s.saticiId || '', s.panelTab || '', s.sohbetId || '', s.q || ''].join('|')
