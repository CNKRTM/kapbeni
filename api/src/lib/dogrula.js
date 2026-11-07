// ════════════════════════════════════════════════════════════════════════════
//  Gemeinsame Pruefungen fuer Formularfelder (Telefon, TCKN, VKN).
//
//  Dieselben Regeln stehen im Frontend unter Kapbeni_Prod/src/src/lib/dogrula.ts.
//  Weichen sie ab, laeuft der Nutzer erst beim Absenden in eine Fehlermeldung.
// ════════════════════════════════════════════════════════════════════════════

const TELEFON_HATA = 'Geçerli bir cep telefonu numarası girin (+90 5XX XXX XX XX).';
const TCKN_HATA = 'Geçersiz T.C. Kimlik No. 11 haneli numaranızı kontrol edin.';
const VKN_HATA = 'Geçersiz Vergi Kimlik No. 10 haneli VKN veya şahıs şirketleri için 11 haneli T.C. Kimlik No girin.';

/**
 * Telefonnummer auf E.164 bringen: +905XXXXXXXXX.
 * Regel (Auftragssammlung F): alle Nichtziffern weg, fuehrendes 0090 / 90 / 0
 * abschneiden. Danach muessen genau 10 Ziffern bleiben, die erste ist 5.
 * Rueckgabe null = ungueltig.
 */
function telefonNormalize(roh) {
  if (roh === undefined || roh === null) return null;
  let d = String(roh).replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (!/^5\d{9}$/.test(d)) return null;
  return '+90' + d;
}

/** Anzeige: +90 5XX XXX XX XX. Unbekanntes bleibt, wie es ist. */
function telefonGoster(wert) {
  const e = telefonNormalize(wert);
  if (!e) return wert || '';
  const d = e.slice(3);
  return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

/** T.C. Kimlik No: 11 Ziffern, erste nicht 0, Pruefziffern 10 und 11. */
function tcknGecerli(roh) {
  const tc = String(roh || '').replace(/\D/g, '');
  if (!/^[1-9]\d{10}$/.test(tc)) return false;
  const d = tc.split('').map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8];
  const cift = d[1] + d[3] + d[5] + d[7];
  if ((((tek * 7 - cift) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** Vergi Kimlik No: 10 Ziffern, offizieller GİB-Algorithmus (Ziffern 1–9 -> 10). */
function vknGecerli(roh) {
  const v = String(roh || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(v)) return false;
  const d = v.split('').map(Number);
  let toplam = 0;
  for (let i = 0; i < 9; i++) {
    const t = (d[i] + 9 - i) % 10;
    toplam += t === 9 ? 9 : (t * Math.pow(2, 9 - i)) % 9;
  }
  return (10 - (toplam % 10)) % 10 === d[9];
}

/** Steuernummer eines Haendlers: VKN (10) oder TCKN (11, Şahıs şirketi). */
function vergiNoGecerli(roh) {
  const v = String(roh || '').replace(/\D/g, '');
  return v.length === 11 ? tcknGecerli(v) : vknGecerli(v);
}

module.exports = {
  telefonNormalize, telefonGoster, tcknGecerli, vknGecerli, vergiNoGecerli,
  TELEFON_HATA, TCKN_HATA, VKN_HATA,
};
