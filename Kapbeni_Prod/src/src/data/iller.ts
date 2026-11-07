// ════════════════════════════════════════════════════════════════════════════
//  İl / İlçe aus der Datenbank (iller: 81, ilceler: 973) ueber /api/iller.
//
//  Loest die statische data/cities.ts ab (nur 80 İl, Aksaray fehlte). Die
//  Listen werden einmal je Sitzung geholt und im Modul zwischengespeichert —
//  mehrere Formulare auf einer Seite loesen also keinen Mehrfachabruf aus.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'

export interface Il { kod: number; ad: string }

let illerSpeicher: Il[] | null = null
let illerLaeuft: Promise<Il[]> | null = null
const ilceSpeicher = new Map<number, string[]>()
const ilceLaeuft = new Map<number, Promise<string[]>>()

/** Tuerkisch-bewusst vergleichen ('Hakkâri' = 'Hakkari', 'İstanbul' = 'istanbul').
 *  Dieselbe Faltung wie in api/src/routes/iller.js. */
export function tuerkischFalten(v: string): string {
  const karte: Record<string, string> = { 'İ':'i','I':'i','ı':'i','Ş':'s','ş':'s','Ğ':'g','ğ':'g',
    'Ü':'u','ü':'u','Ö':'o','ö':'o','Ç':'c','ç':'c','Â':'a','â':'a','Î':'i','î':'i','Û':'u','û':'u' }
  return String(v || '')
    .replace(/[İIıŞşĞğÜüÖöÇçÂâÎîÛû]/g, (c) => karte[c]).toLowerCase().replace(/[^a-z0-9]/g, '')
}
export const tuerkischGleich = (a: string, b: string) => tuerkischFalten(a) === tuerkischFalten(b)

export function illerYukle(): Promise<Il[]> {
  if (illerSpeicher) return Promise.resolve(illerSpeicher)
  if (!illerLaeuft) {
    illerLaeuft = fetch('/api/iller')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Il[]) => {
        const liste = (Array.isArray(d) ? d : []).slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))
        if (liste.length) illerSpeicher = liste
        return liste
      })
      .catch(() => [])
      .finally(() => { illerLaeuft = null })
  }
  return illerLaeuft
}

export function ilcelerYukle(kod: number): Promise<string[]> {
  const da = ilceSpeicher.get(kod)
  if (da) return Promise.resolve(da)
  let p = ilceLaeuft.get(kod)
  if (!p) {
    p = fetch(`/api/iller/${kod}/ilceler`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: { ad: string }[]) => {
        const liste = (Array.isArray(d) ? d : []).map((x) => x.ad).sort((a, b) => a.localeCompare(b, 'tr'))
        if (liste.length) ilceSpeicher.set(kod, liste)
        return liste
      })
      .catch(() => [])
      .finally(() => { ilceLaeuft.delete(kod) })
    ilceLaeuft.set(kod, p)
  }
  return p
}

/** Alle 81 İl, alphabetisch (tr). Leer, solange die Liste laedt. */
export function useIller(): Il[] {
  const [iller, setIller] = useState<Il[]>(illerSpeicher || [])
  useEffect(() => {
    if (illerSpeicher) return
    let aktiv = true
    illerYukle().then((l) => { if (aktiv) setIller(l) })
    return () => { aktiv = false }
  }, [])
  return iller
}

/** İlçe-Namen zu einem İl-Namen (freie Eingabe erlaubt: unbekanntes İl -> leere Liste). */
export function useIlceler(ilAd: string): string[] {
  const iller = useIller()
  const il = ilAd ? iller.find((x) => tuerkischGleich(x.ad, ilAd)) : undefined
  const [ilceler, setIlceler] = useState<string[]>(il ? ilceSpeicher.get(il.kod) || [] : [])
  useEffect(() => {
    if (!il) { setIlceler([]); return }
    let aktiv = true
    const da = ilceSpeicher.get(il.kod)
    if (da) { setIlceler(da); return }
    ilcelerYukle(il.kod).then((l) => { if (aktiv) setIlceler(l) })
    return () => { aktiv = false }
  }, [il?.kod])
  return ilceler
}

/** Gespeicherten/eingegebenen Namen auf die Schreibweise der DB bringen, falls bekannt. */
export function ilAdiDuzelt(iller: Il[], ad: string): string {
  return iller.find((x) => tuerkischGleich(x.ad, ad))?.ad || ad
}
