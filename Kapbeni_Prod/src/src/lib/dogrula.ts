// ════════════════════════════════════════════════════════════════════════════
//  Gemeinsame Pruefungen fuer Formularfelder (Telefon, TCKN, VKN).
//
//  Dieselben Regeln stehen in der API unter api/src/lib/dogrula.js. Die API
//  prueft immer selbst nach; hier geht es darum, dass der Nutzer den Fehler
//  schon beim Tippen sieht und nicht erst nach dem Absenden.
// ════════════════════════════════════════════════════════════════════════════

export const TELEFON_HATA = 'Geçerli bir cep telefonu numarası girin (+90 5XX XXX XX XX).'
export const TCKN_HATA = 'Geçersiz T.C. Kimlik No. 11 haneli numaranızı kontrol edin.'
export const VKN_HATA = 'Geçersiz Vergi Kimlik No. 10 haneli VKN veya şahıs şirketleri için 11 haneli T.C. Kimlik No girin.'

/**
 * Telefonnummer auf E.164 bringen: +905XXXXXXXXX.
 * Alle Nichtziffern weg, fuehrendes 0090 / 90 / 0 ab. Danach genau 10 Ziffern,
 * die erste ist 5. null = ungueltig.
 */
export function telefonNormalize(roh: string | null | undefined): string | null {
  if (roh == null) return null
  let d = String(roh).replace(/\D/g, '')
  if (d.startsWith('0090')) d = d.slice(4)
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  if (!/^5\d{9}$/.test(d)) return null
  return '+90' + d
}

/** Anzeige: +90 5XX XXX XX XX. Unbekanntes bleibt, wie es ist. */
export function telefonGoster(wert: string | null | undefined): string {
  const e = telefonNormalize(wert)
  if (!e) return wert || ''
  const d = e.slice(3)
  return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`
}

/** T.C. Kimlik No: 11 Ziffern, erste nicht 0, Pruefziffern 10 und 11. */
export function tcknGecerli(roh: string | null | undefined): boolean {
  const tc = String(roh || '').replace(/\D/g, '')
  if (!/^[1-9]\d{10}$/.test(tc)) return false
  const d = tc.split('').map(Number)
  const tek = d[0] + d[2] + d[4] + d[6] + d[8]
  const cift = d[1] + d[3] + d[5] + d[7]
  if ((((tek * 7 - cift) % 10) + 10) % 10 !== d[9]) return false
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10]
}

/** Vergi Kimlik No: 10 Ziffern, offizieller GİB-Algorithmus. */
export function vknGecerli(roh: string | null | undefined): boolean {
  const v = String(roh || '').replace(/\D/g, '')
  if (!/^\d{10}$/.test(v)) return false
  const d = v.split('').map(Number)
  let toplam = 0
  for (let i = 0; i < 9; i++) {
    const t = (d[i] + 9 - i) % 10
    toplam += t === 9 ? 9 : (t * Math.pow(2, 9 - i)) % 9
  }
  return (10 - (toplam % 10)) % 10 === d[9]
}

/** Steuernummer eines Haendlers: VKN (10) oder TCKN (11, Şahıs şirketi). */
export function vergiNoGecerli(roh: string | null | undefined): boolean {
  const v = String(roh || '').replace(/\D/g, '')
  return v.length === 11 ? tcknGecerli(v) : vknGecerli(v)
}

/** Türkische Monatsnamen fuer das Abzeichen "Eylül 2026'dan beri üye". */
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

/**
 * "Eylül 2026'dan beri üye". Der Suffix haengt an der Jahreszahl und folgt der
 * Aussprache der letzten Ziffer(n): 2026 -> 'dan, 2020 -> 'den, 2030 -> 'dan.
 */
export function uyelikMetni(tarih: string | Date | null | undefined): string | null {
  if (!tarih) return null
  const t = new Date(tarih)
  if (isNaN(t.getTime())) return null
  const yil = t.getFullYear()
  return `${AYLAR[t.getMonth()]} ${yil}'${yilEki(yil)} beri üye`
}

function yilEki(yil: number): string {
  // Ausgesprochene Endung der Zahl bestimmt die Vokalharmonie (ablativ -dan/-den/-tan/-ten).
  const n = yil % 100
  const birler = yil % 10
  // Zehner, wenn die Einerstelle 0 ist: 10 on, 20 yirmi, 30 otuz, 40 kırk, 50 elli, 60 altmış, 70 yetmiş, 80 seksen, 90 doksan
  const onlar: Record<number, string> = { 1: 'dan', 2: 'den', 3: 'dan', 4: 'tan', 5: 'den', 6: 'tan', 7: 'ten', 8: 'den', 9: 'dan' }
  // Einer: 1 bir, 2 iki, 3 üç, 4 dört, 5 beş, 6 altı, 7 yedi, 8 sekiz, 9 dokuz
  const birlik: Record<number, string> = { 1: 'den', 2: 'den', 3: 'ten', 4: 'ten', 5: 'ten', 6: 'dan', 7: 'den', 8: 'den', 9: 'dan' }
  if (birler !== 0) return birlik[birler]
  if (n !== 0) return onlar[Math.floor(n / 10)]
  // 2000 iki bin -> 'den, 1900 bindokuzyüz -> 'den
  return 'den'
}
