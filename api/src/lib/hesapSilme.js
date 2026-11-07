// ════════════════════════════════════════════════════════════════════════════
//  Kontoloeschung — EIN Weg fuer alle (Auftragssammlung H).
//
//    aktif ──(Antrag)──> silme_bekliyor ──(30 Tage, Cron)──> silindi
//                          │
//                          └─(Anmeldung)──> aktif   (Widerruf mit Hinweis)
//
//  - Antrag: users.durum='silme_bekliyor', silinme_istegi=NOW(). Laufende
//    Inserate gehen auf 'pasif', der vorherige Zustand wird in
//    ilanlar.silme_oncesi_durum gemerkt, damit ein Widerruf ihn zurueckholt.
//  - Bestehende Token werden sofort ungueltig (authMiddleware verlangt 'aktif').
//  - Nach 30 Tagen: Name, E-Mail, Telefon, TCKN (+ weitere Personendaten)
//    anonymisieren, Inserate beenden, Kundennummer BLEIBT. Zahlungs- und
//    Rechnungsbelege werden nicht angefasst (VUK/TTK-Aufbewahrung).
//  - Jeder Schritt steht in audit_log (hesap.silme_talebi / silme_iptal /
//    anonimlestirildi), damit der Admin die Zeitleiste zeigen kann.
// ════════════════════════════════════════════════════════════════════════════
const { pool, auditLog } = require('../db/pool');
const { sendMail } = require('../utils/mailer');

const FRIST_TAGE = 30;
const AKTIVE_ILAN_DURUM = ['aktif', 'moderasyonda'];

async function mitTransaktion(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

function mailVersenden(u, betreff, text) {
  // Nie an Testkonten (Testdomain) oder bereits anonymisierte Adressen.
  if (!u || u.test_verisi || !u.email || /@silindi\.kapbeni\.invalid$/.test(u.email)) return;
  sendMail({ to: u.email, subject: betreff, text }).catch(() => {});
}

/** Antrag stellen. Liefert { silinecek_tarih }. */
async function silmeTalebi(userId, { ip, kaynak = 'api' } = {}) {
  const sonuc = await mitTransaktion(async (c) => {
    const { rows } = await c.query('SELECT id, email, ad, durum, test_verisi FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const u = rows[0];
    if (!u) throw Object.assign(new Error('Kullanıcı bulunamadı'), { status: 404 });
    if (u.durum === 'silindi') throw Object.assign(new Error('Hesap zaten silinmiş.'), { status: 409 });
    const { rows: z } = await c.query(
      `UPDATE users SET durum='silme_bekliyor', silinme_istegi=COALESCE(CASE WHEN durum='silme_bekliyor' THEN silinme_istegi END, NOW())
        WHERE id=$1 RETURNING silinme_istegi`, [userId]);
    const { rows: ilan } = await c.query(
      `UPDATE ilanlar SET silme_oncesi_durum=ilan_durum, ilan_durum='pasif'
        WHERE user_id=$1 AND ilan_durum = ANY($2::text[]) RETURNING uuid`, [userId, AKTIVE_ILAN_DURUM]);
    return { u, istek: z[0].silinme_istegi, ilanlar: ilan.map(r => r.uuid) };
  });
  // Aus dem Suchindex nehmen — sonst bleiben die Inserate ueber /api/arama sichtbar.
  try { const { deleteListing } = require('./meiliSync'); for (const uuid of sonuc.ilanlar) await deleteListing(uuid); } catch {}
  const silinecek = new Date(new Date(sonuc.istek).getTime() + FRIST_TAGE * 864e5);
  await auditLog('hesap.silme_talebi', kaynak, { userId, ip, hedefTip: 'user', hedefId: userId,
    detay: { silinecek_tarih: silinecek.toISOString(), pasif_ilanlar: sonuc.ilanlar.length } });
  mailVersenden(sonuc.u, 'Hesap silme talebiniz alındı — KapBeni',
    `Merhaba ${sonuc.u.ad || ''},\n\nHesap silme talebiniz alındı. Hesabınız ${silinecek.toLocaleDateString('tr-TR')} tarihinde kalıcı olarak anonimleştirilecek.\n` +
    `Bu tarihe kadar giriş yaparsanız talebiniz otomatik olarak iptal edilir.\n\nKapBeni Ekibi`);
  return { silinecek_tarih: silinecek.toISOString() };
}

/** Widerruf (bei Anmeldung). Liefert true, wenn ein Antrag aufgehoben wurde. */
async function silmeIptal(userId, { ip, kaynak = 'api' } = {}) {
  const sonuc = await mitTransaktion(async (c) => {
    const { rows } = await c.query(
      `UPDATE users SET durum='aktif', silinme_istegi=NULL WHERE id=$1 AND durum='silme_bekliyor' RETURNING id, email, ad, test_verisi`, [userId]);
    if (!rows[0]) return null;
    const { rows: ilan } = await c.query(
      `UPDATE ilanlar SET ilan_durum=silme_oncesi_durum, silme_oncesi_durum=NULL
        WHERE user_id=$1 AND silme_oncesi_durum IS NOT NULL AND ilan_durum='pasif' RETURNING uuid, ilan_durum`, [userId]);
    return { u: rows[0], ilanlar: ilan };
  });
  if (!sonuc) return false;
  try { const { syncListing } = require('./meiliSync'); for (const i of sonuc.ilanlar) if (i.ilan_durum === 'aktif') await syncListing(i.uuid); } catch {}
  await auditLog('hesap.silme_iptal', kaynak, { userId, ip, hedefTip: 'user', hedefId: userId,
    detay: { geri_alinan_ilanlar: sonuc.ilanlar.length } });
  return true;
}

/** Ein Konto anonymisieren (vom Cron nach Fristablauf). */
async function anonimlestir(userId, { kaynak = 'cron' } = {}) {
  const sonuc = await mitTransaktion(async (c) => {
    const { rows } = await c.query("SELECT id, durum FROM users WHERE id=$1 FOR UPDATE", [userId]);
    if (!rows[0] || rows[0].durum !== 'silme_bekliyor') return null;
    await c.query(
      `UPDATE users SET
         ad='Silinmiş', soyad='Üye', email='silindi+' || id || '@silindi.kapbeni.invalid',
         phone='silindi-' || id, phone_verified=false, telefon_dogrulandi=false, email_dogrulandi=false,
         tc_no_hash=NULL, vkn=CASE WHEN length(coalesce(vkn,''))=11 OR hesap_tipi<>'kurumsal' THEN NULL ELSE vkn END,
         yetkili_kisi=NULL, ticari_adres=NULL, iban=NULL, avatar_url=NULL, hakkinda=NULL, hakkimda=NULL,
         takma_ad=NULL, takma_ad_aktif=false, ilce=NULL, google_id=NULL,
         password_hash='!', reset_token=NULL, reset_token_exp=NULL, email_dogrulama_token=NULL,
         telefon_otp=NULL, otp_expires_at=NULL, token_version=COALESCE(token_version,0)+1,
         durum='silindi', silindi_at=NOW()
       WHERE id=$1`, [userId]);
    // Inserate endgueltig beenden; die Zeilen bleiben fuer Belege/Beschwerden erhalten.
    const { rows: ilan } = await c.query(
      `UPDATE ilanlar SET ilan_durum='pasif', silme_oncesi_durum=NULL, yayin_durum='kaldirildi' WHERE user_id=$1 RETURNING uuid`, [userId]);
    await c.query('DELETE FROM adresler WHERE kullanici_id=$1', [userId]);
    return { ilanlar: ilan.map(r => r.uuid) };
  });
  if (!sonuc) return false;
  try { const { deleteListing } = require('./meiliSync'); for (const uuid of sonuc.ilanlar) await deleteListing(uuid); } catch {}
  await auditLog('hesap.anonimlestirildi', kaynak, { userId, hedefTip: 'user', hedefId: userId,
    detay: { beendete_ilanlar: sonuc.ilanlar.length } });
  return true;
}

/** Taeglicher Lauf: alle Antraege mit abgelaufener Frist anonymisieren. */
async function fristAbgelaufenLauf() {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE durum='silme_bekliyor' AND silinme_istegi < NOW() - ($1 || ' days')::interval ORDER BY silinme_istegi`,
    [String(FRIST_TAGE)]);
  let n = 0;
  for (const { id } of rows) {
    try { if (await anonimlestir(id)) n++; }
    catch (e) { console.error(`[CRON] Anonymisierung user#${id} fehlgeschlagen:`, e.message); }
  }
  return { gefunden: rows.length, anonimlestirildi: n };
}

module.exports = { FRIST_TAGE, silmeTalebi, silmeIptal, anonimlestir, fristAbgelaufenLauf };
