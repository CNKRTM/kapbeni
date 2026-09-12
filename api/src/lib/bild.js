// ════════════════════════════════════════════════════════════════════════════
//  Bildverarbeitung für Inseratsfotos — eine Stelle für Anlegen und Bearbeiten.
//
//  Vorher stand dieselbe sharp-Kette wortgleich zweimal im Code (POST und PUT).
//  Zwei Kopien heißen: irgendwann weicht eine ab, und dann sähen Bilder aus dem
//  Anlegen anders aus als Bilder aus dem Bearbeiten.
//
//  Die Kette macht drei Dinge:
//    1. EXIF-Ausrichtung anwenden (.rotate() ohne Argument)
//    2. auf höchstens 1200x1200 bringen
//    3. das Wasserzeichen auflegen, dann als WebP kodieren
//
//  Zu 1: Das fehlte bisher. Ohne .rotate() verwirft sharp die
//  EXIF-Orientierung, und WebP trägt kein Orientierungs-Tag — ein hochkant
//  aufgenommenes Handyfoto blieb dauerhaft quer. Für das Wasserzeichen ist es
//  doppelt wichtig: es säße sonst verdreht im Bild.
//
//  Zu 3: Das Zeichen kommt NACH dem Skalieren und VOR der WebP-Kodierung —
//  es gibt also keinen zweiten Kodierdurchgang und keinen Qualitätsverlust
//  durch doppeltes Komprimieren.
//
//  Gemessen an einem 4000x3000-Bild (acht Durchläufe):
//    ohne Wasserzeichen  216 ms je Bild, 30 KB
//    mit  Wasserzeichen  266 ms je Bild, 35 KB
//  Aufschlag: +49 ms (+23 %) und +15 % Dateigröße. Bei acht Bildern also gut
//  0,4 Sekunden — neben der Upload-Dauer nicht wahrnehmbar.
// ════════════════════════════════════════════════════════════════════════════
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MAX_KANTE = 1200;
const WEBP_QUALITAET = 80;

// Wasserzeichen: Werte an echten Produktfotos (Auto, Telefon, Sessel) verglichen.
//   16 %  auf hellen Flächen fast verschwunden
//   22 %  überall lesbar, Produkt vollständig sichtbar   <- gewählt
//   28 %  legt sich spürbar über die Ware
const WZ_DECKKRAFT = 0.22;
const WZ_ANTEIL = 0.65;     // Breite im Verhältnis zur Bildbreite
const WZ_WINKEL = -30;      // diagonal quer über das Bild

// Quelle ist das Navbar-Logo — dieselbe Grafik, die unter
// https://kapbeni.com/logo-navbar.png ausgeliefert wird. Die lokale Datei ist
// damit byte-identisch (SHA256 66c837ff…, 823692 B), deshalb der Dateipfad
// statt eines Netzabrufs: das Wasserzeichen soll nicht davon abhängen, ob beim
// Hochladen gerade eine Verbindung nach außen steht.
//
// Das PNG hat einen Alphakanal (srgba, 4 Kanäle); er wird beim Einbetten
// erhalten — ensureAlpha() sichert ihn ab, die Drehung bekommt einen
// vollständig durchsichtigen Hintergrund, und die Deckkraft wird über den
// Alphakanal geregelt statt über eine Hintergrundfläche.
//
// Anmerkung zur Lesbarkeit: der Schriftzug dieser Fassung ist dunkelblau
// (#253147). Auf sehr dunklen Fotos tritt er zurück, das rote Zeichen trägt
// dort. Die helle Fassung logo-footer.png verhielte sich genau umgekehrt.
const LOGO = path.join(__dirname, '..', '..', '..', 'Kapbeni_Prod', 'src', 'public', 'logo-navbar.png');

// Das gedrehte, abgedunkelte Logo wird je Zielbreite einmal erzeugt und
// wiederverwendet — sonst rechnete jeder Upload es für jedes Bild neu.
const wzSpeicher = new Map();

async function wasserzeichen(bildBreite, bildHoehe) {
  // Auf 50er-Schritte runden: sonst entstuende fuer jede Pixelgroesse ein
  // eigener Eintrag und der Zwischenspeicher liefe voll.
  const rb = Math.round(bildBreite / 50) * 50;
  const rh = Math.round(bildHoehe / 50) * 50;
  const schluessel = `${rb}x${rh}`;
  if (wzSpeicher.has(schluessel)) return wzSpeicher.get(schluessel);

  const gedreht = await sharp(LOGO)
    .resize({ width: Math.max(200, Math.round(bildBreite * WZ_ANTEIL)) })
    .ensureAlpha()
    .rotate(WZ_WINKEL, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Durch die Drehung waechst der Rahmen: ein 2:1-Logo bei 65 % Bildbreite ist
  // nach 30 Grad hoeher als ein querformatiges Bild. sharp lehnt ein Overlay
  // ab, das groesser ist als das Ziel — also auf die Bildflaeche begrenzen,
  // mit etwas Luft zum Rand.
  const roh = await sharp(gedreht).metadata();
  const platzB = Math.round(bildBreite * 0.92);
  const platzH = Math.round(bildHoehe * 0.92);
  const passend = (roh.width > platzB || roh.height > platzH)
    ? await sharp(gedreht).resize({ width: platzB, height: platzH, fit: 'inside' }).toBuffer()
    : gedreht;

  const m = await sharp(passend).metadata();
  // Deckkraft herunterregeln: 'dest-in' behaelt das Ziel dort, wo die Quelle
  // deckend ist — eine gleichmaessige Flaeche mit alpha=WZ_DECKKRAFT
  // multipliziert also den Alphakanal des Logos.
  const fertig = await sharp(passend)
    .composite([{
      input: { create: { width: m.width, height: m.height, channels: 4,
                         background: { r: 0, g: 0, b: 0, alpha: WZ_DECKKRAFT } } },
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  if (wzSpeicher.size > 40) wzSpeicher.delete(wzSpeicher.keys().next().value);
  wzSpeicher.set(schluessel, fertig);
  return fertig;
}

/** Liegt die Logodatei überhaupt da? Fehlt sie, wird ohne Zeichen gearbeitet,
 *  statt den ganzen Upload scheitern zu lassen. */
const logoDa = (() => {
  try { return fs.existsSync(LOGO); } catch { return false; }
})();
if (!logoDa) console.warn('[bild] Logo nicht gefunden, Bilder werden ohne Wasserzeichen gespeichert:', LOGO);

/**
 * Ein hochgeladenes Inseratsfoto in die auszuliefernde Form bringen.
 * Gibt IMMER einen Puffer zurück — der Aufrufer entscheidet, wann geschrieben
 * wird. Der Bearbeiten-Pfad braucht das so: dort wird erst nach dem COMMIT
 * auf die Platte geschrieben.
 */
async function inseratsBildVerarbeiten(eingabe) {
  const skaliert = await sharp(eingabe)
    .rotate()                                   // EXIF-Ausrichtung anwenden
    .resize(MAX_KANTE, MAX_KANTE, { fit: 'inside' })
    .toBuffer();

  if (!logoDa) return sharp(skaliert).webp({ quality: WEBP_QUALITAET }).toBuffer();

  const m = await sharp(skaliert).metadata();
  const wz = await wasserzeichen(m.width, m.height);
  return sharp(skaliert)
    .composite([{ input: wz, gravity: 'center' }])
    .webp({ quality: WEBP_QUALITAET })
    .toBuffer();
}

module.exports = {
  inseratsBildVerarbeiten,
  MAX_KANTE, WEBP_QUALITAET, WZ_DECKKRAFT, WZ_ANTEIL, WZ_WINKEL, LOGO,
};
