// Login-Protokoll. Seit v1.22 offline (lib/olay.js, geoip-lite) statt ip-api.com —
// die IP der Kunden geht nicht mehr an einen Drittdienst. Schreibt weiterhin die
// alte Tabelle kullanici_girisler (Kundendetail alt) UND musteri_olaylari.
const olay = require('../lib/olay');

async function getIpBilgi(ip) {
  const g = await olay.geoBul(String(ip || '').replace('::ffff:', ''));
  return { sehir: g.sehir, bolge: '', ulke: g.ulke, isp: g.isp };
}

// Login protokollieren (nicht blockierend). `art` = Ereignisname in musteri_olaylari.
async function girisKaydet(query, userId, req, basarili = true, art = null) {
  try {
    const ip = olay.istemciIp(req);
    const ua = req.headers['user-agent'] || '';
    const geo = await olay.geoBul(ip);
    await query(`INSERT INTO kullanici_girisler(user_id,ip_adresi,sehir,ulke,tarayici,basarili) VALUES($1,$2,$3,$4,$5,$6)`,
      [userId, ip, geo.sehir, geo.ulke, ua, basarili]);
    await olay.yaz({ userId, olay: art || (basarili ? 'giris' : 'giris_basarisiz'), req, geo });
  } catch (e) { /* Protokoll darf den Login nie verhindern */ }
}
module.exports = { getIpBilgi, girisKaydet };
