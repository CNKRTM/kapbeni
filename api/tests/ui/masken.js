// ════════════════════════════════════════════════════════════════════════════
//  Oberflaechen-Pruefung der Masken mit Playwright (headless Chromium).
//    node /opt/kapbeni/api/tests/ui/masken.js [szenario ...]
//  Braucht playwright-core unter /opt/_pwtest (nicht Teil des Repos) und das
//  vorhandene Chromium in ~/.cache/ms-playwright. Laeuft gegen den LAN-Vhost
//  :3003 (gleiches dist wie kapbeni.com). Angemeldet wird das Testkonto
//  users.id=15 per Token im localStorage — kein Passwort, nie users.id=1.
//  Bildschirmfotos: /tmp/kp-ui/<szenario>-<breite>.png
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');
const { tokenFuer, pool, TESTKONTO } = require('../_hilfe');

const BASIS = process.env.UI_BASIS || 'http://127.0.0.1:3003';
const AUS = '/tmp/kp-ui';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));

const BREITEN = [{ name: 'mobil', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); };

const SZENARIEN = {
  // Turnstile (Testmodus) und Google „Yakında“ im AuthModal — ohne Anmeldung, eigener Kontext.
  async turnstile(page, b) {
    const ctx = await page.context().browser().newContext({ viewport: page.viewportSize(), locale: 'tr-TR' });
    const p2 = await ctx.newPage();
    try {
      await p2.goto(`${BASIS}/#/`); await p2.waitForTimeout(1500);
      await p2.locator('button[title="Sat"]:visible').or(p2.getByRole('button', { name: 'Sat', exact: true })).first().click();
      await p2.waitForTimeout(600);
      pruefe(await p2.getByRole('heading', { name: 'Giriş Yap' }).count() === 1, `${b}: AuthModal offen`);
      await p2.waitForFunction(() => document.querySelector('[data-turnstile="test"] input[name="cf-turnstile-response"]')?.value, null, { timeout: 15000 }).catch(() => {});
      pruefe(!!(await p2.locator('[data-turnstile="test"] input[name="cf-turnstile-response"]').inputValue().catch(() => '')), `${b}: Turnstile-Widget (Testmodus) im Login liefert Token`);
      const g = p2.getByRole('button', { name: /Google ile Giriş/ });
      pruefe(await g.isDisabled() && /Yakında/.test(await g.textContent()), `${b}: Google-Knopf deaktiviert „Yakında“`);
      await p2.screenshot({ path: `${AUS}/turnstile-giris-${p2.viewportSize().width}.png` });
      await p2.getByRole('button', { name: 'Kayıt Ol', exact: true }).first().click().catch(() => {});
      await p2.waitForTimeout(800);
      await p2.waitForFunction(() => document.querySelector('[data-turnstile="test"] input[name="cf-turnstile-response"]')?.value, null, { timeout: 15000 }).catch(() => {});
      pruefe(!!(await p2.locator('[data-turnstile="test"] input[name="cf-turnstile-response"]').inputValue().catch(() => '')), `${b}: Turnstile-Widget in der Registrierung liefert Token`);
    } finally { await ctx.close(); }
  },
  // İl/İlçe-Combobox in den Einstellungen: aufklappen, tippen filtert, Aksaray vorhanden, İlçe laedt.
  async iller(page, b) {
    await page.goto(`${BASIS}/#/ayarlar`); await page.waitForTimeout(1500);
    await page.getByText('Profil Ayarları', { exact: true }).first().click();
    const il = page.getByRole('combobox', { name: 'İl' }).first();
    await il.click(); await il.fill('aksa');
    await page.waitForTimeout(300);
    const opt = page.getByRole('option', { name: 'Aksaray' });
    pruefe(await opt.count() === 1, `${b}: Tippen "aksa" zeigt Aksaray`);
    await opt.click();
    pruefe(await il.inputValue() === 'Aksaray', `${b}: Auswahl uebernimmt Aksaray`);
    const ilce = page.getByRole('combobox', { name: 'İlçe' }).first();
    await ilce.click(); await page.waitForTimeout(800);
    const n = await page.getByRole('option').count();
    pruefe(n >= 7, `${b}: İlçe-Liste fuer Aksaray geladen (${n})`);
    // Liste klappt nach unten auf (Oberkante der Liste unter dem Feld)
    const fb = await ilce.boundingBox(); const lb = await page.getByRole('listbox').boundingBox();
    pruefe(lb && fb && lb.y >= fb.y + fb.height - 2, `${b}: Liste klappt nach unten auf`);
    await ilce.fill('Eigener Ort'); await page.keyboard.press('Escape');
    pruefe(await ilce.inputValue() === 'Eigener Ort', `${b}: freie Eingabe bleibt erhalten`);
  },
  // Kundennummer + Abzeichen im Kundenkonto (Profil) und im Panel.
  async musteri(page, b) {
    await page.goto(`${BASIS}/#/profil`); await page.waitForTimeout(1800);
    pruefe(await page.getByText(/KP-\d{4}-\d{7}/).count() > 0, `${b}: Kundennummer im Profil sichtbar`);
    pruefe(await page.getByText(/'(dan|den|tan|ten) beri üye/).count() > 0, `${b}: Abzeichen "… beri üye" im Profil`);
    await page.goto(`${BASIS}/#/panel/ilanlarim`); await page.waitForTimeout(1500);
    pruefe(await page.getByText(/KP-\d{4}-\d{7}/).count() > 0, `${b}: Kundennummer im Panel sichtbar`);
  },
  // Verkaufsmaske: Zustand 4 Stufen, Merkmale der Kategorie dynamisch, Marke als Combobox.
  async satis(page, b) {
    await page.goto(`${BASIS}/#/`); await page.waitForTimeout(1500);
    // Mobil: Knopf mit title="Sat", Desktop: Knopf mit Text "Sat".
    await page.locator('button[title="Sat"]:visible').or(page.getByRole('button', { name: 'Sat', exact: true })).first().click();
    await page.waitForTimeout(800);
    const durum = page.getByRole('combobox', { name: 'Durum' }).first();
    const opts = await durum.locator('option').allTextContents();
    pruefe(JSON.stringify(opts) === JSON.stringify(['Durum seçin', 'Sıfır', 'Yeni gibi', 'Az kullanılmış', 'Kullanılmış']), `${b}: Durum hat 4 Stufen (${opts.join('/')})`);
    const kat = page.locator('form select').first();
    await kat.selectOption('araba'); await page.waitForTimeout(300);
    await page.locator('form select').nth(1).selectOption('araba-araba'); await page.waitForTimeout(1200);
    const marka = page.getByRole('combobox', { name: 'Marka' });
    pruefe(await marka.count() === 1, `${b}: Marka-Combobox erscheint fuer Araba`);
    await marka.click(); await marka.fill('tog'); await page.waitForTimeout(200);
    pruefe(await page.getByRole('option', { name: 'Togg' }).count() === 1, `${b}: Marka filtert (tog -> Togg)`);
    await page.getByRole('option', { name: 'Togg' }).click();
    pruefe(await page.getByRole('textbox', { name: 'KM' }).count() === 1, `${b}: Feld KM vorhanden`);
    await page.getByRole('textbox', { name: 'KM' }).scrollIntoViewIfNeeded();
  },
  // "Hızlı İlan Ver – 3 adımda": Leer-Zustand im Panel, Zurueck schliesst, am Ende Verkaufsmaske.
  async hizli(page, b) {
    await page.goto(`${BASIS}/#/panel/ilanlarim`); await page.waitForTimeout(1800);
    const knopf = page.getByRole('button', { name: /Hızlı İlan Ver/ }).first();
    pruefe(await knopf.count() === 1, `${b}: Knopf Hızlı İlan Ver im Panel`);
    await knopf.click(); await page.waitForTimeout(300);
    pruefe(await page.getByText('Adım 1/3').count() === 1, `${b}: Modal offen (Schritt 1)`);
    await page.goBack(); await page.waitForTimeout(400);
    pruefe(await page.getByText('Adım 1/3').count() === 0 && page.url().includes('#/panel/ilanlarim'), `${b}: Browser-Zurueck schliesst Modal, bleibt im Panel`);
    await knopf.click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'İleri' }).click();
    pruefe(await page.getByText('Adım 2/3').count() === 1, `${b}: Schritt 2`);
    await page.getByRole('button', { name: 'İleri' }).click();
    await page.screenshot({ path: `${AUS}/hizli-adim3-${b.split('/')[1]}.png` });
    await page.getByRole('button', { name: 'Şimdi ilan ver' }).click(); await page.waitForTimeout(800);
    pruefe(await page.getByText('Hemen İlan Verin').count() === 1, `${b}: "Şimdi ilan ver" oeffnet die Verkaufsmaske`);
  },
  // Kontoloeschung in den Einstellungen: Fehler wird angezeigt, Nutzer bleibt angemeldet.
  // Die API-Antwort wird abgefangen (500) — es wird KEIN echter Antrag gestellt.
  async silme(page, b) {
    await page.route('**/api/hesap/sil', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ hata: 'Test: Sunucu hatası' }) }));
    await page.goto(`${BASIS}/#/ayarlar`); await page.waitForTimeout(1500);
    await page.getByText('Hesap İşlemleri', { exact: true }).first().click();
    await page.getByText('Hesabımı Sil ve Beni Unut').first().click(); await page.waitForTimeout(300);
    pruefe(await page.getByText(/30 gün içinde tekrar giriş yaparsanız/).count() === 1, `${b}: Dialog beschreibt den echten Ablauf`);
    await page.getByRole('button', { name: 'Hesabı Sil' }).click(); await page.waitForTimeout(600);
    pruefe(await page.getByText('Test: Sunucu hatası').count() === 1, `${b}: Fehler wird sichtbar angezeigt`);
    pruefe(await page.evaluate(() => !!localStorage.getItem('sg_token')), `${b}: bei Fehler nicht abgemeldet`);
  },
};

(async () => {
  const wahl = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SZENARIEN);
  fs.mkdirSync(AUS, { recursive: true });
  const token = await tokenFuer(TESTKONTO);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    for (const name of wahl) for (const br of BREITEN) {
      const ctx = await browser.newContext({ viewport: { width: br.width, height: br.height }, locale: 'tr-TR' });
      await ctx.addInitScript((t) => { try { localStorage.setItem('sg_token', t) } catch {} }, token);
      // Cookie-Entscheidung vorbelegen (Banner seit Arbeitspaket D), damit er keine Klicks abfaengt
      await ctx.addInitScript(() => { try { if (!localStorage.getItem('kapbeni_cookie_consent')) localStorage.setItem('kapbeni_cookie_consent', JSON.stringify({ v: '1.0', zorunlu: true, analitik: false, pazarlama: false, zaman: new Date().toISOString() })) } catch {} });
      const page = await ctx.newPage();
      const konsole = [];
      page.on('pageerror', (e) => konsole.push(e.message));
      try { await SZENARIEN[name](page, `${name}/${br.name}`); }
      catch (e) { pruefe(false, `${name}/${br.name}: Abbruch ${e.message.split('\n')[0]}`); }
      await page.screenshot({ path: `${AUS}/${name}-${br.name}.png`, fullPage: false });
      pruefe(konsole.length === 0, `${name}/${br.name}: keine Seitenfehler ${konsole.join(' | ')}`);
      await ctx.close();
    }
  } finally { await browser.close(); await pool.end(); }
  console.log(fehler.length ? `\n${fehler.length} Fehler` : '\nalles gruen');
  process.exit(fehler.length ? 1 : 0);
})();

module.exports = { SZENARIEN };
