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
const WEBP_QUALITAET = 80;   // nur noch fuer inseratsBildVerarbeiten() (Altaufrufer)

// ── Zwei Groessen (Auftragssammlung I, v1.27) ───────────────────────────────
// _lg fuer Detail und Lightbox, _sm fuer Karten, Listen, Benzer İlanlar und die
// Kundenakte. Qualitaet an vier Testbildern gemessen (Tabelle in CLAUDE.md,
// Chronik 2026-11-08 v1.27): q75 statt q80 spart beim _lg 10-20 %, die SSIM
// sinkt dabei um hoechstens 0,006 — mit blossem Auge nicht zu sehen. Beim _sm
// liegt q70 nur 0,001-0,005 unter q75. Die Werte sind Voreinstellungen; der
// Admin kann sie unter SİSTEM → Medya Motoru aendern (medya_ayarlari).
const VARIANTEN_STANDARD = { lg_px: 1200, lg_q: 75, sm_px: 480, sm_q: 70 };

/** Dateiname der kleinen Variante zu einer _lg-URL bzw. einer Alt-URL.
 *  Namensregel statt eigener Spalte: …_lg.webp → …_sm.webp, Altbestand
 *  …_N.webp → …_N_sm.webp. Nur fuer eigene Dateien unter /uploads/ilanlar/;
 *  fremde Adressen (Unsplash u. a.) haben keine kleine Variante → null. */
function kleinUrl(url) {
  if (!url || typeof url !== 'string' || !/^\/uploads\/ilanlar\/[^/]+\.webp$/.test(url)) return null;
  if (/_sm\.webp$/.test(url)) return url;
  if (/_lg\.webp$/.test(url)) return url.replace(/_lg\.webp$/, '_sm.webp');
  return url.replace(/\.webp$/, '_sm.webp');
}

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

async function wasserzeichen(bildBreite, bildHoehe, { deckkraft = WZ_DECKKRAFT, anteil = WZ_ANTEIL } = {}) {
  // Auf 50er-Schritte runden: sonst entstuende fuer jede Pixelgroesse ein
  // eigener Eintrag und der Zwischenspeicher liefe voll.
  const rb = Math.round(bildBreite / 50) * 50;
  const rh = Math.round(bildHoehe / 50) * 50;
  const schluessel = `${rb}x${rh}_${deckkraft}_${anteil}`;
  if (wzSpeicher.has(schluessel)) return wzSpeicher.get(schluessel);

  const gedreht = await sharp(LOGO)
    // Untergrenze 200 px nur, wenn das Bild selbst breit genug ist (_sm hat 480 px)
    .resize({ width: Math.max(Math.min(200, bildBreite), Math.round(bildBreite * anteil)) })
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
                         background: { r: 0, g: 0, b: 0, alpha: deckkraft } } },
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

// Auf der kleinen Variante waere das Zeichen mit 22 % und 65 % Breite kaum zu
// erkennen (bei 480 px nur noch ~310 px breit und blass). Deshalb dort kraeftiger
// und breiter — an den Testbildern verglichen, Produkt bleibt erkennbar.
const WZ_SM = { deckkraft: 0.32, anteil: 0.8 };

/** Eine Groesse erzeugen: drehen (EXIF), skalieren, Zeichen, WebP.
 *  EXIF/GPS: sharp uebernimmt Metadaten NUR mit withMetadata()/keepMetadata().
 *  Beides wird hier bewusst nicht aufgerufen — die Ausgabe traegt kein EXIF,
 *  kein GPS, kein ICC-Profil ausser sRGB (Test u_medya prueft das). */
async function eineGroesse(eingabe, kante, qualitaet, wzOpt) {
  const skaliert = await sharp(eingabe)
    .rotate()
    .resize(kante, kante, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  if (!logoDa) return sharp(skaliert).webp({ quality: qualitaet }).toBuffer();
  const m = await sharp(skaliert).metadata();
  const wz = await wasserzeichen(m.width, m.height, wzOpt);
  return sharp(skaliert).composite([{ input: wz, gravity: 'center' }]).webp({ quality: qualitaet }).toBuffer();
}

/**
 * Beide Groessen eines Inseratsfotos (v1.27). Beide werden aus dem ORIGINAL
 * gerechnet, nicht _sm aus _lg — sonst wuerde das Zeichen zweimal aufgelegt.
 * Wirft, wenn sharp die Datei nicht lesen kann (= Inhaltspruefung).
 * Rueckgabe: { lg, sm, breite, hoehe, vorher, nachher }.
 */
async function bildVarianten(eingabe, ayar = {}) {
  const a = { ...VARIANTEN_STANDARD, ...ayar };
  const t0 = Date.now();
  const meta = await sharp(eingabe).metadata();   // wirft bei Nicht-Bildern
  if (!meta.width || !meta.height) throw new Error('kein lesbares Bild');
  const lg = await eineGroesse(eingabe, a.lg_px, a.lg_q, {});
  const sm = await eineGroesse(eingabe, a.sm_px, a.sm_q, WZ_SM);
  return { lg, sm, breite: meta.width, hoehe: meta.height, vorher: eingabe.length, nachher: lg.length + sm.length, ms: Date.now() - t0 };
}

/** _sm aus einer vorhandenen _lg-Datei (nur fuer den Bestand, dessen Original
 *  nicht aufbewahrt wurde). Das Zeichen steckt dort schon im Bild und wird
 *  mitverkleinert — kein zweites Zeichen. */
async function kleinAusGross(eingabe, ayar = {}) {
  const a = { ...VARIANTEN_STANDARD, ...ayar };
  return sharp(eingabe).resize(a.sm_px, a.sm_px, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: a.sm_q }).toBuffer();
}

module.exports = {
  inseratsBildVerarbeiten, bildVarianten, kleinAusGross, kleinUrl, VARIANTEN_STANDARD, WZ_SM,
  MAX_KANTE, WEBP_QUALITAET, WZ_DECKKRAFT, WZ_ANTEIL, WZ_WINKEL, LOGO,
};
