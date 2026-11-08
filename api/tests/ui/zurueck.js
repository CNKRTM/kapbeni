// ════════════════════════════════════════════════════════════════════════════
//  Browser-Zurück auf der Website (Auftragssammlung K, v1.30) — Playwright.
//    node /opt/kapbeni/api/tests/ui/zurueck.js [szenario ...]
//  UI_BASIS (Standard :3003 = gleiches dist wie kapbeni.com). Angemeldet wird
//  NUR das Testkonto users.id=15 per Token im localStorage (kein Passwort).
//  Jede Seite / jedes Fenster → Zurück → richtiger Ort, auch nach Direkteinstieg
//  und Reload, auf 390 und 1280 px. Fotos: /tmp/kp-ui/zurueck-<szenario>-<breite>.png
//  Chat-Szenario: Konversation des Testkontos mit einem Seed-Testkunden (test_verisi),
//  wird am Ende wieder geloescht.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');
const { tokenFuer, q, pool, TESTKONTO } = require('../_hilfe');

const BASIS = process.env.UI_BASIS || 'http://127.0.0.1:3003';
const AUS = '/tmp/kp-ui';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));
const BREITEN = [{ name: 'mobil', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); };
const hash = (page) => new URL(page.url()).hash || '#/';
const warte = (page, ms = 700) => page.waitForTimeout(ms);
async function zurueck(page) { await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await warte(page, 900); }

let FREMD = null;   // aktives Inserat eines Seed-Testkunden (nicht Testkonto 15)

const SZENARIEN = {
  // Seitenwechsel, Scrollposition, Reload, Direkteinstieg
  async seiten(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1800);
    await page.evaluate(() => window.scrollTo(0, 900)); await warte(page, 400);
    const y0 = await page.evaluate(() => window.scrollY);
    // Karte anklicken (Startseite → Detail)
    await page.evaluate(() => window.scrollTo(0, 900)); await warte(page, 300);
    const karte = page.locator('div.group.cursor-pointer').filter({ has: page.locator('p.text-primary') }).first();
    await karte.scrollIntoViewIfNeeded(); const yKarte = await page.evaluate(() => window.scrollY);
    await karte.click(); await warte(page, 1200);
    pruefe(/^#\/ilan\//.test(hash(page)), `${b}: Karte → Detail (${hash(page)})`);
    const detail = hash(page);
    await zurueck(page);
    pruefe(hash(page) === '#/', `${b}: Zurück → Startseite`);
    const y1 = await page.evaluate(() => window.scrollY);
    pruefe(Math.abs(y1 - yKarte) < 60, `${b}: Scrollposition wiederhergestellt (${y1} ≈ ${yKarte})`);
    await page.goForward(); await warte(page, 1000);
    pruefe(hash(page) === detail, `${b}: Vorwärts → wieder Detail`);
    // Reload auf dem Detail, dann Zurück
    await page.reload(); await warte(page, 1800);
    pruefe(hash(page) === detail && await page.getByText('Mesaj Gönder').count() > 0, `${b}: Reload → Detail bleibt`);
    await zurueck(page);
    pruefe(hash(page) === '#/', `${b}: nach Reload Zurück → Startseite`);
    // Direkteinstieg: Kategorie → Panel → Zurück
    await page.goto('about:blank'); await page.goto(`${BASIS}/#/panel/ilanlarim`); await warte(page, 1800);
    pruefe(hash(page) === '#/panel/ilanlarim', `${b}: Direkteinstieg Panel`);
    await page.goto(`${BASIS}/#/ilan/${FREMD}`); await warte(page, 1500);  // neue Ladung? nur Hash: App ignoriert → Reload
    await page.reload(); await warte(page, 1800);
    pruefe(hash(page) === `#/ilan/${FREMD}`, `${b}: Direkteinstieg Detail`);
    void y0;
  },
  // Destek Merkezi und Paketler haben eigene Routen
  async destek(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1800);
    await page.locator('button.bg-red-600:visible', { hasText: 'Destek' }).first().click(); await warte(page, 900);
    pruefe(hash(page) === '#/destek', `${b}: Destek → #/destek`);
    await zurueck(page);
    pruefe(hash(page) === '#/' && await page.locator('.z-\\[95\\]').count() === 0, `${b}: Zurück schließt Destek Merkezi`);
    await page.goto('about:blank'); await page.goto(`${BASIS}/#/destek`); await warte(page, 1800);
    pruefe(await page.locator('.z-\\[95\\]').count() === 1, `${b}: Direkteinstieg #/destek öffnet`);
    await page.reload(); await warte(page, 1800);
    pruefe(hash(page) === '#/destek' && await page.locator('.z-\\[95\\]').count() === 1, `${b}: Reload #/destek bleibt offen`);
    await page.keyboard.press('Escape'); await warte(page, 900);
    pruefe(hash(page) === '#/' && await page.locator('.z-\\[95\\]').count() === 0, `${b}: Escape schließt (Direkteinstieg → Startseite) [${hash(page)}]`);
    await page.goto('about:blank'); await page.goto(`${BASIS}/#/paketler`); await warte(page, 1800);
    pruefe(hash(page) === '#/paketler', `${b}: Direkteinstieg #/paketler`);
  },
  // Fenster: Verkaufsmaske, Teilen, Lightbox, Footer-Paket — Zurück schließt, X hinterlässt keinen toten Eintrag
  async fenster(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    await page.goto(`${BASIS}/#/ilan/${FREMD}`); await page.reload(); await warte(page, 2000);
    // Lightbox
    await page.locator('.cursor-zoom-in img').first().click({ force: true }); await warte(page, 600);
    const lbOffen = await page.locator('[role="dialog"], .fixed.inset-0').count();
    pruefe(lbOffen > 0, `${b}: Lightbox offen`);
    await zurueck(page);
    pruefe(hash(page) === `#/ilan/${FREMD}` && await page.locator('.cursor-zoom-in').count() > 0, `${b}: Zurück schließt Lightbox, Detail bleibt`);
    // Teilen
    await page.locator('button[title="Paylaş"]').first().click(); await warte(page, 500);
    pruefe(await page.getByText('Cihazda Paylaş').count() + await page.getByText('Bağlantıyı kopyala').count() > 0, `${b}: Teilen-Menü offen`);
    await zurueck(page);
    pruefe(await page.getByText('Bağlantıyı kopyala').count() === 0 && hash(page) === `#/ilan/${FREMD}`, `${b}: Zurück schließt Teilen-Menü`);
    // Verkaufsmaske: öffnen, X, dann Zurück → kein toter Eintrag (Seite davor = Startseite)
    await page.goto(`${BASIS}/#/`); await warte(page, 400);
    await page.reload(); await warte(page, 1500);
    { const k = page.locator('div.group.cursor-pointer').filter({ has: page.locator('p.text-primary') }).first();
      await k.scrollIntoViewIfNeeded(); await k.click({ force: true }); await warte(page, 1200); }
    const detail = hash(page);
    await page.locator('button[title="Sat"]:visible, header button:has-text("Sat"):visible').first().click(); await warte(page, 900);
    const sat = page.getByRole('heading', { name: 'Hemen İlan Verin' });
    pruefe(await sat.count() > 0, `${b}: Verkaufsmaske offen`);
    await zurueck(page);
    pruefe(await sat.count() === 0 && hash(page) === detail, `${b}: Zurück schließt Verkaufsmaske, Detail bleibt`);
    await page.locator('button[title="Sat"]:visible, header button:has-text("Sat"):visible').first().click(); await warte(page, 900);
    await page.keyboard.press('Escape'); await warte(page, 900);
    pruefe(await sat.count() === 0, `${b}: Escape schließt Verkaufsmaske`);
    await zurueck(page);
    pruefe(hash(page) === '#/', `${b}: danach Zurück → Startseite (kein toter Eintrag)`);
    // Footer-Paket-Fenster
    const paket = page.locator('footer button').filter({ hasText: /Paket|Plus|Zirve|Vitrin|Standart/i }).first();
    if (await paket.count()) {
      await paket.scrollIntoViewIfNeeded(); await paket.click(); await warte(page, 600);
      const pm = page.locator('.z-\\[200\\]');
      pruefe(await pm.count() === 1, `${b}: Footer-Paket offen`);
      await zurueck(page);
      pruefe(await pm.count() === 0 && hash(page) === '#/', `${b}: Zurück schließt Footer-Paket`);
    }
  },
  // Chat nur noch über die echte API-Konversation
  async chat(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 800);
    await page.goto(`${BASIS}/#/ilan/${FREMD}`); await page.reload(); await warte(page, 2000);
    await page.getByText('Mesaj Gönder').first().click(); await warte(page, 1500);
    pruefe(/^#\/mesajlar\/\d+$/.test(hash(page)), `${b}: Mesaj Gönder → #/mesajlar/<API-ID> (${hash(page)})`);
    const ziel = hash(page);
    await page.reload(); await warte(page, 2000);
    pruefe(hash(page) === ziel, `${b}: Chat-Link übersteht Reload`);
    await zurueck(page);
    pruefe(hash(page) === `#/ilan/${FREMD}`, `${b}: Zurück → Inserat`);
  },
  // Rechtsseiten
  async legal(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    await page.locator('footer a[href="/#/gizlilik-politikasi"]').first().click(); await warte(page, 900);
    pruefe(hash(page) === '#/gizlilik-politikasi', `${b}: Footer → Gizlilik`);
    await zurueck(page);
    pruefe(hash(page) === '#/' && await page.locator('footer').count() > 0, `${b}: Zurück → Startseite`);
    await page.goto('about:blank'); await page.goto(`${BASIS}/#/nasil-calisir`); await warte(page, 1500);
    const geri = page.getByRole('button', { name: /Geri|Ana Sayfa/ }).first();
    if (await geri.count()) {
      await geri.click(); await warte(page, 900);
      pruefe(hash(page) === '#/', `${b}: Direkteinstieg Rechtsseite → Geri → Startseite`);
    } else pruefe(true, `${b}: (Nasıl Çalışır ohne Geri-Knopf)`);
  },
};

(async () => {
  const wahl = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SZENARIEN);
  fs.mkdirSync(AUS, { recursive: true });
  FREMD = (await q(`SELECT i.uuid FROM ilanlar i JOIN users u ON u.id=i.user_id
    WHERE u.test_verisi AND u.id<>$1 AND i.ilan_durum='aktif' ORDER BY i.id LIMIT 1`, [TESTKONTO])).rows[0]?.uuid;
  if (!FREMD) throw new Error('kein aktives Seed-Testinserat');
  const vorherKonv = (await q('SELECT COALESCE(max(id),0) m FROM konusmalar')).rows[0].m;
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
      await page.screenshot({ path: `${AUS}/zurueck-${name}-${br.name}.png` }).catch(() => {});
      pruefe(konsole.length === 0, `${name}/${br.name}: keine Seitenfehler ${konsole.join(' | ')}`);
      await ctx.close();
      // Rate-Limit /api 120/min je IP: zwischen den Durchlaeufen kurz pausieren
      await new Promise((r) => setTimeout(r, 15000));
    }
  } finally {
    // Testkonversationen (nur Testkonto ↔ Testkunde) wieder entfernen
    await q(`DELETE FROM mesajlar WHERE konusma_id IN (SELECT id FROM konusmalar WHERE id>$1 AND alici_id=$2)`, [vorherKonv, TESTKONTO]).catch(() => {});
    await q('DELETE FROM konusmalar WHERE id>$1 AND alici_id=$2', [vorherKonv, TESTKONTO]).catch(() => {});
    await browser.close(); await pool.end();
  }
  console.log(fehler.length ? `\n${fehler.length} Fehler` : '\nalles gruen');
  process.exit(fehler.length ? 1 : 0);
})();
