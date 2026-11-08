// ════════════════════════════════════════════════════════════════════════════
//  Rechtsseiten + Cookie-Banner (Arbeitspaket D) — Playwright.
//    UI_BASIS=http://127.0.0.1:3905 node /opt/kapbeni/api/tests/ui/rechtsseiten.js [szenario ...]
//  Ohne Anmeldung (die Seiten sind öffentlich) — es wird kein Token erzeugt und
//  nichts geschrieben; der Test liest nur und setzt localStorage im Testbrowser.
//  390 und 1280 px. Fotos: /tmp/kp-ui/recht-<szenario>-<breite>.png
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');

const BASIS = process.env.UI_BASIS || 'http://127.0.0.1:3003';
const AUS = '/tmp/kp-ui';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));
const BREITEN = [{ name: 'mobil', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const SLUGS = ['kvkk', 'acik-riza', 'cerez-politikasi', 'gizlilik-politikasi', 'kullanim-kosullari', 'uyelik-sozlesmesi',
  'ilan-verme-kurallari', 'yasakli-urunler', 'guvenli-alisveris', 'hak-ihlali-bildirimi', 'kurumsal-satici-sozlesmesi',
  'mesafeli-satis', 'on-bilgilendirme', 'iade-politikasi', 'kunye'];
const ANAHTAR = 'kapbeni_cookie_consent';
const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); };
const hash = (page) => new URL(page.url()).hash || '#/';
const warte = (page, ms = 700) => page.waitForTimeout(ms);
const ueberlauf = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const onay = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }, ANAHTAR);
const banner = (page) => page.locator('[data-cerez-banner]');
const dialog = (page) => page.getByRole('dialog', { name: 'Çerez Tercihleriniz' });
async function inhaltGeladen(page) {
  await page.waitForSelector('.hukuk-metin h1', { timeout: 8000 }).catch(() => {});
}

const SZENARIEN = {
  // Alle 15 Routen: Inhalt, keine rohe Klammer, kein {{token}}, Taslak-Hinweis, kein Überlauf
  async routen(page, b) {
    let erst = true;
    for (const s of SLUGS) {
      if (erst) { await page.goto(`${BASIS}/#/${s}`); erst = false; }
      else await page.evaluate((h) => { window.location.hash = h }, `#/${s}`);
      await inhaltGeladen(page); await warte(page, 250);
      const h1 = (await page.locator('.hukuk-metin h1').first().textContent().catch(() => '')) || '';
      const text = await page.evaluate(() => document.body.innerText);
      const ue = await ueberlauf(page);
      pruefe(h1.length > 3 && hash(page) === `#/${s}`, `${b}: #/${s} lädt („${h1.slice(0, 40)}“)`);
      pruefe(!text.includes('[') && !text.includes('{{'), `${b}: #/${s} ohne rohe Klammer/Token${text.includes('[') ? ' → ' + text.slice(text.indexOf('[') - 30, text.indexOf('[') + 40) : ''}`);
      pruefe(/Taslak – hukuki inceleme bekleniyor/.test(text), `${b}: #/${s} Taslak-Hinweis`);
      pruefe(ue <= 0, `${b}: #/${s} kein waagerechter Überlauf (${ue})`);
    }
    // Künye: Firmendaten aus SIRKET, leere Felder dezent, ETBİS-Platzhalter, kein fremder QR
    await page.evaluate(() => { window.location.hash = '#/kunye' }); await inhaltGeladen(page); await warte(page, 300);
    const k = await page.locator('.hukuk-metin').innerText();
    pruefe(/Compendus Bilişim/.test(k) && /Mezitli \/ Mersin/.test(k), `${b}: Künye zeigt Unvan und Adresse`);
    pruefe(/\(eklenecek\)/.test(k), `${b}: Künye zeigt leere Felder als „(eklenecek)“`);
    pruefe(/ETBİS kaydı yapılmaktadır/.test(k), `${b}: Künye ETBİS-Platzhalter`);
    pruefe(await page.locator('img[src*="qr" i]').count() === 0, `${b}: kein QR-Bild auf der Seite`);
    const f = await page.locator('footer').innerText();
    pruefe(/ETBİS kaydı yapılıyor/.test(f) && !/ETBİS'e Kayıtlıdır/.test(f), `${b}: Footer ETBİS-Platzhalter statt „Kayıtlıdır“`);
    // Alias → kanonische Route
    await page.evaluate(() => { window.location.hash = '#/mesafeli-satis-sozlesmesi' }); await warte(page, 1200);
    pruefe(hash(page) === '#/mesafeli-satis', `${b}: Alias #/mesafeli-satis-sozlesmesi → ${hash(page)}`);
  },
  // Inhaltsverzeichnis: Klick scrollt, Adresse #/kvkk?b=…, Reload springt wieder hin
  async toc(page, b) {
    await page.goto(`${BASIS}/#/kvkk`); await inhaltGeladen(page); await warte(page, 400);
    const vorher = await page.evaluate(() => history.length);
    await page.locator('.hukuk-icindekiler a[href="#haklar"]').click(); await warte(page, 1200);
    const top = await page.evaluate(() => document.getElementById('haklar').getBoundingClientRect().top);
    const y = await page.evaluate(() => window.scrollY);
    pruefe(y > 800 && top > -5 && top < 200, `${b}: TOC-Klick scrollt zu „haklar“ (y=${Math.round(y)}, top=${Math.round(top)})`);
    pruefe(hash(page) === '#/kvkk?b=haklar', `${b}: Adresse ${hash(page)}`);
    pruefe(await page.locator('.hukuk-metin h1').count() === 1, `${b}: Seite bleibt (kein Routenwechsel)`);
    pruefe(await page.evaluate(() => history.length) === vorher, `${b}: kein zusätzlicher History-Eintrag`);
    await page.reload(); await inhaltGeladen(page); await warte(page, 1000);
    const y2 = await page.evaluate(() => window.scrollY);
    pruefe(hash(page) === '#/kvkk?b=haklar' && y2 > 800, `${b}: Direktlink ?b=haklar springt zum Abschnitt (y=${Math.round(y2)})`);
  },
  // Browser-Zurück und „Geri Dön“
  async zurueck(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    await page.locator('footer a[href="/#/kvkk"]').first().click(); await inhaltGeladen(page); await warte(page, 500);
    pruefe(hash(page) === '#/kvkk', `${b}: Footer → KVKK`);
    // Link auf einen anderen Rechtstext (İlgili Metinler)
    await page.locator('.hukuk-metin a[href="/#/kunye"]').last().click(); await inhaltGeladen(page); await warte(page, 600);
    pruefe(hash(page) === '#/kunye' && await page.evaluate(() => window.scrollY) < 50, `${b}: KVKK → Künye, oben`);
    await page.goBack(); await warte(page, 900);
    pruefe(hash(page) === '#/kvkk', `${b}: Zurück → KVKK`);
    await page.goBack(); await warte(page, 900);
    pruefe(hash(page) === '#/' && await page.locator('.hukuk-metin').count() === 0, `${b}: Zurück → Startseite`);
    // Direkteinstieg → Geri Dön → Startseite, ohne neuen Eintrag zur Rechtsseite
    await page.goto('about:blank'); await page.goto(`${BASIS}/#/uyelik-sozlesmesi`); await inhaltGeladen(page);
    await page.getByRole('button', { name: /Geri Dön/ }).first().click(); await warte(page, 1200);
    pruefe(hash(page) === '#/', `${b}: Direkteinstieg → Geri Dön → Startseite`);
    await page.goBack(); await warte(page, 900);
    pruefe(hash(page) !== '#/uyelik-sozlesmesi', `${b}: Zurück danach führt nicht wieder auf die Rechtsseite (${page.url()})`);
  },
  // Cookie-Banner (eigener Kontext ohne gespeicherte Entscheidung)
  async banner(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    pruefe(await banner(page).isVisible(), `${b}: Banner erscheint beim ersten Besuch`);
    const rb = await page.getByRole('button', { name: 'Reddet', exact: true }).boundingBox();
    const kb = await page.getByRole('button', { name: 'Tümünü kabul et', exact: true }).boundingBox();
    pruefe(rb && kb && Math.abs(rb.width - kb.width) < 2 && Math.abs(rb.height - kb.height) < 2, `${b}: Reddet und Kabul gleich groß`);
    pruefe(await ueberlauf(page) <= 0, `${b}: kein Überlauf mit Banner`);
    if (page.viewportSize().width < 768) {
      const bb = await banner(page).boundingBox();
      const nav = await page.locator('div.md\\:hidden.fixed.bottom-0').first().boundingBox();
      pruefe(bb && nav && bb.y + bb.height <= nav.y + 1, `${b}: Banner verdeckt die BottomNav nicht (${Math.round(bb.y + bb.height)} ≤ ${Math.round(nav.y)})`);
      pruefe(bb && bb.height < 844 * 0.5, `${b}: Banner höchstens halbe Bildschirmhöhe (${Math.round(bb.height)} px)`);
    }
    await page.screenshot({ path: `${AUS}/recht-banner-offen-${b.split('/')[1]}.png` });
    await page.getByRole('button', { name: 'Reddet', exact: true }).click(); await warte(page, 500);
    let o = await onay(page);
    pruefe(o && o.v === '1.0' && o.zorunlu === true && o.analitik === false && o.pazarlama === false && !!Date.parse(o.zaman), `${b}: Reddet speichert ${JSON.stringify(o)}`);
    pruefe(!(await banner(page).isVisible().catch(() => false)), `${b}: Banner nach Reddet weg`);
    await page.reload(); await warte(page, 1500);
    pruefe(await banner(page).count() === 0, `${b}: nach Reload kein Banner`);
    // Über den Footer wieder öffnen, Analiz einschalten, speichern
    await page.locator('footer').getByRole('button', { name: 'Çerez Tercihleri' }).click(); await warte(page, 500);
    pruefe(await dialog(page).isVisible(), `${b}: Footer „Çerez Tercihleri“ öffnet die Tercihler`);
    await page.screenshot({ path: `${AUS}/recht-banner-tercih-${b.split('/')[1]}.png` });
    await dialog(page).getByRole('switch', { name: 'Analiz çerezleri' }).click();
    await dialog(page).getByRole('button', { name: 'Tercihleri kaydet' }).click(); await warte(page, 800);
    o = await onay(page);
    pruefe(o && o.analitik === true && o.pazarlama === false, `${b}: Tercihler speichern analitik=true, pazarlama=false`);
    pruefe(await dialog(page).count() === 0, `${b}: Fenster nach Speichern zu`);
    // Browser-Zurück schließt das Tercihler-Fenster
    const h0 = hash(page);
    await page.locator('footer').getByRole('button', { name: 'Çerez Tercihleri' }).click(); await warte(page, 500);
    await page.goBack(); await warte(page, 800);
    pruefe(await dialog(page).count() === 0 && hash(page) === h0, `${b}: Zurück schließt Tercihler, Seite bleibt (${hash(page)})`);
    // Tümünü kabul in neuem Zustand
    await page.evaluate((k) => localStorage.removeItem(k), ANAHTAR); await page.reload(); await warte(page, 1500);
    pruefe(await banner(page).isVisible(), `${b}: ohne Entscheidung wieder Banner`);
    await page.getByRole('button', { name: 'Tümünü kabul et', exact: true }).click(); await warte(page, 500);
    o = await onay(page);
    pruefe(o && o.analitik === true && o.pazarlama === true, `${b}: Tümünü kabul speichert beide`);
    // Versionswechsel → neu fragen
    await page.evaluate((k) => { const o = JSON.parse(localStorage.getItem(k)); o.v = '0.9'; localStorage.setItem(k, JSON.stringify(o)) }, ANAHTAR);
    await page.reload(); await warte(page, 1500);
    pruefe(await banner(page).isVisible(), `${b}: alte Textversion → Banner fragt neu`);
    // Banner auch auf einer Rechtsseite, Rechtsseite bleibt bedienbar
    await page.evaluate(() => { window.location.hash = '#/cerez-politikasi' }); await inhaltGeladen(page); await warte(page, 400);
    const t = await page.locator('.hukuk-metin').innerText();
    pruefe(/kapbeni_cookie_consent/.test(t) && /Reddet/.test(t), `${b}: Çerez Politikası nennt Consent-Key und „Reddet“`);
    pruefe(await banner(page).isVisible(), `${b}: Banner auch auf Rechtsseite`);
  },
  // Registrierung: Links zeigen auf die neuen Routen und öffnen in neuem Tab
  async kayit(page, b) {
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    await page.locator('button[title="Sat"]:visible').or(page.getByRole('button', { name: 'Sat', exact: true })).first().click();
    await warte(page, 600);
    await page.getByRole('button', { name: 'Kayıt Ol', exact: true }).first().click().catch(() => {});
    await warte(page, 600);
    for (const s of ['uyelik-sozlesmesi', 'kullanim-kosullari', 'kvkk', 'acik-riza']) {
      const a = page.locator(`a[href="/#/${s}"][target="_blank"]:visible`);
      pruefe(await a.count() >= 1, `${b}: Registrierung verlinkt #/${s} (neuer Tab)`);
    }
    const [tab] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null),
      page.locator('a[href="/#/kvkk"][target="_blank"]:visible').first().click(),
    ]);
    if (tab) { await tab.waitForSelector('.hukuk-metin h1', { timeout: 8000 }).catch(() => {}); }
    pruefe(!!tab && /#\/kvkk$/.test(tab.url()) && await tab.locator('.hukuk-metin h1').count() === 1, `${b}: KVKK öffnet im neuen Tab`);
    pruefe(await page.locator('a[href="/#/kvkk"][target="_blank"]:visible').count() >= 1 && await page.locator('.hukuk-metin').count() === 0 && hash(page) === '#/', `${b}: Fenster im Ursprungstab bleibt, keine Rechtsseite darunter`);
    if (tab) await tab.close();
  },
};

(async () => {
  const wahl = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SZENARIEN);
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    for (const name of wahl) for (const br of BREITEN) {
      const ctx = await browser.newContext({ viewport: { width: br.width, height: br.height }, locale: 'tr-TR' });
      // Außer im Banner-Szenario gilt eine Entscheidung als getroffen (Banner stört dort nicht)
      if (name !== 'banner') {
        await ctx.addInitScript((k) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ v: '1.0', zorunlu: true, analitik: false, pazarlama: false, zaman: new Date().toISOString() })) } catch {} }, ANAHTAR);
      }
      const page = await ctx.newPage();
      const konsole = [];
      page.on('pageerror', (e) => konsole.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
      try { await SZENARIEN[name](page, `${name}/${br.name}`); }
      catch (e) { pruefe(false, `${name}/${br.name}: Abbruch ${e.message.split('\n')[0]}`); }
      await page.screenshot({ path: `${AUS}/recht-${name}-${br.name}.png`, fullPage: false }).catch(() => {});
      pruefe(konsole.length === 0, `${name}/${br.name}: keine Konsolenfehler ${konsole.slice(0, 3).join(' | ')}`);
      await ctx.close();
      await new Promise((r) => setTimeout(r, 4000));
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${fehler.length ? 'FEHLER: ' + fehler.length : 'ALLE OK'}`);
  process.exit(fehler.length ? 1 : 0);
})();
