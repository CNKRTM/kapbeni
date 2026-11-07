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
