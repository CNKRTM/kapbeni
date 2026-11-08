// ════════════════════════════════════════════════════════════════════════════
//  Benachrichtigungs-Glocke im Browser (v1.35), 1280 px und 390 px.
//    UI_BASIS=http://127.0.0.1:3905 node /opt/kapbeni/api/tests/ui/bildirim.js
//  Konto: Elif Koç (Testkonto, test_verisi). Sitzung per kurzlebigem Token
//  (tokenFuer, 15 min) — kein Passwort im Spiel, nie users.id=1.
//  Legt zwei Meldungen direkt an und entfernt alles Angelegte wieder.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');
const { q, pool, tokenFuer } = require('../_hilfe');

const BASIS = process.env.UI_BASIS || 'http://127.0.0.1:3003';
const AUS = '/tmp/kp-ui';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));
const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); return !!bed; };

(async () => {
  fs.mkdirSync(AUS, { recursive: true });
  const uid = (await q("SELECT id FROM users WHERE email='elif.koc@test.kapbeni.com' AND test_verisi")).rows[0].id;
  const il = (await q(`SELECT uuid FROM ilanlar WHERE ilan_durum='aktif' AND user_id IN (SELECT id FROM users WHERE test_verisi AND id<>1) ORDER BY id LIMIT 1`)).rows[0];
  const maxB = (await q('SELECT coalesce(max(id),0)::int m FROM bildirimler')).rows[0].m;
  // vorhandene ungelesene Meldungen merken und für den Test als gelesen setzen (danach zurück)
  const offen = (await q('SELECT id FROM bildirimler WHERE user_id=$1 AND okundu=false', [uid])).rows.map((r) => r.id);
  await q('UPDATE bildirimler SET okundu=true WHERE id = ANY($1)', [offen]);
  const token = await tokenFuer(uid);
  const browser = await chromium.launch({ executablePath: CHROME });
  const konsole = [];
  try {
    for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await q('DELETE FROM bildirimler WHERE user_id=$1 AND id>$2', [uid, maxB]);
      await q(`INSERT INTO bildirimler(user_id,tip,baslik,icerik,link) VALUES
        ($1,'teklif_yeni','Yeni teklif: 1.200 TL','Ayşe, "Test" ilanınıza teklif verdi.','/#/panel/gelen-teklifler'),
        ($1,'ilan_onay','İlanınız yayında','"Test" incelendi ve yayına alındı.',$2)`, [uid, `/#/ilan/${il.uuid}`]);
      const ctx = await browser.newContext({ viewport: vp, locale: 'tr-TR' });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('sg_token', t)
          localStorage.setItem('kapbeni_cookie_consent', JSON.stringify({ v: '1.0', zorunlu: true, analitik: false, pazarlama: false, zaman: new Date().toISOString() }))
        } catch {}
      }, token);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => konsole.push(e.message));
      await page.goto(BASIS + '/#/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
      const w = vp.width, mobil = w < 768;
      const dialog = page.locator('div[role="dialog"][aria-label="Bildirimler"]');
      const glocke = page.locator('button[aria-label="Bildirimler"]:visible').first();
      const menue = page.locator('button[title="Menü"]');
      // Handy: Glocke steckt im Menü, am Menü-Knopf ein Punkt
      const menueAuf = async () => { if (mobil && !(await glocke.isVisible())) { await menue.click(); await page.waitForTimeout(300); } };
      const menueZu = async () => { if (mobil && (await glocke.isVisible())) { await menue.click(); await page.waitForTimeout(300); } };
      const zaehler = async () => {
        await menueAuf();
        const n = page.locator('[data-testid="bildirim-sayi"]:visible');
        const t = (await n.count()) ? ((await n.first().textContent()) || '').trim() : '';
        await menueZu();
        return t;
      };
      const oeffne = async () => { await menueAuf(); await glocke.click(); await page.waitForSelector('[data-testid="bildirim-satir"]', { timeout: 8000 }).catch(() => {}); };
      await page.waitForTimeout(1500);
      if (mobil) pruefe(await page.locator('[data-testid="bildirim-punkt"]').isVisible(), `${w}: Punkt am Menü-Knopf`);
      const zahl = await zaehler();
      pruefe(zahl === '2', `${w}: Zähler zeigt 2 (ist „${zahl}“)`);
      pruefe(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, `${w}: kein waagerechter Überlauf`);
      if (mobil) {
        const s = await page.locator('header input[placeholder="Ne arıyorsunuz?"]').boundingBox();
        pruefe(s && s.width >= 80, `${w}: Suchfeld so breit wie vor v1.35 (82 px) (${s && Math.round(s.width)} px)`);
      }
      await oeffne();
      const zeilen = page.locator('[data-testid="bildirim-satir"]');
      pruefe(await zeilen.count() >= 2, `${w}: Liste zeigt die Meldungen`);
      const box = await dialog.boundingBox();
      pruefe(box && box.x >= 0 && box.x + box.width <= w + 1, `${w}: Fenster passt in die Breite`);
      // Kopf des Fensters nicht verdeckt (Kategorieleiste/Header): oberstes Element an der Stelle gehört zum Fenster
      const frei = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"][aria-label="Bildirimler"]'); if (!d) return false;
        const r = d.getBoundingClientRect(); const el = document.elementFromPoint(r.left + 20, r.top + 12);
        return !!el && d.contains(el);
      });
      pruefe(frei, `${w}: Fensterkopf liegt obenauf`);
      await page.screenshot({ path: `${AUS}/bildirim-liste-${w}.png` });
      // Klick auf „İlanınız yayında“ → Detailseite, Zähler 1
      await zeilen.filter({ hasText: 'İlanınız yayında' }).first().click();
      await page.waitForTimeout(1200);
      pruefe(new URL(page.url()).hash === `#/ilan/${il.uuid}`, `${w}: Klick führt zum Inserat (${new URL(page.url()).hash})`);
      const zahl2 = await zaehler();
      pruefe(zahl2 === '1', `${w}: Zähler danach 1 (ist „${zahl2}“)`);
      // Escape schließt, „Tümünü okundu işaretle“ leert den Zähler
      await oeffne(); await page.waitForTimeout(300);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      pruefe(!(await dialog.isVisible()), `${w}: Escape schließt das Fenster`);
      pruefe(new URL(page.url()).hash === `#/ilan/${il.uuid}`, `${w}: Escape bleibt auf der Seite`);
      await oeffne(); await page.waitForTimeout(300);
      await page.locator('button', { hasText: 'Tümünü okundu işaretle' }).click();
      await page.waitForTimeout(600);
      pruefe(await page.locator('[data-testid="bildirim-sayi"]:visible').count() === 0, `${w}: nach „Tümünü okundu“ kein Zähler`);
      // Gelen teklifler-Link → Panel, Rolle Satıcı
      await zeilen.filter({ hasText: 'Yeni teklif' }).first().click();
      await page.waitForTimeout(1500);
      pruefe(new URL(page.url()).hash === '#/panel/gelen-teklifler', `${w}: Angebots-Link öffnet das Panel (${new URL(page.url()).hash})`);
      if (mobil) pruefe(!(await page.locator('[data-testid="bildirim-punkt"]').isVisible()), `${w}: kein Punkt mehr am Menü-Knopf`);
      pruefe(await page.locator('button', { hasText: 'Satıcıyım' }).evaluate((b) => getComputedStyle(b).backgroundColor === 'rgb(229, 57, 53)').catch(() => false), `${w}: Rolle „Satıcıyım“ aktiv`);
      await page.screenshot({ path: `${AUS}/bildirim-teklif-${w}.png` });
      await ctx.close();
    }
    pruefe(konsole.length === 0, 'keine Seitenfehler' + (konsole.length ? ': ' + konsole.join(' | ').slice(0, 300) : ''));
  } finally {
    await browser.close();
    await q('DELETE FROM bildirimler WHERE user_id=$1 AND id>$2', [uid, maxB]);
    await q('UPDATE bildirimler SET okundu=false WHERE id = ANY($1)', [offen]);
    await pool.end();
  }
  console.log(fehler.length ? `\n${fehler.length} FEHLER` : '\nALLES OK');
  process.exit(fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
