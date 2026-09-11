const axios = require('axios');
require('dotenv').config({ path: '/etc/kapbeni.env' });
const PARAM_BASE = process.env.PARAM_API_BASE;
const TEST = process.env.PARAM_TEST_MODE === 'true';
const HAS_CREDS = process.env.PARAM_CLIENT_CODE && !/TEST_CLIENT_CODE/.test(process.env.PARAM_CLIENT_CODE);

// Zahlungs-Session erstellen. Ohne echte Credentials + TEST_MODE → simulierte Session.
async function odemeBaslat({ tutar, siparis_id, basarili_url, basarisiz_url, taksit_sayisi = 1 }) {
  if (TEST && !HAS_CREDS) {
    // Test-Simulation: kein echter Param-Call
    return { test_mode: true, redirect_url: `${basarili_url}?siparis=${siparis_id}&test=1`, UCD_URL: null, Sonuc: '1' };
  }
  const response = await axios.post(`${PARAM_BASE}/api/odeme/pos`, {
    CLIENT_CODE: process.env.PARAM_CLIENT_CODE, CLIENT_USERNAME: process.env.PARAM_CLIENT_USERNAME,
    CLIENT_PASSWORD: process.env.PARAM_CLIENT_PASSWORD, GUID: process.env.PARAM_GUID,
    Tutar: tutar, Siparis_ID: siparis_id, Basarili_URL: basarili_url, Basarisiz_URL: basarisiz_url,
    Taksit: taksit_sayisi, Islem_Guvenlik_Tip: '3D_PAY', Hata_URL: basarisiz_url,
  }, { timeout: 20000 });
  return response.data;
}

// Webhook-Auswertung
function webhookDogrula(req) {
  const { Sonuc, Siparis_ID, Dekont_ID, Tahsilat_Tutari } = req.body || {};
  return { basarili: Sonuc === '1' || req.body.test === '1', siparis_id: Siparis_ID, dekont_id: Dekont_ID, tutar: Tahsilat_Tutari };
}
module.exports = { odemeBaslat, webhookDogrula, TEST, HAS_CREDS };
