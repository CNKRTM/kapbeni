const https = require('https');
const { query } = require('../db/pool');

async function sendWhatsApp(message) {
  try {
    const r = await query('SELECT * FROM whatsapp_ayar LIMIT 1');
    const ayar = r.rows[0];
    if (!ayar || !ayar.aktif || !ayar.telefon || !ayar.api_key) {
      console.log('[WA] deactivated or not configured'); return;
    }
    const phone = String(ayar.telefon).replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`[KapBeni] ${message}`);
    const apiKey = encodeURIComponent(ayar.api_key);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apiKey}`;
    https.get(url, (res) => console.log('[WA] Status:', res.statusCode)).on('error', (e) => console.error('[WA]', e.message));
  } catch (err) { console.error('[WA] DB Error:', err.message); }
}
module.exports = { sendWhatsApp };
