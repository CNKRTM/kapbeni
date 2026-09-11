const cron = require('node-cron');
const { query } = require('../db/pool');
const { sendMail } = require('../utils/mailer');

// Täglich 08:00 Istanbul
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] İlan expiry check...');
  try {
    const expired = await query(`UPDATE ilanlar SET yayin_durum='sona_erdi'
       WHERE yayin_durum='canli' AND son_gecerlilik < NOW() RETURNING id, baslik, user_id`);
    console.log(`[CRON] ${expired.rows.length} ilan sona erdi`);
    const threeDays = new Date(); threeDays.setDate(threeDays.getDate() + 3);
    const soon = await query(`SELECT i.*, k.email, k.ad FROM ilanlar i JOIN users k ON k.id=i.user_id
       WHERE i.yayin_durum='canli' AND i.son_gecerlilik < $1 AND i.hatirlama_gonderildi=false`, [threeDays]);
    for (const ilan of soon.rows) {
      const kalanGun = Math.ceil((new Date(ilan.son_gecerlilik) - new Date()) / 86400000);
      await sendMail({ to: ilan.email, subject: `İlanınız ${kalanGun} gün içinde bitiyor – Kap Beni`,
        html: `<p>Merhaba ${ilan.ad},</p><p>"${ilan.baslik}" başlıklı ilanınız ${kalanGun} gün içinde sona erecek.</p><p>İlanlarım sayfasından "Süreyi Uzat" butonuyla kolayca uzatabilirsiniz.</p><p>Kap Beni</p>` });
      await query('UPDATE ilanlar SET hatirlama_gonderildi=true WHERE id=$1', [ilan.id]);
    }
    console.log(`[CRON] ${soon.rows.length} hatırlatma gönderildi`);
  } catch (err) { console.error('[CRON] Hata:', err.message); }
}, { timezone: 'Europe/Istanbul' });
console.log('[CRON] İlan expiry cron registered');
