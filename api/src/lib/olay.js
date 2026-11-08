// ════════════════════════════════════════════════════════════════════════════
//  IP- und Ereignisprotokoll je Kunde (Auftragssammlung A, Tabelle musteri_olaylari).
//
//  - istemciIp(req): echte Client-IP. X-Real-IP wird NUR akzeptiert, wenn die
//    Anfrage tatsaechlich vom lokalen nginx kommt (127.0.0.1/::1) — sonst liesse
//    sich der Header bei Direktzugriff auf :3001 faelschen.
//  - geoBul(ip): offline mit geoip-lite (GeoLite-Daten im Paket, kein externer
//    Dienst, keine Daten verlassen den Server). Il-Name ueber den Regionscode
//    (= Plaka) aus der Tabelle iller. Nicht ermittelbar -> '—'.
//    Anbieter (ISP) kennt geoip-lite nicht -> '—' (GeoLite2-ASN braeuchte einen
//    MaxMind-Lizenzschluessel, offen fuer Burak).
//  - uaCoz(ua): ua-parser-js 1.x (MIT) -> cihaz, tarayici, os.
//  - yaz(): schreibt nie blockierend und wirft nie — ein Protokollfehler darf
//    keinen Login und kein Inserat kosten.
//  Aufbewahrung 2 Jahre (5651), Loeschlauf in lib/cron.js -> eskileriSil().
// ════════════════════════════════════════════════════════════════════════════
const { query } = require('../db/pool');

let geoip = null, UAParser = null;
try { geoip = require('geoip-lite'); } catch (e) { console.warn('[olay] geoip-lite fehlt:', e.message); }
try { UAParser = require('ua-parser-js'); } catch (e) { console.warn('[olay] ua-parser-js fehlt:', e.message); }

const YOK = '—';
const SAKLAMA_GUN = 730;   // 2 Jahre

function istemciIp(req) {
  if (!req) return null;
  const direkt = String(req.socket?.remoteAddress || req.ip || '');
  const lokal = direkt === '::1' || direkt.includes('127.0.0.1');
  const kopf = req.headers && req.headers['x-real-ip'];
  const ip = (lokal && kopf) ? String(kopf) : direkt;
  return ip.replace(/^::ffff:/, '').slice(0, 45) || null;
}

const ozelIp = (ip) => !ip || /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);

let _iller = null;
async function illerHaritasi() {
  if (_iller) return _iller;
  try {
    const { rows } = await query('SELECT kod, ad FROM iller');
    _iller = new Map(rows.map((r) => [String(r.kod).padStart(2, '0'), r.ad]));
  } catch { _iller = new Map(); }
  return _iller;
}
const ULKE = { TR: 'Türkiye', DE: 'Almanya', NL: 'Hollanda', US: 'ABD', GB: 'Birleşik Krallık', FR: 'Fransa', AZ: 'Azerbaycan', CY: 'Kıbrıs' };

async function geoBul(ip) {
  if (ozelIp(ip)) return { sehir: YOK, ulke: YOK, isp: ip ? 'Yerel ağ' : YOK };
  const g = geoip ? geoip.lookup(ip) : null;
  if (!g) return { sehir: YOK, ulke: YOK, isp: YOK };
  let sehir = g.city || '';
  if (g.country === 'TR' && g.region) {
    const il = (await illerHaritasi()).get(String(g.region).padStart(2, '0'));
    if (il) sehir = il;
  }
  return { sehir: sehir || YOK, ulke: ULKE[g.country] || g.country || YOK, isp: YOK };
}

function uaCoz(ua) {
  const s = String(ua || '');
  if (!s || !UAParser) return { cihaz: YOK, tarayici: YOK, os: YOK };
  const r = new UAParser(s).getResult();
  const tip = r.device.type === 'mobile' ? 'Telefon' : r.device.type === 'tablet' ? 'Tablet' : 'Masaüstü';
  const model = [r.device.vendor, r.device.model].filter(Boolean).join(' ');
  return {
    cihaz: (model ? `${model} (${tip})` : tip).slice(0, 120),
    tarayici: ([r.browser.name, r.browser.major].filter(Boolean).join(' ') || YOK).slice(0, 120),
    os: ([r.os.name, r.os.version].filter(Boolean).join(' ') || YOK).slice(0, 120),
  };
}

/**
 * Ein Ereignis schreiben. Felder: userId, olay, hedefTip, hedefId, detay, req
 * oder (ip, userAgent) direkt, zaman (nur Seed/Tests). Liefert die id oder null.
 */
async function yaz({ userId = null, olay, hedefTip = null, hedefId = null, detay = null, req = null, ip, userAgent, zaman = null, geo = null } = {}) {
  try {
    if (!olay) return null;
    const adres = ip !== undefined ? ip : istemciIp(req);
    const ua = userAgent !== undefined ? userAgent : String(req?.headers?.['user-agent'] || '');
    const g = geo || await geoBul(adres);
    const u = uaCoz(ua);
    const { rows } = await query(
      `INSERT INTO musteri_olaylari(user_id,olay,hedef_tip,hedef_id,ip,sehir,ulke,isp,cihaz,tarayici,os,user_agent,detay,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,NOW())) RETURNING id`,
      [userId, String(olay).slice(0, 40), hedefTip, hedefId != null ? String(hedefId).slice(0, 64) : null,
       adres, g.sehir, g.ulke, g.isp, u.cihaz, u.tarayici, u.os, String(ua).slice(0, 500),
       detay ? JSON.stringify(detay) : null, zaman]);
    return rows[0].id;
  } catch (e) { console.error('[olay] yazilamadi:', e.message); return null; }
}

/** Fire-and-forget fuer Routen: blockiert die Antwort nicht. */
function kaydet(req, opts) { yaz({ req, ...opts }).catch(() => {}); }

/** 5651: Eintraege aelter als 2 Jahre loeschen (Cron). */
async function eskileriSil() {
  const r = await query(`DELETE FROM musteri_olaylari WHERE created_at < NOW() - ($1 || ' days')::interval`, [String(SAKLAMA_GUN)]);
  return r.rowCount;
}

module.exports = { istemciIp, geoBul, uaCoz, yaz, kaydet, eskileriSil, SAKLAMA_GUN, YOK };
