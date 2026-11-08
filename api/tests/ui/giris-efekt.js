// ════════════════════════════════════════════════════════════════════════════
//  Login-Effekte nach Santral (v1.36) im Browser, 1280 px und 390 px.
//    UI_BASIS=http://127.0.0.1:3905 ADMIN_BASIS=http://127.0.0.1:3912/admin \
//      node /opt/kapbeni/api/tests/ui/giris-efekt.js
//  Kunden-Login (AuthModal) ohne Anmeldung, schreibt nichts. Admin-Login nur mit dem
//  Test-Admin (admin_users.id=3, test_verisi) — vorher aktiv setzen, danach wieder aus.
//  Das Passwort kommt aus /root/kp-admin-test.pw und wird nie ausgegeben.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');

const BASIS = process.env.UI_BASIS || 'http://127.0.0.1:3003';
const ADMIN = process.env.ADMIN_BASIS || 'http://127.0.0.1:3002/admin';
const AUS = '/tmp/kp-ui';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));
const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); return !!bed; };
const groesse = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: r.x, y: r.y }; }, sel);
const COOKIE = { v: '1.0', zorunlu: true, analitik: false, pazarlama: false, zaman: new Date().toISOString() };

// Wert setzen wie eine Erweiterung: nativer Setter (React merkt es), dann input + change; kein Fokus, keine Maus
const SKRIPT_FUELLEN = (sel) => {
  const f = document.querySelector(sel);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(f, 'fill@test.kapbeni.com');
  f.dispatchEvent(new Event('input', { bubbles: true }));
  f.dispatchEvent(new Event('change', { bubbles: true }));
};

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const seitenfehler = [];
  try {
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const w = vp.width, mobil = w < 768;
      // ── Admin-Login ──
      const ctx = await browser.newContext({ viewport: vp, locale: 'tr-TR', hasTouch: mobil });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => seitenfehler.push(`admin ${w}: ${e.message}`));
      await page.goto(ADMIN + '#/giris', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
      await page.mouse.move(2, vp.height - 2);
      let g = await groesse(page, '#login-card');
      pruefe(g && g.w === 170 && g.h === 170, `admin ${w}: Karte startet klein 170×170 (${g && g.w + '×' + g.h})`);
      pruefe(await page.locator('#login-card.intro .kp-raute img').count() === 1, `admin ${w}: Raute mit Icon`);
      pruefe(await page.locator('.giris-sag > .streaks > .streak').count() === 9, `admin ${w}: 9 Lichtstreifen`);
      const farbe = await page.locator('.streak').first().evaluate((e) => getComputedStyle(e).backgroundImage);
      pruefe(/229, 57, 53/.test(farbe), `admin ${w}: Streifen in Kap-Beni-Rot`);
      pruefe(await page.evaluate(() => document.activeElement?.id !== 'login-email'), `admin ${w}: kein Autofokus im Ruhezustand`);
      await page.screenshot({ path: `${AUS}/giris-admin-zu-${w}.png` });
      if (mobil) await page.locator('#login-card').tap(); else await page.locator('#login-card').hover();
      await page.waitForTimeout(1100);
      g = await groesse(page, '#login-card');
      pruefe(g && g.w > 300 && g.h > 300, `admin ${w}: Berührung klappt auf (${g && g.w + '×' + g.h})`);
      const radius = await page.locator('#login-card').evaluate((e) => getComputedStyle(e).borderRadius);
      pruefe(radius === '20px', `admin ${w}: runde Ecken 20 px (${radius})`);
      const fb = await groesse(page, '#login-email'), gb = await groesse(page, '#google-btn');
      pruefe(fb && gb && Math.abs(fb.w - gb.w) <= 1, `admin ${w}: Google-Knopf so breit wie die Felder (${gb && gb.w} / ${fb && fb.w})`);
      await page.screenshot({ path: `${AUS}/giris-admin-auf-${w}.png` });
      if (!mobil) {
        await page.mouse.move(5, 5); await page.waitForTimeout(1500);
        g = await groesse(page, '#login-card');
        pruefe(g && g.w === 170, `admin ${w}: Verlassen klappt wieder zu (${g && g.w})`);
        await page.locator('#login-card').hover(); await page.waitForTimeout(900);
        await page.locator('#login-email').click(); await page.mouse.move(5, 5); await page.waitForTimeout(1500);
        g = await groesse(page, '#login-card');
        pruefe(g && g.w > 300, `admin ${w}: bleibt offen, solange ein Feld den Fokus hat`);
      }
      // Fehler: bleibt offen und schüttelt
      await page.locator('#login-email').fill('yok@test.kapbeni.com');
      await page.locator('#login-pw').fill('falsch-falsch');
      await page.evaluate(() => { window.__shake = false; const c = document.getElementById('login-card'); new MutationObserver(() => { if (c.classList.contains('shake')) window.__shake = true; }).observe(c, { attributes: true }); });
      await page.locator('#login-btn').click(); await page.waitForTimeout(1200);
      pruefe(await page.evaluate(() => window.__shake), `admin ${w}: falsches Passwort schüttelt die Karte`);
      await page.evaluate(() => document.activeElement?.blur()); await page.mouse.move(5, 5); await page.waitForTimeout(1500);
      g = await groesse(page, '#login-card');
      pruefe(g && g.w > 300, `admin ${w}: bleibt offen, solange die Fehlermeldung steht`);
      pruefe(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, `admin ${w}: kein waagerechter Überlauf`);
      // Fehler per ?hata= → startet aufgeklappt
      await page.goto(ADMIN + '#/giris?hata=google', { waitUntil: 'domcontentloaded' }); await page.reload({ waitUntil: 'domcontentloaded' });
      await page.mouse.move(2, vp.height - 2); await page.waitForTimeout(1600);
      g = await groesse(page, '#login-card');
      pruefe(g && g.w > 300, `admin ${w}: mit Fehler im Link startet die Karte offen`);
      // Skript-Füllen wie „Santral Fill“: eingeklappt bleiben die Felder im DOM, input klappt auf
      await page.goto(ADMIN + '#/giris', { waitUntil: 'domcontentloaded' }); await page.reload({ waitUntil: 'domcontentloaded' });
      await page.mouse.move(2, vp.height - 2); await page.waitForTimeout(1500);
      g = await groesse(page, '#login-card');
      const imDom = await page.evaluate(() => { const f = document.getElementById('login-email'); return !!f && getComputedStyle(f).display !== 'none' && f.offsetParent !== null; });
      pruefe(g && g.w === 170 && imDom, `admin ${w}: eingeklappt bleiben die Felder im DOM (${g && g.w}, ${imDom})`);
      await page.evaluate(SKRIPT_FUELLEN, '#login-email');
      await page.waitForTimeout(1100);
      g = await groesse(page, '#login-card');
      pruefe(g && g.w > 300 && await page.evaluate(() => !document.getElementById('login-card').contains(document.activeElement)), `admin ${w}: Skript-Füllen ohne Fokus klappt auf (${g && g.w})`);
      // Şifremi unuttum: Glaskarte ohne Einklappen
      await page.goto(ADMIN + '#/sifremi-unuttum', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
      g = await groesse(page, '#login-card');
      pruefe(g && g.w > 300 && await page.locator('#login-card.kp-glas').count() === 1, `admin ${w}: Şifremi unuttum als offene Glaskarte`);
      // Sperrbildschirm (nur Desktop-Lauf, Test-Admin)
      if (!mobil && fs.existsSync('/root/kp-admin-test.pw')) {
        const pw = fs.readFileSync('/root/kp-admin-test.pw', 'utf8').trim();
        await page.goto(ADMIN + '#/giris', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
        await page.locator('#login-card').hover(); await page.waitForTimeout(900);
        await page.locator('#login-email').fill('ui-test-admin@test.kapbeni.com');
        await page.locator('#login-pw').fill(pw);
        await page.locator('#login-btn').click(); await page.waitForTimeout(2500);
        if (pruefe(await page.locator('#view').count() === 1, 'admin: Test-Admin angemeldet')) {
          await page.evaluate(() => kilitle('manuel')); await page.waitForTimeout(1200);
          pruefe(await page.locator('#kilit > .streaks > .streak').count() === 11, 'admin: 11 Lichtstreifen hinter dem Sperrbildschirm');
          pruefe(await page.locator('#kilit-karte.kp-glas').count() === 1, 'admin: Sperrkarte als Glaskarte');
          await page.screenshot({ path: `${AUS}/giris-admin-kilit-${w}.png` });
          await page.evaluate(() => { window.__shake = false; const c = document.getElementById('kilit-karte'); new MutationObserver(() => { if (c.classList.contains('shake')) window.__shake = true; }).observe(c, { attributes: true }); });
          await page.locator('#kilit-pw').fill('falsch-falsch'); await page.locator('#kilit-btn').click(); await page.waitForTimeout(1200);
          pruefe(await page.evaluate(() => window.__shake), 'admin: falsches Sperr-Passwort schüttelt die Karte');
          await page.locator('#kilit-pw').fill(pw); await page.locator('#kilit-btn').click(); await page.waitForTimeout(1500);
          pruefe(await page.locator('#kilit').count() === 0, 'admin: Entsperren funktioniert weiter');
          await page.evaluate(() => logout()); await page.waitForTimeout(800);
        }
      }
      await ctx.close();

      // ── Kunden-Login (AuthModal) ──
      const k = await browser.newContext({ viewport: vp, locale: 'tr-TR', hasTouch: mobil, isMobile: mobil });
      await k.addInitScript((c) => { try { localStorage.setItem('kapbeni_cookie_consent', JSON.stringify(c)); } catch {} }, COOKIE);
      const s = await k.newPage();
      s.on('pageerror', (e) => seitenfehler.push(`site ${w}: ${e.message}`));
      await s.goto(BASIS + '/#/', { waitUntil: 'domcontentloaded' }); await s.waitForTimeout(2500);
      // Desktop: „Giriş“ in der Navbar; Handy: erst ohne, sonst über das Menü
      let giris = s.locator('button:visible', { hasText: /Giriş/ });
      if (!(await giris.count())) { await s.locator('button[title="Menü"]').click(); await s.waitForTimeout(400); giris = s.locator('button:visible', { hasText: /^Profil$/ }); }
      await giris.first().click();
      await s.waitForTimeout(1200);
      await s.mouse.move(2, vp.height - 2); await s.waitForTimeout(300);
      const karte = '[data-testid="giris-karte"]';
      pruefe(await s.locator(`${karte}.kp-glas`).count() === 1, `site ${w}: Login als Glaskarte`);
      pruefe(await s.locator('.kp-streifen > .kp-streif').count() === 9, `site ${w}: 9 Lichtstreifen auf dem Hintergrund`);
      g = await groesse(s, karte);
      if (!mobil) {
        pruefe(g && g.w === 170 && g.h === 170, `site ${w}: Karte startet klein (${g && g.w + '×' + g.h})`);
        await s.screenshot({ path: `${AUS}/giris-site-zu-${w}.png` });
        await s.locator(karte).hover(); await s.waitForTimeout(1100);
        g = await groesse(s, karte);
        pruefe(g && g.w >= 440 && g.h > 300, `site ${w}: Berührung klappt auf (${g && g.w + '×' + g.h})`);
        await s.mouse.move(5, 5); await s.waitForTimeout(2000);
        g = await groesse(s, karte);
        pruefe(g && g.w <= 172, `site ${w}: Verlassen klappt wieder zu (${g && g.w})`);
        await s.locator(karte).hover(); await s.waitForTimeout(1100);
      } else {
        pruefe(g && g.w === 170 && g.h === 170, `site ${w}: am Handy startet die Karte klein (${g && g.w + '×' + g.h})`);
        const unten = await s.evaluate((sel) => window.innerHeight - document.querySelector(sel).getBoundingClientRect().bottom, karte);
        pruefe(unten >= 24, `site ${w}: Kachel sitzt über dem unteren Rand (${Math.round(unten)} px)`);
        await s.screenshot({ path: `${AUS}/giris-site-zu-${w}.png` });
        await s.locator(karte).tap(); await s.waitForTimeout(1200);
        g = await groesse(s, karte);
        const unten2 = await s.evaluate((sel) => window.innerHeight - document.querySelector(sel).getBoundingClientRect().bottom, karte);
        pruefe(g && g.w === w && g.h > 300 && unten2 <= 1, `site ${w}: Tippen öffnet das Bottom-Sheet (${g && g.w + '×' + g.h}, unten ${Math.round(unten2)})`);
        await s.waitForTimeout(800);
        pruefe(g && (await groesse(s, karte)).w === w, `site ${w}: bleibt nach dem Tippen offen`);
      }
      const radiusS = await s.locator(karte).evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
      pruefe(radiusS === "20px", `site ${w}: runde Ecken 20 px (${radiusS})`);
      const fbS = await groesse(s, `${karte} input[type="email"]`);
      const gbS = await s.locator(`${karte} button`, { hasText: 'Google ile Giriş Yap' }).boundingBox();
      pruefe(fbS && gbS && Math.abs(fbS.w - Math.round(gbS.width)) <= 1, `site ${w}: Google-Knopf so breit wie die Felder (${gbS && Math.round(gbS.width)} / ${fbS && fbS.w})`);
      await s.screenshot({ path: `${AUS}/giris-site-auf-${w}.png` });
      // Fehler: leere Felder → Meldung (Server), Karte schüttelt und bleibt offen
      await s.evaluate((sel) => { window.__shake = false; const c = document.querySelector(sel); new MutationObserver(() => { if (c.classList.contains('shake')) window.__shake = true; }).observe(c, { attributes: true }); }, karte);
      await s.locator(`${karte} input[type="email"]`).fill('yok@test.kapbeni.com');
      await s.locator(`${karte} input[placeholder="Şifreniz"]`).fill('falsch-falsch');
      await s.locator(`${karte} button[type="submit"]`).click(); await s.waitForTimeout(1500);
      pruefe(await s.evaluate(() => window.__shake), `site ${w}: falsches Passwort schüttelt die Karte`);
      if (!mobil) {
        await s.evaluate(() => document.activeElement?.blur()); await s.mouse.move(5, 5); await s.waitForTimeout(1500);
        g = await groesse(s, karte);
        pruefe(g && g.w > 300, `site ${w}: bleibt offen, solange die Fehlermeldung steht`);
      }
      pruefe(await s.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, `site ${w}: kein waagerechter Überlauf`);
      // Registrierung: Glaskarte + Streifen, nicht eingeklappt
      await s.locator(`${karte} button`, { hasText: 'Kayıt Ol' }).click(); await s.waitForTimeout(800);
      pruefe(await s.locator('.kp-glas').count() === 1 && await s.locator('.kp-streifen > .kp-streif').count() === 9, `site ${w}: Registrierung mit Glaskarte und Streifen`);
      g = await groesse(s, '.kp-glas');
      pruefe(g && g.w > 300, `site ${w}: Registrierung startet offen`);
      await s.keyboard.press('Escape'); await s.waitForTimeout(600);
      pruefe(await s.locator('.kp-streifen').count() === 0, `site ${w}: Schließen räumt die Streifen ab`);
      // Skript-Füllen wie „Santral Fill“ (neu laden, sonst merkt sich das Modal den Reiter „Kayıt Ol“)
      await s.reload({ waitUntil: 'domcontentloaded' }); await s.waitForTimeout(2500);
      giris =s.locator('button:visible', { hasText: /Giriş/ });
      if (!(await giris.count())) { await s.locator('button[title="Menü"]').click(); await s.waitForTimeout(400); giris = s.locator('button:visible', { hasText: /^Profil$/ }); }
      await giris.first().click(); await s.waitForTimeout(1200);
      await s.mouse.move(2, vp.height - 2); await s.waitForTimeout(300);
      g = await groesse(s, karte);
      pruefe(g && g.w === 170 && await s.locator(`${karte} input[type="email"]`).count() === 1, `site ${w}: eingeklappt bleiben die Felder im DOM (${g && g.w})`);
      await s.evaluate(SKRIPT_FUELLEN, `${karte} input[type="email"]`);
      await s.waitForTimeout(1100);
      g = await groesse(s, karte);
      pruefe(g && g.w > 300, `site ${w}: Skript-Füllen ohne Fokus klappt auf (${g && g.w})`);
      await k.close();
    }
    pruefe(seitenfehler.length === 0, 'keine Seitenfehler' + (seitenfehler.length ? ': ' + seitenfehler.join(' | ').slice(0, 400) : ''));
  } finally {
    await browser.close();
  }
  console.log(fehler.length ? `\n${fehler.length} FEHLER` : '\nALLES OK');
  process.exit(fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
