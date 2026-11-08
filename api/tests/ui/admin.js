// ════════════════════════════════════════════════════════════════════════════
//  Oberflaechen-Pruefung des Express-Admins (Playwright, headless Chromium).
//    node /opt/kapbeni/api/tests/ui/admin.js [szenario ...]
//  Angemeldet wird NUR das Test-Admin-Konto (admin_users.test_verisi=true,
//  E-Mail ui-test-admin@test.kapbeni.com). Das Passwort liegt in
//  /root/kp-admin-test.pw (0600) und wird nie ausgegeben.
//  Laeuft direkt gegen :3002 (gleiche Datei wie /kapbeniadmin/admin).
//  Bildschirmfotos: /tmp/kp-ui/admin-<szenario>-<breite>.png
//  Achtung: /admin/api/giris erlaubt 20 Versuche je 15 Minuten.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');

const BASIS = process.env.ADMIN_BASIS || 'http://127.0.0.1:3002/admin';
const AUS = '/tmp/kp-ui';
const TEST_EMAIL = 'ui-test-admin@test.kapbeni.com';
const PW_DATEI = '/root/kp-admin-test.pw';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));

const BREITEN = [{ name: 'mobil', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); };
const pw = () => fs.readFileSync(PW_DATEI, 'utf8').trim();
const kurz = (ms) => new Promise((r) => setTimeout(r, ms));

async function anmelden(page) {
  await page.goto(BASIS); await page.waitForTimeout(800);
  await page.fill('#login-email', TEST_EMAIL);
  await page.fill('#login-pw', pw());
  await page.click('#login-btn');
  await page.waitForSelector('#sidebar', { timeout: 8000 });
  await page.waitForTimeout(600);
}

const SZENARIEN = {
  // Şifremi unuttum: Link, Formular, Hinweis „nur protokolliert“, neutrale Antwort;
  // Yeni şifre: ungueltiger Link, Regeln live, Speichern (Test-Token, Passwort danach zurueck).
  async sifre(page, b) {
    const { q } = require('../_hilfe');
    const crypto = require('crypto');
    await page.goto(BASIS); await page.waitForSelector('#login-email');
    await page.click('#sifre-unuttum-link'); await page.waitForSelector('#unuttum-email');
    pruefe(page.url().endsWith('#/sifremi-unuttum'), `${b}: Adresse #/sifremi-unuttum`);
    pruefe(await page.locator('#mail-log-hinweis').count() === 1, `${b}: Hinweis „nur protokolliert“ (kein Mailkanal)`);
    await page.fill('#unuttum-email', 'niemand-' + Date.now() + '@test.kapbeni.com'); await page.click('#unuttum-btn');
    await page.waitForSelector('#unuttum-ok:not(.hidden)', { timeout: 5000 });
    pruefe(/Eğer bu e-posta kayıtlıysa/.test(await page.locator('#unuttum-ok').innerText()), `${b}: neutrale Antwort`);
    await page.screenshot({ path: `${AUS}/admin-sifre-unuttum-${page.viewportSize().width}.png` });
    await page.goBack(); await page.waitForTimeout(400);
    pruefe(await page.locator('#login-email').count() === 1, `${b}: Zurück → Login`);
    await page.goto(BASIS + '#/yeni-sifre?t=ungueltig-ungueltig-ungueltig'); await page.waitForTimeout(900);
    pruefe(await page.locator('#yeni-gecersiz').count() === 1, `${b}: ungültiger Link erkannt`);
    const admin = (await q("SELECT id, password_hash FROM admin_users WHERE email=$1 AND test_verisi=true", [TEST_EMAIL])).rows[0];
    const token = crypto.randomBytes(32).toString('base64url');
    await q("INSERT INTO admin_sifre_sifirlama(admin_id,token_hash,expires_at) VALUES($1,$2,NOW()+interval '30 minutes')", [admin.id, crypto.createHash('sha256').update(token).digest('hex')]);
    try {
      await page.goto(BASIS + '#/yeni-sifre?t=' + token); await page.reload(); await page.waitForSelector('#yeni-pw', { timeout: 5000 });
      await page.fill('#yeni-pw', 'abc');
      pruefe((await page.locator('#yeni-kurallar li').allInnerTexts()).filter((t) => t.startsWith('✓')).length === 1, `${b}: Regeln live (1/5 erfüllt)`);
      const neu = 'Yeni' + crypto.randomBytes(5).toString('hex') + '7Z';
      await page.fill('#yeni-pw', neu); await page.fill('#yeni-pw2', neu);
      await page.screenshot({ path: `${AUS}/admin-yeni-sifre-${page.viewportSize().width}.png` });
      await page.click('#yeni-btn'); await page.waitForSelector('#yeni-ok', { timeout: 5000 });
      pruefe(/güncellendi/.test(await page.locator('#yeni-ok').innerText()), `${b}: neues Passwort gespeichert`);
    } finally {
      await q('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [admin.password_hash, admin.id]);
      await q('DELETE FROM admin_sifre_sifirlama WHERE admin_id=$1', [admin.id]);
    }
  },
  // Bildschirmsperre: Kilitle, Overlay mit Uhr/Datum/KVKK/Admin-Karte, Reload bleibt gesperrt,
  // falsches Passwort, Entsperren, Sperre durch Inaktivitaet (Server).
  async kilit(page, b) {
    const { q } = require('../_hilfe');
    await anmelden(page);
    await page.goto(BASIS + '#/ilanonay'); await page.waitForTimeout(800);
    await page.click('#kilitle-btn'); await page.waitForSelector('#kilit', { timeout: 5000 });
    pruefe(await page.locator('#view').innerHTML() === '', `${b}: Inhalt geleert`);
    pruefe(/^\d{2}:\d{2}$/.test(await page.locator('#kilit-saat').innerText()), `${b}: Uhrzeit`);
    pruefe(/202\d/.test(await page.locator('#kilit-tarih').innerText()), `${b}: Datum tr (${await page.locator('#kilit-tarih').innerText()})`);
    pruefe(await page.getByText('Müşteri verileri kilitli ekranda gizlidir (KVKK)', { exact: false }).count() === 1, `${b}: KVKK-Hinweis`);
    pruefe(/UI Test Admin/.test(await page.locator('#kilit-ad').innerText()), `${b}: Admin-Karte`);
    pruefe(await page.getByText('Başka kullanıcıyla giriş / Çıkış').count() === 1, `${b}: Başka kullanıcıyla giriş / Çıkış`);
    const blur = await page.locator('#kilit').evaluate((e) => getComputedStyle(e).backdropFilter || getComputedStyle(e).webkitBackdropFilter);
    pruefe(/blur/.test(blur), `${b}: Hintergrund verschwommen`);
    await page.screenshot({ path: `${AUS}/admin-kilit-${page.viewportSize().width}.png` });
    await page.reload(); await page.waitForTimeout(1200);
    pruefe(await page.locator('#kilit').count() === 1 && await page.locator('#view').innerHTML() === '', `${b}: nach Reload weiter gesperrt, keine Daten`);
    await page.fill('#kilit-pw', 'falsch-xyz'); await page.click('#kilit-btn'); await page.waitForTimeout(700);
    pruefe(/hatalı/i.test(await page.locator('#kilit-hata').innerText()), `${b}: falsches Passwort abgewiesen`);
    await page.fill('#kilit-pw', pw()); await page.click('#kilit-btn'); await page.waitForTimeout(1000);
    pruefe(await page.locator('#kilit').count() === 0 && await page.locator('#topbar-title').innerText() === 'İlan Onayı', `${b}: entsperrt, zurueck auf İlan Onayı`);
    // Inaktivitaet serverseitig simulieren -> naechster Seitenwechsel sperrt
    const tok = await page.evaluate(() => localStorage.getItem('admin_token'));
    const sid = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).sid;
    await q("UPDATE admin_oturumlar SET son_aktivite=NOW()-interval '16 minutes' WHERE id=$1", [sid]);
    await page.goto(BASIS + '#/kullanicilar'); await page.waitForTimeout(1200);
    pruefe(await page.locator('#kilit').count() === 1, `${b}: nach 15 min Inaktivitaet gesperrt`);
    await page.getByText('Başka kullanıcıyla giriş / Çıkış').click(); await page.waitForTimeout(700);
    pruefe(await page.locator('#login-email').count() === 1, `${b}: Çıkış fuehrt zum Login`);
  },
  // Login-Seite: zweigeteilt, Banner, Hinweise, Fuss, Google „Yakında“, Fehler und Erfolg.
  async giris(page, b, mobil) {
    await page.goto(BASIS); await page.waitForSelector('#login-email', { timeout: 8000 });
    pruefe(page.url().endsWith('#/giris'), `${b}: Adresse #/giris`);
    pruefe(await page.getByText('Yönetici Girişi').count() === 1, `${b}: Titel Yönetici Girişi`);
    pruefe(await page.locator('.giris-banner').count() === 1, `${b}: Staging-Banner`);
    pruefe(await page.locator('.giris-sol').isVisible() === !mobil, `${b}: linke Fläche ${mobil ? 'ausgeblendet' : 'sichtbar'}`);
    pruefe(await page.getByText('Tüm giriş denemeleri IP adresi ile kayıt altına alınır.').count() === 1, `${b}: IP-Hinweis`);
    pruefe(await page.getByText('Bu alan yalnızca yetkili personel içindir.', { exact: false }).count() === 1, `${b}: Hinweis yetkili personel`);
    pruefe(/Kap Beni v\d+\.\d+\.\d+ · [0-9a-f]{7}/.test(await page.locator('#giris-version').innerText()), `${b}: Fuss Version · Commit`);
    pruefe(await page.locator('.giris-fuss img[alt="Compendus"]').count() === 1, `${b}: Compendus-Logo im Fuss`);
    pruefe(await page.locator('#google-btn').isDisabled() && /Yakında/.test(await page.locator('#google-btn').innerText()), `${b}: Google-Knopf deaktiviert „Yakında“`);
    await page.waitForFunction(() => document.querySelector('#ts-giris input[name="cf-turnstile-response"]')?.value, null, { timeout: 15000 }).catch(() => {});
    pruefe(!!(await page.locator('#ts-giris input[name="cf-turnstile-response"]').inputValue().catch(() => '')), `${b}: Turnstile (Testmodus) im Admin-Login liefert Token`);
    await page.fill('#login-email', TEST_EMAIL); await page.fill('#login-pw', 'falsch-xyz'); await page.click('#login-btn');
    await page.waitForTimeout(800);
    pruefe(/hatalı/i.test(await page.locator('#login-err').innerText()), `${b}: Fehlermeldung bei falschem Passwort`);
    await page.screenshot({ path: `${AUS}/admin-giris-${page.viewportSize().width}.png` });
    await page.fill('#login-pw', pw()); await page.click('#login-btn');
    await page.waitForSelector('#sidebar', { timeout: 8000 });
    pruefe(page.url().endsWith('#/dashboard'), `${b}: nach Login #/dashboard`);
    await page.waitForTimeout(800);
    pruefe(/UI Test Admin/.test(await page.locator('#topbar-admin').innerText()), `${b}: angemeldeter Admin oben rechts`);
    if (mobil) await page.click('.sb-hamburger');
    await page.locator('.sidebar-footer .nav-item').click(); await page.waitForTimeout(600);
    pruefe(await page.locator('#login-email').count() === 1 && page.url().endsWith('#/giris'), `${b}: Abmelden fuehrt zur Login-Seite`);
  },
  // Entegrasyonlar: Karten, Zustands-Badges, Balken, Yapılandır mit Maske, Bağlantı Testi.
  async entegrasyonlar(page, b) {
    const { q } = require('../_hilfe');
    const vorher = (await q("SELECT 1 FROM entegrasyon_ayarlari WHERE provider='turnstile'")).rows.length;
    await anmelden(page);
    await page.goto(BASIS + '#/entegrasyonlar'); await page.waitForSelector('.ent-karte', { timeout: 8000 });
    pruefe(await page.locator('.ent-karte').count() === 11, `${b}: 11 Entegrasyon-Karten`);
    pruefe(await page.getByText('Entegrasyon Operasyonları').count() === 1, `${b}: Kopf „Entegrasyon Operasyonları“`);
    const meili = page.locator('#ent-meilisearch');
    pruefe(/Hazır|Doğrulanmış/.test(await meili.innerText()), `${b}: Meilisearch Hazır/Doğrulanmış`);
    pruefe(/Devre Dışı/.test(await page.locator('#ent-google_admin').innerText()), `${b}: Google Admin Devre Dışı`);
    await meili.getByText('Yapılandır').click(); await page.waitForTimeout(300);
    const ph = await page.locator('#ent-meilisearch-apiKey').getAttribute('placeholder');
    const val = await page.locator('#ent-meilisearch-apiKey').inputValue();
    pruefe(ph.startsWith('••••') && val === '', `${b}: Geheimfeld maskiert, Feld leer`);
    await page.locator('#ent-turnstile').getByText('Yapılandır').click(); await page.waitForTimeout(300);
    await page.locator('#ent-turnstile').getByText('Bağlantı Testi').click();
    await page.waitForFunction(() => /Son Test/.test(document.querySelector('#ent-turnstile')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
    pruefe(/PASS/.test(await page.locator('#ent-turnstile').innerText()), `${b}: Turnstile-Test PASS (Testmodus)`);
    await page.locator('#ent-turnstile').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${AUS}/admin-entegrasyonlar-${page.viewportSize().width}-form.png`, fullPage: false });
    const ueber = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ueber <= 1, `${b}: kein waagerechter Ueberlauf (${ueber})`);
    // Nur eine Zeile, die allein durch den Test entstand (keine Daten, nie gespeichert), wird entfernt.
    void vorher; await q("DELETE FROM entegrasyon_ayarlari WHERE provider='turnstile' AND credentials IS NULL AND config='{}'::jsonb AND guncelleyen IS NULL");
  },
  // Sidebar: Kopf, Gruppen, Zaehler, YENİ, Hash-Routing, Zurueck, Einklappen, Hazırlanıyor, Fuss.
  async sidebar(page, b, mobil) {
    await anmelden(page);
    pruefe(await page.locator('.sb-panel').innerText().then((t) => /YÖNETİM PANELİ/i.test(t)), `${b}: roter Balken YÖNETİM PANELİ`);
    const gruppen = await page.locator('.sb-grup-kopf').allInnerTexts();
    pruefe(gruppen.length >= 6, `${b}: ${gruppen.length} Gruppen (${gruppen.map((g) => g.replace(/\s+/g, ' ').trim()).join(' | ')})`);
    pruefe(await page.locator('#nav-ilanonay .sayac').count() === 1, `${b}: Zaehler bei İlan Onayı`);
    pruefe(await page.locator('#nav-entegrasyonlar .yeni-plakette').count() === 1, `${b}: Plakette YENİ bei Entegrasyonlar`);
    await page.waitForFunction(() => /·\s*[0-9a-f]{7}/.test(document.querySelector('#sb-version')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    pruefe(/v\d+\.\d+\.\d+ · [0-9a-f]{7}/.test(await page.locator('#sb-version').innerText()), `${b}: Fuss mit Version · Commit`);
    if (mobil) await page.click('.sb-hamburger');
    await page.click('#nav-ilanonay'); await page.waitForTimeout(500);
    pruefe(page.url().endsWith('#/ilanonay'), `${b}: Hash #/ilanonay`);
    if (mobil) pruefe(!(await page.locator('#sidebar').evaluate((e) => e.classList.contains('mobil-offen'))), `${b}: Schublade schliesst nach Klick`);
    if (mobil) await page.click('.sb-hamburger');
    await page.click('#nav-yedekleme'); await page.waitForTimeout(400);
    pruefe(await page.getByText('Hazırlanıyor', { exact: true }).count() >= 1, `${b}: Yedekleme zeigt „Hazırlanıyor“`);
    await page.goBack(); await page.waitForTimeout(500);
    pruefe(page.url().endsWith('#/ilanonay') && await page.locator('#topbar-title').innerText() === 'İlan Onayı', `${b}: Browser-Zurück → İlan Onayı`);
    await page.goto(BASIS + '#/kategoriler'); await page.waitForTimeout(900);
    pruefe(await page.locator('#topbar-title').innerText() === 'Kategoriler & Özellikler', `${b}: Direkteinstieg #/kategoriler nach Reload`);
    if (!mobil) {
      // Gruppe zuklappen bleibt nach Reload zu
      await page.click('.sb-grup-kopf[data-grup="finans"]'); await page.waitForTimeout(200);
      await page.reload(); await page.waitForTimeout(900);
      pruefe(await page.locator('#nav-paketler').count() === 0, `${b}: Gruppe Finans bleibt nach Reload zu`);
      await page.click('.sb-grup-kopf[data-grup="finans"]');
      // Einklappen auf 72 px
      await page.click('.sidebar-logo .sb-ikon-btn'); await page.waitForTimeout(300);
      const w = await page.locator('#sidebar').evaluate((e) => e.getBoundingClientRect().width);
      pruefe(Math.round(w) === 72, `${b}: eingeklappt ${Math.round(w)} px`);
      await page.screenshot({ path: `${AUS}/admin-sidebar-72.png` });
      await page.click('.sidebar-logo .sb-ikon-btn'); await page.waitForTimeout(300);
      // Ziehen: Breite verstellbar
      const box = await page.locator('.sb-zieh').boundingBox();
      await page.mouse.move(box.x + 2, box.y + 200); await page.mouse.down();
      await page.mouse.move(330, box.y + 200, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(400);
      const w2 = await page.locator('#sidebar').evaluate((e) => e.getBoundingClientRect().width);
      pruefe(Math.abs(w2 - 330) < 6, `${b}: per Ziehen auf ${Math.round(w2)} px`);
      await page.evaluate(() => localStorage.removeItem('kp_sb_genislik'));
    }
    const ueber = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ueber <= 1, `${b}: kein waagerechter Ueberlauf (${ueber})`);
  },
  // Kundenliste (v1.25): Sidebar, KPI, Suche, Filter in der Adresse, Abzeichen, Zeile → Akte, Zurück → Liste mit Filter
  async musteriler(page, b) {
    const { q } = require('../_hilfe');
    const elif = (await q("SELECT musteri_no FROM users WHERE email='elif.koc@test.kapbeni.com'")).rows[0].musteri_no;
    await anmelden(page);
    await page.goto(BASIS + '#/musteriler'); await page.waitForSelector('#m-tbody tr.m-row', { timeout: 8000 });
    pruefe(await page.locator('#nav-musteriakte').count() === 0, `${b}: „Hazırlanıyor“-Eintrag ersetzt`);
    pruefe(await page.locator('#nav-bireysel').count() + await page.locator('#nav-kurumsal').count() === 2 || b.includes('mobil'), `${b}: Unterpunkte Bireysel/Kurumsal`);
    pruefe(await page.locator('#m-kpi .stat-card').count() === 6, `${b}: sechs Kennzahlen`);
    pruefe(await page.locator('#m-tbody .kp-no').count() > 3, `${b}: Kundennummer-Abzeichen`);
    pruefe(await page.locator('#m-tbody .kp-aktif').count() > 0 && await page.locator('#m-tbody .kp-pasif').count() > 0, `${b}: AKTİF / AKTİF DEĞİL`);
    pruefe(await page.locator('#m-tbody .kp-sil').count() > 0 && await page.locator('#m-tbody .kp-askida').count() > 0, `${b}: Silme talebi / Askıda`);
    await page.selectOption('#mf-tip', 'kurumsal'); await page.waitForTimeout(700);
    pruefe(page.url().includes('tip=kurumsal'), `${b}: Filter in der Adresse`);
    pruefe(await page.locator('#m-tbody .kp-no.kur').count() >= 2 && await page.locator('#m-tbody .kp-no.k').count() === 0, `${b}: nur gelbe (kurumsal)`);
    await page.selectOption('#mf-tip', ''); await page.fill('#mf-q', '0555 001 00 08'); await page.press('#mf-q', 'Enter'); await page.waitForTimeout(700);
    pruefe(await page.locator('#m-tbody tr.m-row').count() === 1, `${b}: Suche Telefon → 1 Treffer`);
    await page.screenshot({ path: `${AUS}/admin-musteriler-${page.viewportSize().width}.png`, fullPage: true });
    await page.click('#m-tbody tr.m-row'); await page.waitForSelector('.akte-kopf', { timeout: 8000 });
    pruefe(page.url().endsWith(`#/musteri/${elif}/zaman`), `${b}: Zeile → Akte (${page.url().split('#')[1]})`);
    await page.goBack(); await page.waitForSelector('#m-tbody', { timeout: 5000 }); await page.waitForTimeout(600);
    pruefe(await page.inputValue('#mf-q') === '0555 001 00 08', `${b}: Zurück → Liste mit Suche`);
    await page.goto(BASIS + '#/kullanicilar'); await page.waitForTimeout(800);
    pruefe(page.url().endsWith('#/musteriler'), `${b}: alte Adresse #/kullanicilar umgeleitet`);
  },
  // Kundenakte (v1.26): Kopf, Reiter per Hash, Zeitleiste (neuester Tag offen, Ansicht gespeichert, Chips springen), Bilder
  async akte(page, b) {
    const { q } = require('../_hilfe');
    const no = (k) => q('SELECT musteri_no FROM users WHERE email=$1', [k]).then((r) => r.rows[0].musteri_no);
    const kaya = await no('satis.kayaelektronik@test.kapbeni.com'), ayse = await no('ayse.yilmaz@test.kapbeni.com');
    const emre = await no('emre.celik@test.kapbeni.com'), mehmet = await no('mehmet.demir@test.kapbeni.com');
    await anmelden(page);
    await page.evaluate(() => localStorage.removeItem('kp_akte_gorunum'));
    await page.goto(BASIS + `#/musteri/${ayse}/zaman`); await page.waitForSelector('.day', { timeout: 8000 });
    const farbe = await page.locator('.akte-kopf .kp-no').evaluate((e) => getComputedStyle(e).backgroundColor);
    pruefe(farbe === 'rgb(220, 38, 38)', `${b}: Frau = rot (${farbe})`);
    pruefe(await page.locator('.akte-kopf .kp-aktif').count() === 1, `${b}: AKTİF pulsiert`);
    pruefe(await page.locator('.akte-kpi > div').count() === 6, `${b}: sechs Kacheln`);
    const offen = await page.locator('.day .ent').evaluateAll((e) => new Set(e.map((x) => x.closest('.day').id)).size);
    pruefe(offen === 1 && await page.locator('.day').count() > 3, `${b}: nur der neueste Tag offen (${offen})`);
    await page.locator('.day').first().screenshot({ path: `${AUS}/admin-akte-tag-${page.viewportSize().width}.png` }).catch(() => {});
    // Tageschip springt (oeffnet einen anderen Tag)
    await page.locator('.day').nth(2).locator('.day-chip').first().click(); await page.waitForTimeout(500);
    pruefe(await page.locator('.day').nth(2).locator('.ent').count() > 0, `${b}: Tageschip öffnet und springt`);
    pruefe(await page.locator('.tl-flash').count() === 1, `${b}: Eintrag blinkt`);
    // Filter
    await page.click('.tl-f[data-f="giris"]'); await page.waitForTimeout(300);
    pruefe(await page.locator('.ent').evaluateAll((e) => e.every((x) => x.dataset.tur === 'giris')), `${b}: Filter Girişler`);
    await page.click('.tl-f[data-f="tumu"]'); await page.click('.tl-lnk >> text=Tümünü aç'); await page.waitForTimeout(300);
    pruefe(await page.locator('.day').count() === await page.locator('.day').evaluateAll((d) => d.filter((x) => x.querySelector('.ent')).length), `${b}: Tümünü aç`);
    // Ansicht Liste / Kutucuk, gespeichert
    await page.click('.tl-seg button >> text=Liste'); await page.waitForTimeout(300);
    pruefe(await page.locator('tr.dl-day').count() > 0, `${b}: Liste mit Tageszeilen`);
    await page.reload(); await page.waitForSelector('.akte-kopf', { timeout: 8000 }); await page.waitForTimeout(800);
    pruefe(await page.locator('tr.dl-day').count() > 0, `${b}: Ansicht nach Reload gespeichert`);
    await page.click('.tl-seg button >> text=Kutucuk'); await page.waitForTimeout(800);
    const kach = await page.locator('.kach img').evaluateAll((i) => i.filter((x) => x.complete && x.naturalWidth > 0).length);
    pruefe(kach > 0, `${b}: Kutucuk mit Inseratsbildern (${kach})`);
    await page.click('.tl-seg button >> text=Blok');
    // Reiter per Hash + Zurück
    await page.click('.akte-tab[data-r="ilanlar"]'); await page.waitForSelector('#akte-inhalt table', { timeout: 6000 }); await page.waitForTimeout(800);
    pruefe(page.url().endsWith(`#/musteri/${ayse}/ilanlar`), `${b}: Reiter in der Adresse`);
    const bilder = await page.locator('#akte-inhalt img').evaluateAll((i) => [i.length, i.filter((x) => x.complete && x.naturalWidth > 0).length]);
    pruefe(bilder[0] > 0 && bilder[0] === bilder[1], `${b}: İlanlar-Bilder geladen inkl. Archiv (${bilder[1]}/${bilder[0]})`);
    await page.goBack(); await page.waitForSelector('.day', { timeout: 6000 });
    pruefe(page.url().endsWith('/zaman'), `${b}: Zurück → vorheriger Reiter`);
    // Gewerbe: gelb, Firmenblock, Belgeler
    await page.goto(BASIS + `#/musteri/${kaya}/belgeler`); await page.waitForSelector('.akte-firma', { timeout: 8000 }); await page.waitForTimeout(800);
    pruefe(await page.locator('.akte-kopf .kp-no.kur').count() === 1, `${b}: Kurumsal = gelb`);
    pruefe(await page.locator('#akte-inhalt .card').count() >= 7, `${b}: sechs Unterlagen + Kurumsal-Onay`);
    await page.screenshot({ path: `${AUS}/admin-akte-kurumsal-${page.viewportSize().width}.png`, fullPage: true });
    // Silme talebi
    await page.goto(BASIS + `#/musteri/${emre}/ozet`); await page.waitForSelector('.akte-kopf', { timeout: 8000 });
    pruefe(/Silme talebi · \d+ gün kaldı/.test(await page.locator('#akte-hesap-rozet').innerText()), `${b}: rotes Abzeichen Silme talebi`);
    // Mesajlar riskant, IP
    await page.goto(BASIS + `#/musteri/${mehmet}/mesajlar`); await page.waitForSelector('#akte-inhalt .msg', { timeout: 8000 });
    pruefe(await page.locator('.msg.risk').count() >= 2, `${b}: riskante Nachrichten markiert`);
    await page.click('.akte-tab[data-r="ip"]'); await page.waitForSelector('#akte-inhalt table tbody tr', { timeout: 6000 });
    pruefe(await page.locator('#akte-inhalt tbody tr').count() > 3, `${b}: IP-Protokoll`);
    await page.screenshot({ path: `${AUS}/admin-akte-ip-${page.viewportSize().width}.png`, fullPage: true });
    await page.goto(BASIS + `#/musteri/${ayse}/zaman`); await page.waitForSelector('.day', { timeout: 8000 }); await page.waitForTimeout(500);
    await page.screenshot({ path: `${AUS}/admin-akte-${page.viewportSize().width}.png`, fullPage: true });
    const ueber = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    pruefe(ueber <= 1, `${b}: kein waagerechter Ueberlauf (${ueber})`);
  },
  // Kategoriler unter :3002 (frueher „0 ana kategori“) und Özellikler: Wert hinzufügen und wieder entfernen
  async kategoriler(page, b) {
    await anmelden(page);
    await page.goto(BASIS + '#/kategoriler'); await page.waitForSelector('#kat-grid .card', { timeout: 8000 });
    const n = await page.locator('#kat-grid .card').count();
    pruefe(n >= 10, `${b}: ${n} Hauptkategorien unter :3002`);
    await page.locator('#kat-grid .card').nth(1).click(); await page.waitForSelector('[data-tanim]', { timeout: 8000 });
    pruefe(/#\/kategoriler\/ozellikler\?k=\d+/.test(page.url()), `${b}: Özellikler mit Kategorie in der Adresse`);
    const karte = page.locator('[data-tanim]').filter({ hasText: 'marka' }).first();
    const tid = await karte.getAttribute('data-tanim');
    const wert = 'UiTestMarka' + Date.now();
    await page.fill(`#oz-yeni-${tid}`, wert); await page.click(`[data-tanim="${tid}"] button:has-text("Ekle")`); await page.waitForTimeout(900);
    const zeilen = await page.locator(`[data-tanim="${tid}"] .oz-deger`).allInnerTexts();
    pruefe(zeilen.at(-2) === wert && zeilen.at(-1) === 'Diğer', `${b}: neuer Wert vor „Diğer“`);
    await page.screenshot({ path: `${AUS}/admin-ozellikler-${page.viewportSize().width}.png` });
    page.once('dialog', (d) => d.accept());
    await page.locator(`[data-tanim="${tid}"] .ozb-row`).filter({ hasText: wert }).locator('button:has-text("Kaldır")').click(); await page.waitForTimeout(900);
    pruefe(!(await page.locator(`[data-tanim="${tid}"] .oz-deger`).allInnerTexts()).includes(wert), `${b}: Wert entfernt`);
    await page.goBack(); await page.waitForTimeout(800);
    pruefe(page.url().endsWith('#/kategoriler'), `${b}: Zurück → Kategoriler`);
  },
  // Kundennummer-Abzeichen in den übrigen Listen mit Link auf die Akte
  async listen(page, b) {
    await anmelden(page);
    for (const [r, sel] of [['ilanonay', '#view .kp-no'], ['riskmesaj', '#view .kp-no'], ['ilansikayet', '#view .kp-no'], ['kyc', '#view .kp-no'], ['kurumsalonay', '#view .kp-no']]) {
      await page.goto(BASIS + '#/' + r); await page.waitForTimeout(1200);
      pruefe(await page.locator(sel).count() > 0, `${b}: ${r} zeigt Kundennummer`);
    }
    await page.goto(BASIS + '#/riskmesaj'); await page.waitForTimeout(1000);
    await page.locator('#view a.kp-no').first().click(); await page.waitForSelector('.akte-kopf', { timeout: 8000 });
    pruefe(/#\/musteri\/KP-/.test(page.url()), `${b}: Abzeichen → Akte`);
  },
};

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const namen = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SZENARIEN);
  const browser = await chromium.launch({ executablePath: CHROME });
  for (const n of namen) {
    for (const br of BREITEN) {
      const ctx = await browser.newContext({ viewport: { width: br.width, height: br.height } });
      const page = await ctx.newPage();
      const konsole = [];
      page.on('pageerror', (e) => konsole.push(e.message));
      try { await SZENARIEN[n](page, `${n}/${br.name}`, br.width < 768); }
      catch (e) { pruefe(false, `${n}/${br.name}: Ausnahme ${e.message.split('\n')[0]}`); }
      pruefe(konsole.length === 0, `${n}/${br.name}: keine JS-Fehler ${konsole.join(' | ')}`);
      await page.screenshot({ path: `${AUS}/admin-${n}-${br.width}.png` }).catch(() => {});
      await ctx.close();
      await kurz(400);
    }
  }
  await browser.close();
  await require('../_hilfe').pool.end().catch(() => {});
  console.log(fehler.length ? `\n${fehler.length} FEHLER` : '\nALLES OK');
  process.exit(fehler.length ? 1 : 0);
})();
