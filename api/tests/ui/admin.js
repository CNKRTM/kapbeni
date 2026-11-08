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
    if (!vorher) await q("DELETE FROM entegrasyon_ayarlari WHERE provider='turnstile' AND credentials IS NULL AND config='{}'::jsonb AND guncelleyen IS NULL");
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
    pruefe(await page.locator('#topbar-title').innerText() === 'Kategoriler', `${b}: Direkteinstieg #/kategoriler nach Reload`);
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
