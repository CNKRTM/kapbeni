const cron = require('node-cron');
const pool = require('../db/pool'); // exportiert { query, pool, auditLog } → pool.query() ok

// Hilfsfunktion: E-Mail senden (Stub — echte SMTP-Implementierung separat)
function sendEmail(to, subject, text) {
  console.log(`[MAIL] To: ${to} | Subject: ${subject}`);
  // TODO: echtes Nodemailer/SMTP hier einfügen
}

// Täglich 09:00: Ablauf-Checks
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Täglicher İlan-Check startet...');
  try {
    // ── Tag 13: Warnmail ──────────────────────────────────────────────────
    // (users hat ad/soyad getrennt, kein ad_soyad → hier zusammensetzen)
    const { rows: warn13 } = await pool.query(`
      SELECT i.id, i.baslik, u.email, (u.ad || ' ' || COALESCE(u.soyad,'')) AS ad_soyad
      FROM ilanlar i
      JOIN users u ON u.id = i.user_id
      WHERE i.parked = FALSE
        AND i.ilan_bitis_tarihi BETWEEN NOW() + INTERVAL '23 hours'
                                     AND NOW() + INTERVAL '25 hours'
    `);
    for (const r of warn13) {
      sendEmail(r.email, 'İlanınız yarın parklanacak — Kapbeni',
        `Merhaba ${r.ad_soyad},\n\n"${r.baslik}" başlıklı ilanınız yarın sona erecek ve otomatik olarak parklanacaktır.\n\nhttps://kapbeni.com/ilanim\n\nKapbeni Ekibi`);
      console.log(`[CRON] Uyarı maili gönderildi: ${r.email} (${r.baslik})`);
    }

    // ── İlan Parklama (bitis_tarihi geçmiş, henüz aktif) ─────────────────
    const { rows: topark } = await pool.query(`
      SELECT i.id, i.uuid, i.baslik, u.email, (u.ad || ' ' || COALESCE(u.soyad,'')) AS ad_soyad
      FROM ilanlar i
      JOIN users u ON u.id = i.user_id
      WHERE i.parked = FALSE
        AND i.ilan_bitis_tarihi IS NOT NULL
        AND i.ilan_bitis_tarihi < NOW()
    `);
    for (const r of topark) {
      await pool.query(`UPDATE ilanlar SET parked = TRUE, parked_at = NOW() WHERE id = $1`, [r.id]);
      sendEmail(r.email, 'İlanınız parklandı — Kapbeni',
        `Merhaba ${r.ad_soyad},\n\n"${r.baslik}" başlıklı ilanınızın yayın süresi doldu ve parklandı.\n\nhttps://kapbeni.com/ilanim\n\nKapbeni Ekibi`);
      console.log(`[CRON] İlan parked: #${r.id} (${r.baslik}) -> ${r.email}`);
      // Parked → aus dem Meili-Suchindex entfernen (echtes Interface: meiliSync.deleteListing(uuid))
      try {
        const { deleteListing } = require('./meiliSync');
        await deleteListing(r.uuid);
      } catch (e) {
        console.warn('[CRON] Meili update failed (non-fatal):', e.message);
      }
    }

    // ── Boost-Tage dekrementieren (nur aktive ilanlar) ───────────────────
    await pool.query(`
      UPDATE ilanlar
      SET boost_kalan_gun = GREATEST(0, boost_kalan_gun - 1),
          boost_type = CASE WHEN boost_kalan_gun <= 1 THEN NULL ELSE boost_type END
      WHERE boost_type IS NOT NULL AND parked = FALSE AND boost_kalan_gun > 0
    `);

    console.log(`[CRON] Check abgeschlossen. Parked: ${topark.length}, Warned: ${warn13.length}`);
  } catch (err) {
    console.error('[CRON] Fehler:', err.message);
  }
}, { timezone: 'Europe/Istanbul' });

// Täglich 10:00: Süresi dolmuş Teklifler schließen
cron.schedule('0 10 * * *', async () => {
  try {
    const { rowCount } = await pool.query(`
      UPDATE teklifler SET status = 'suresi_doldu'
      WHERE status = 'bekliyor' AND created_at < NOW() - INTERVAL '7 days'
    `);
    console.log(`[CRON] ${rowCount} teklif süresi dolmuş olarak işaretlendi`);
  } catch (err) {
    console.error('[CRON] Teklif cron hatası:', err.message);
  }
}, { timezone: 'Europe/Istanbul' });

// Täglich 11:00: Kayıtlı Arama Benachrichtigungen (Stub)
cron.schedule('0 11 * * *', async () => {
  try {
    const { rows: searches } = await pool.query(`
      SELECT ks.id, ks.user_id, ks.arama_terimi, u.email
      FROM kayitli_aramalar ks JOIN users u ON u.id = ks.user_id
    `);
    for (const s of searches) {
      console.log(`[CRON] Kayıtlı arama kontrol: user#${s.user_id} - ${s.arama_terimi || ''}`);
    }
  } catch (err) {
    console.error('[CRON] Kayıtlı arama cron hatası:', err.message);
  }
}, { timezone: 'Europe/Istanbul' });

console.log('[CRON] Scheduler başlatıldı (timezone: Europe/Istanbul)');
module.exports = {};
