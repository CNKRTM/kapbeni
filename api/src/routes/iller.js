const router = require('express').Router();
const { query } = require('../db/pool');

router.get('/', async (req,res)=>{ const {rows}=await query('SELECT kod,ad FROM iller ORDER BY ad'); res.json(rows); });
router.get('/:kod/ilceler', async (req,res)=>{ const {rows}=await query('SELECT i.ad FROM ilceler i JOIN iller l ON l.id=i.il_id WHERE l.kod=$1 ORDER BY i.ad',[req.params.kod]); res.json(rows); });

// ════════════════════════════════════════════════════════════════════════════
//  Koordinaten -> İl / İlçe
//
//  Der Aufruf laeuft ueber DIESEN Server, nicht aus dem Browser. Drei Gruende:
//   - Die Position des Nutzers geht damit nicht direkt an einen Dritten;
//     OpenStreetMap sieht nur unsere Server-IP.
//   - Nominatim verlangt einen aussagekraeftigen User-Agent. Im Browser laesst
//     sich der Header nicht setzen, er wird verworfen — pages/Discover.tsx
//     versucht es trotzdem.
//   - Wir koennen zwischenspeichern und die Nutzungsregel von hoechstens einer
//     Anfrage je Sekunde einhalten.
//
//  Zurueck kommen nur Namen, die wirklich in iller/ilceler stehen. Discover.tsx
//  uebernimmt den Bezirk bisher ungeprueft; hier wird abgeglichen.
// ════════════════════════════════════════════════════════════════════════════

/** Tuerkisch-bewusst normalisieren: İ/I und die Zeichen mit Haekchen
 *  vereinheitlichen, damit 'Hakkâri' und 'Hakkari' dasselbe ergeben. */
function norm(v) {
  const karte = { 'İ':'i','I':'i','ı':'i','Ş':'s','ş':'s','Ğ':'g','ğ':'g',
                  'Ü':'u','ü':'u','Ö':'o','ö':'o','Ç':'c','ç':'c',
                  'Â':'a','â':'a','Î':'i','î':'i','Û':'u','û':'u' };
  return String(v || '')
    .replace(/[İIıŞşĞğÜüÖöÇçÂâÎîÛû]/g, (c) => karte[c])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Kleiner Zwischenspeicher: gleiche Gegend -> gleiche Antwort. Der Schluessel
// ist auf drei Nachkommastellen gerundet (~100 m), das reicht fuer einen Bezirk.
const speicher = new Map();
const SPEICHER_MAX = 500;
const SPEICHER_MS = 24 * 60 * 60 * 1000;

// Nominatim erlaubt hoechstens eine Anfrage je Sekunde.
let letzteAnfrage = 0;
async function nominatim(lat, lon) {
  const wartenMs = Math.max(0, 1100 - (Date.now() - letzteAnfrage));
  if (wartenMs) await new Promise(r => setTimeout(r, wartenMs));
  letzteAnfrage = Date.now();
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=tr`;
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: abbruch.signal,
      headers: { 'User-Agent': 'KapBeni/1.0 (+https://kapbeni.com; destek@kapbeni.com)' },
    });
    if (!r.ok) throw new Error(`Nominatim ${r.status}`);
    return await r.json();
  } finally { clearTimeout(uhr); }
}

router.get('/konum', async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return res.status(400).json({ hata: 'Geçersiz konum.' });

  const schluessel = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const treffer = speicher.get(schluessel);
  if (treffer && Date.now() - treffer.zeit < SPEICHER_MS) return res.json(treffer.wert);

  try {
    const d = await nominatim(lat, lon);
    const a = (d && d.address) || {};
    if (a.country_code && a.country_code !== 'tr')
      return res.status(404).json({ hata: 'Konumunuz Türkiye sınırları dışında görünüyor.' });

    const ilRoh = a.province || a.state || a.region || '';
    // Der Bezirk steckt je nach Ort in einem anderen Feld.
    const ilceKandidaten = [a.town, a.county, a.district, a.city_district, a.municipality, a.city]
      .filter(Boolean);

    const { rows: iller } = await query('SELECT id, kod, ad FROM iller');
    const il = iller.find(x => norm(x.ad) === norm(ilRoh))
            || iller.find(x => norm(ilRoh).startsWith(norm(x.ad)) && norm(x.ad).length > 3);
    if (!il) return res.status(404).json({ hata: 'Konumunuz için il bulunamadı.' });

    const { rows: ilceler } = await query('SELECT ad FROM ilceler WHERE il_id=$1', [il.id]);
    let ilce = null;
    for (const k of ilceKandidaten) {
      // "Nevşehir Merkez" -> "Merkez": Nominatim stellt dem Bezirk oft den
      // Provinznamen voran, unsere Liste fuehrt ihn ohne.
      const ohneIl = String(k).replace(new RegExp(`^${il.ad}\\s+`, 'i'), '').trim();
      ilce = ilceler.find(x => norm(x.ad) === norm(k))
          || ilceler.find(x => norm(x.ad) === norm(ohneIl));
      if (ilce) break;
    }

    const wert = { il: il.ad, il_kod: il.kod, ilce: ilce ? ilce.ad : null };
    if (speicher.size >= SPEICHER_MAX) speicher.delete(speicher.keys().next().value);
    speicher.set(schluessel, { zeit: Date.now(), wert });
    res.json(wert);
  } catch (e) {
    console.error('[iller/konum]', e.message);
    res.status(502).json({ hata: 'Konum servisi şu anda yanıt vermiyor. Lütfen elle seçin.' });
  }
});

module.exports=router;
