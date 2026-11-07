// Betreiber von kapbeni.com — EINZIGE Quelle fuer Firmendaten.
// Footer, Rechtsseiten, Destek und Cookie-Banner lesen von hier; nie wieder
// Firmendaten von Hand in eine Seite schreiben (bis v1.8 stand an 9 Stellen
// noch der fruehere Betreiber "Tamer Aydın Şahıs İşletmesi").
// Quelle: compendus.com (Impressum/Footer), Stand 2026-11-07.
//
// OFFEN (vom Betreiber zu liefern, vor dem Ausrollen eintragen):
//   vkn, vergiDairesi, mersis, ticaretSicilNo
// Solange ein Feld leer ist, blenden Footer und Rechtsseiten die Zeile aus,
// statt einen Platzhalter zu zeigen.

export const SIRKET = {
  marka: 'Kap Beni',
  alanAdi: 'kapbeni.com',
  unvan: 'Compendus Bilişim Teknolojileri İthalat ve İhracat Ltd. Şti.',
  kisaUnvan: 'Compendus Ltd. Şti.',
  adres: 'Akdeniz Mah. 39741 Sok., Akdeniz Konutları 7, C Blok K:3 D:5',
  ilce: 'Mezitli',
  il: 'Mersin',
  postaKodu: '33200',
  telefon: '+90 324 60 60 523',
  telefonHref: 'tel:+903246060523',
  eposta: 'info@compendus.com',
  destekEposta: 'destek@kapbeni.com',
  web: 'https://compendus.com',
  kep: '',
  vkn: '',
  vergiDairesi: '',
  mersis: '',
  ticaretSicilNo: '',
  naceKodu: '479114',
  naceAciklama: 'İnternet üzerinden perakende ticaret / aracılık',
  // ETBİS: Kayit muss fuer kapbeni.com selbst unter Compendus bestehen. Der
  // QR/Link einer anderen Seite (z. B. cankartim.com) darf hier NICHT stehen.
  etbisDogrulamaUrl: 'https://www.eticaret.gov.tr/sitedogrulama',
} as const

export const tamAdres = () =>
  `${SIRKET.adres}, ${SIRKET.postaKodu} ${SIRKET.ilce} / ${SIRKET.il}`
