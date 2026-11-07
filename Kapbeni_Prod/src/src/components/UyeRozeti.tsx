// ════════════════════════════════════════════════════════════════════════════
//  Kundennummer und Abzeichen "Eylül 2026'dan beri üye" (Auftragssammlung L).
//  Chip in der Form der bestehenden Abzeichen (rounded-full, text-xs, bold),
//  neutral grau, damit es neben "Onaylı Satıcı" (gruen) nicht konkurriert.
// ════════════════════════════════════════════════════════════════════════════
import { uyelikMetni } from '../lib/dogrula'

export function UyelikChip({ tarih, className = '' }: { tarih?: string | null; className?: string }) {
  const metin = uyelikMetni(tarih)
  if (!metin) return null
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 ${className}`}>
      <i className="ti ti-calendar-check" style={{ fontSize: 13 }} />
      {metin}
    </span>
  )
}

export function MusteriNo({ no, className = '' }: { no?: string | null; className?: string }) {
  if (!no) return null
  return (
    <span className={`text-xs text-gray-500 ${className}`}>
      Müşteri No: <span className="font-mono font-semibold text-gray-700">{no}</span>
    </span>
  )
}
