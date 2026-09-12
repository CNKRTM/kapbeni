// ════════════════════════════════════════════════════════════════════════════
//  Video-Umrechnung.
//
//  Vorher wurde ein Video über 20 MB abgewiesen. Jetzt wird es heruntergerechnet,
//  statt den Verkäufer wegzuschicken.
//
//  Gemessen auf dieser Maschine (6 Kerne, ffmpeg 6.1.1, kein nutzbarer
//  GPU-Encoder), Quelle 65 MB / 1080p / 30 fps / 40 s:
//
//    720p  CRF 28   17,7 s Wanduhr   80,6 s CPU (~4,6 Kerne)   268 MB RAM   → 10,8 MB
//    720p  CRF 26   18,0 s                                                  → 16,5 MB
//    1080p CRF 30   28,3 s          129,4 s CPU               452 MB RAM   → 36,7 MB
//
//  Deshalb 720p bei CRF 28: gut ansehbar und mit deutlichem Abstand unter der
//  Zielgröße. Die Rechenzeit skaliert praktisch linear mit der Videolänge —
//  eine Minute Material kostet rund 27 Sekunden.
//
//  Zwei Schranken sind nötig, weil die Maschine klein ist:
//    - höchstens GLEICHZEITIG Läufe parallel (CPU: einer belegt ~4,6 von 6 Kernen)
//    - harte Zeitgrenze je Lauf, damit ein kaputtes Video nichts blockiert
// ════════════════════════════════════════════════════════════════════════════
const { spawn } = require('child_process');
const fs = require('fs');

const ZIEL_BYTE = 20 * 1024 * 1024;   // ab dieser Größe wird umgerechnet
const HOEHE = 720;
const CRF = 28;
const GLEICHZEITIG = 2;
const ZEITGRENZE_MS = 5 * 60 * 1000;

// ── Schlange ───────────────────────────────────────────────────────────────
// Kein fremdes Paket: es geht nur darum, nicht mehr als GLEICHZEITIG ffmpeg-
// Prozesse nebeneinander laufen zu lassen. Wartende reihen sich ein.
let laufend = 0;
const warteschlange = [];

function platzNehmen() {
  if (laufend < GLEICHZEITIG) { laufend++; return Promise.resolve(); }
  return new Promise((frei) => warteschlange.push(frei));
}
function platzFreigeben() {
  const naechster = warteschlange.shift();
  if (naechster) naechster();
  else laufend--;
}

/** Wie viele Läufe gerade aktiv sind bzw. warten — für Log und Diagnose. */
function auslastung() {
  return { laufend, wartend: warteschlange.length };
}

/**
 * Prüfen, ob die Datei überhaupt ein abspielbares Video ist.
 *
 * Ohne diese Prüfung ging eine beliebige Datei mit dem MIME-Typ video/mp4
 * durch, solange sie klein genug war: sie wurde ungeprüft abgelegt, das
 * Inserat mit „İlanınız yayında!" bestätigt und die Galerie zeigte ein
 * kaputtes Element. Der MIME-Typ kommt aus dem Multipart-Header des Clients
 * und sagt nichts über den Inhalt.
 *
 * ffprobe kostet nur Millisekunden und läuft deshalb VOR dem Anlegen.
 * Rückgabe: { dauer, breite, hoehe }. Wirft, wenn es kein Video ist.
 */
function pruefen(pfad) {
  return new Promise((fertig, fehler) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json', pfad,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let aus = '';
    p.stdout.on('data', (d) => { aus += d; });
    const uhr = setTimeout(() => { p.kill('SIGKILL'); fehler(new Error('ffprobe Zeitgrenze')); }, 15000);
    p.on('error', (e) => { clearTimeout(uhr); fehler(e); });
    p.on('close', (code) => {
      clearTimeout(uhr);
      if (code !== 0) return fehler(new Error('keine lesbare Videodatei'));
      try {
        const d = JSON.parse(aus);
        const v = (d.streams || [])[0];
        if (!v || !v.width || !v.height) return fehler(new Error('kein Videostrom enthalten'));
        fertig({ dauer: Number((d.format || {}).duration) || 0, breite: v.width, hoehe: v.height });
      } catch { fehler(new Error('ffprobe-Antwort unlesbar')); }
    });
  });
}

/**
 * Video mit ffmpeg auf Zielgröße herunterrechnen.
 * Wirft bei Fehler oder Zeitüberschreitung; die Zieldatei wird dann entfernt.
 */
async function umrechnen(quelle, ziel) {
  await platzNehmen();
  const start = Date.now();
  try {
    await new Promise((fertig, fehler) => {
      const p = spawn('ffmpeg', [
        '-i', quelle,
        // -2 statt -1: die Breite muss gerade sein, sonst lehnt libx264 ab.
        '-vf', `scale=-2:${HOEHE}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(CRF),
        '-c:a', 'aac', '-b:a', '96k',
        // Der Index wandert an den Dateianfang, damit das Video sofort startet
        // und nicht erst vollständig geladen sein muss.
        '-movflags', '+faststart',
        '-y', ziel,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });

      let fehlertext = '';
      p.stderr.on('data', (d) => { fehlertext = (fehlertext + d).slice(-2000); });

      const uhr = setTimeout(() => {
        p.kill('SIGKILL');
        fehler(new Error('Zeitgrenze überschritten'));
      }, ZEITGRENZE_MS);

      p.on('error', (e) => { clearTimeout(uhr); fehler(e); });
      p.on('close', (code) => {
        clearTimeout(uhr);
        if (code === 0) return fertig();
        fehler(new Error(`ffmpeg beendet mit ${code}: ${fehlertext.split('\n').slice(-3).join(' ').slice(0, 300)}`));
      });
    });

    const groesse = fs.statSync(ziel).size;
    console.log(`[video] umgerechnet in ${((Date.now() - start) / 1000).toFixed(1)}s → ${(groesse / 1048576).toFixed(1)}MB`);
    return groesse;
  } catch (e) {
    try { if (fs.existsSync(ziel)) fs.unlinkSync(ziel); } catch { /* schon weg */ }
    throw e;
  } finally {
    platzFreigeben();
  }
}

module.exports = { pruefen, umrechnen, auslastung, ZIEL_BYTE, HOEHE, CRF, GLEICHZEITIG, ZEITGRENZE_MS };
