// ════════════════════════════════════════════════════════════════════════════
//  End-to-End-Test mit zwei Seed-Testkunden (Playwright, headless Chromium).
//    node /opt/kapbeni/api/tests/ui/e2e.js [schritt ...]
//  Schritte: giris ilan hizli moderasyon medya suche chat abwicklung admin seiten aufraeumen
//  Kunde A = Elif Koç (E2E-Konto, Verkäuferin), Kunde B = Ayşe Yılmaz (Käuferin).
//  Angemeldet wird über die echte Login-Maske; Passwörter kommen aus
//  /root/kp-e2e-testkunde.txt bzw. /root/kp-testkunden.txt (0600) und werden
//  nie ausgegeben. Geschrieben wird nur mit diesen beiden Testkonten
//  (test_verisi=true) — nie mit users.id=1. Admin nur als Test-Admin (id=3).
//  Zustand zwischen den Schritten: /tmp/kp-e2e-state.json,
//  Sitzungen: /tmp/kp-e2e-{A,B}.json, Fotos: /tmp/kp-ui/e2e-*.png
//  UI_BASIS (Standard :3003 = gleiches dist wie kapbeni.com) kann auf den
//  Testbuild (http://127.0.0.1:3905) zeigen.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/_pwtest/node_modules/playwright-core');
const { q, pool } = require('../_hilfe');

const BASIS = process.env.UI_BASIS || 'http://127.0.0.1:3003';
const ADMIN = process.env.ADMIN_BASIS || 'http://127.0.0.1:3002/admin';
const AUS = '/tmp/kp-ui';
const ZUSTAND = '/tmp/kp-e2e-state.json';
const MEDIEN = '/tmp/kp-e2e-media';
const CHROME = fs.readdirSync('/root/.cache/ms-playwright').filter((d) => d.startsWith('chromium_headless_shell'))
  .map((d) => path.join('/root/.cache/ms-playwright', d, 'chrome-linux', 'headless_shell')).find((p) => fs.existsSync(p));
const MOBIL = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const KUNDE = { A: 'elif.koc@test.kapbeni.com', B: 'ayse.yilmaz@test.kapbeni.com' };

const fehler = [];
const pruefe = (bed, text) => { if (!bed) fehler.push(text); console.log(`${bed ? 'OK  ' : 'FEHL'} ${text}`); return !!bed; };
const notiz = (text) => console.log(`INFO ${text}`);
const warte = (p, ms) => p.waitForTimeout(ms);
const st = fs.existsSync(ZUSTAND) ? JSON.parse(fs.readFileSync(ZUSTAND, 'utf8')) : {};
const merke = () => fs.writeFileSync(ZUSTAND, JSON.stringify(st, null, 2));
const hash = (p) => new URL(p.url()).hash;

/** Passwort eines Testkunden aus der 0600-Datei (Format: E-Mail TAB Passwort). */
function passwort(mail) {
  for (const datei of ['/root/kp-e2e-testkunde.txt', '/root/kp-testkunden.txt']) {
    const z = fs.readFileSync(datei, 'utf8').split('\n').find((l) => l.startsWith(mail + '\t'));
    if (z) return z.split('\t')[1].trim();
  }
  throw new Error('kein Passwort fuer ' + mail);
}

let browser;
const konsole = [];
async function seite(wer, viewport) {
  const opts = { viewport, locale: 'tr-TR' };
  const sitz = `/tmp/kp-e2e-${wer}.json`;
  if (wer && fs.existsSync(sitz)) {
    // localStorage gilt je Origin: die Sitzung auch fuer den Testbuild (:3905) uebernehmen
    const s = JSON.parse(fs.readFileSync(sitz, 'utf8'));
    const o = new URL(BASIS).origin;
    if (s.origins.length && !s.origins.some((x) => x.origin === o)) s.origins.push({ ...s.origins[0], origin: o });
    opts.storageState = s;
  }
  const ctx = await browser.newContext(opts);
  // Cookie-Entscheidung vorbelegen (Banner wird im Schritt „seiten“ eigens geprueft)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('kapbeni_cookie_consent')) localStorage.setItem('kapbeni_cookie_consent', JSON.stringify({ v: '1.0', zorunlu: true, analitik: false, pazarlama: false, zaman: new Date().toISOString() })) } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => konsole.push(`${wer}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) konsole.push(`${wer} console: ${m.text().slice(0, 160)}`); });
  return { ctx, page };
}
const foto = (p, name) => p.screenshot({ path: `${AUS}/e2e-${name}-${p.viewportSize().width}.png` }).catch(() => {});
const ueberlauf = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const satKnopf = (p) => p.locator('button[title="Sat"]:visible').or(p.getByRole('button', { name: 'Sat', exact: true })).first();

/** Verkaufsmaske ausfuellen und absenden; liefert die POST-Antwort. */
async function maskeAusfuellen(page, d) {
  await page.locator('input[type=file][accept^="image"]').setInputFiles([`${MEDIEN}/foto1.jpg`, `${MEDIEN}/foto2.jpg`]);
  await page.locator('input[type=file][accept^="video"]').setInputFiles(`${MEDIEN}/video8s.mp4`);
  await warte(page, 600);
  await page.getByPlaceholder(/Tertemiz Çiziksiz/).fill(d.baslik);
  await page.locator('form select').first().selectOption(d.kat);
  await warte(page, 400);
  await page.locator('form select').nth(1).selectOption(d.alt);
  await warte(page, 1500);
  const marka = page.getByRole('combobox', { name: 'Marka' });
  if (await marka.count()) {
    await marka.click(); await marka.fill(d.marka); await warte(page, 300);
    const opt = page.getByRole('option', { name: d.marka, exact: true });
    if (await opt.count()) await opt.first().click(); else await page.keyboard.press('Tab');
  } else notiz('Marka-Feld fehlt fuer ' + d.alt);
  await page.getByPlaceholder('Örn: 45000').fill(String(d.fiyat));
  await page.getByRole('combobox', { name: 'Durum' }).first().selectOption(d.durum);
  const il = page.getByRole('combobox', { name: 'Şehir' }).first();
  await il.click(); await il.fill('İstanbul'); await warte(page, 300);
  await page.getByRole('option', { name: 'İstanbul', exact: true }).first().click();
  const ilce = page.getByRole('combobox', { name: 'İlçe' }).first();
  await ilce.click(); await warte(page, 800); await ilce.fill('Kadıköy'); await warte(page, 300);
  const io = page.getByRole('option', { name: 'Kadıköy', exact: true });
  if (await io.count()) await io.first().click(); else await page.keyboard.press('Tab');
  await page.getByPlaceholder(/Ürünün teknik özellikleri/).fill(d.aciklama);
  await foto(page, `${d.name}-maske`);
  const antwort = page.waitForResponse((r) => r.url().endsWith('/api/ilanlar') && r.request().method() === 'POST', { timeout: 60000 });
  await page.getByRole('button', { name: 'İlanı Yayınla' }).click();
  const r = await antwort;
  const body = await r.json().catch(() => ({}));
  await warte(page, 700);
  const toast = await page.getByText(/İlanınız|İlan verilemedi/).first().textContent().catch(() => '');
  return { status: r.status(), body, toast: (toast || '').trim() };
}

const SCHRITTE = {
  // 1a) Anmeldung beider Kunden über die echte Login-Maske, Sitzung wird gespeichert.
  async giris() {
    for (const [wer, vp] of [['A', DESKTOP], ['B', MOBIL]]) {
      const sitz = `/tmp/kp-e2e-${wer}.json`; if (fs.existsSync(sitz)) fs.unlinkSync(sitz);
      const { ctx, page } = await seite(null, vp);
      await page.goto(`${BASIS}/#/`); await warte(page, 1500);
      await satKnopf(page).click(); await warte(page, 700);
      await page.getByPlaceholder('E-posta adresiniz').first().fill(KUNDE[wer]);
      await page.getByPlaceholder('Şifreniz').fill(passwort(KUNDE[wer]));
      await page.waitForFunction(() => { const i = document.querySelector('input[name="cf-turnstile-response"]'); return !i || i.value; }, null, { timeout: 15000 }).catch(() => {});
      await page.getByRole('button', { name: 'Giriş Yap', exact: true }).last().click();
      await warte(page, 2500);
      const token = await page.evaluate(() => localStorage.getItem('sg_token'));
      pruefe(!!token, `giris: Kunde ${wer} über die Login-Maske angemeldet (${vp.width}px)`);
      await foto(page, `giris-${wer}`);
      await ctx.storageState({ path: sitz }); fs.chmodSync(sitz, 0o600);
      await ctx.close();
    }
  },
  // 1b) Normale Verkaufsmaske (1280 px): Fotos, Video 8 s, Kategorie, Marke, Zustand.
  async ilan() {
    const { ctx, page } = await seite('A', DESKTOP);
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    await satKnopf(page).click(); await warte(page, 900);
    pruefe(await page.getByText('Hemen İlan Verin').count() > 0, 'ilan: Verkaufsmaske offen');
    const r = await maskeAusfuellen(page, { name: 'ilan', baslik: 'Sony WH-1000XM4 Kablosuz Kulaklık, kutulu', kat: 'elektronik', alt: 'tv-goruntu-ses', marka: 'Sony', fiyat: 4250, durum: 'yeni_gibi',
      aciklama: 'Gürültü engelleme sorunsuz çalışıyor. Kutusu, kılıfı ve şarj kablosu mevcut. Elden teslim Kadıköy veya kargo.' });
    pruefe(r.status === 201, `ilan: POST /api/ilanlar → ${r.status}`);
    const ilan = r.body.ilan || {};
    st.ilan1 = { id: ilan.id, uuid: ilan.uuid, durum: ilan.ilan_durum, ai: r.body.ai_sonuc, toast: r.toast, mesaj: r.body.mesaj };
    notiz(`ilan: ilan_durum=${ilan.ilan_durum} ai=${JSON.stringify(r.body.ai_sonuc)} toast="${r.toast}" api-mesaj="${r.body.mesaj}"`);
    pruefe(!(ilan.ilan_durum === 'moderasyonda' && /yayınlandı/.test(r.toast)), `ilan: Meldung passt zum Ergebnis (toast „${r.toast}“, Status ${ilan.ilan_durum})`);
    merke();
    if (ilan.uuid) {
      await page.goto(`${BASIS}/#/ilan/${ilan.uuid}`); await page.reload(); await warte(page, 2000);
      const isl = await page.getByText(/Medya işleniyor/).count();
      notiz(`ilan: Detail direkt nach Anlage zeigt „Medya işleniyor…“: ${isl > 0}`);
      await foto(page, 'ilan-detail-frisch');
      // Auto-Refresh: wartet bis 60 s, ob „Medya işleniyor…“ ohne Reload verschwindet
      let weg = isl === 0;
      for (let i = 0; i < 30 && !weg; i++) { await warte(page, 2000); weg = await page.getByText(/Medya işleniyor/).count() === 0; }
      const db = (await q('SELECT video_durum FROM ilanlar WHERE uuid=$1', [ilan.uuid])).rows[0].video_durum;
      if (isl > 0) pruefe(weg, `ilan: Detailseite aktualisiert „Medya işleniyor…“ ohne Reload (DB ${db})`);
      else notiz('ilan: Video war schon fertig, bevor die Detailseite lud — Auto-Refresh im Schritt „medya“ geprüft');
      await foto(page, 'ilan-detail-video');
    }
    await ctx.close();
  },
  // 1c) „Hızlı İlan Ver – 3 adımda“ (390 px) → führt in dieselbe Maske.
  async hizli() {
    const { ctx, page } = await seite('A', MOBIL);
    await page.goto(`${BASIS}/#/panel/ilanlarim`); await page.reload(); await warte(page, 2000);
    const k = page.getByRole('button', { name: /Hızlı İlan Ver/ }).first();
    pruefe(await k.count() === 1, 'hizli: Knopf „Hızlı İlan Ver“ im Panel');
    await k.click(); await warte(page, 400);
    await page.getByRole('button', { name: 'İleri' }).click(); await page.getByRole('button', { name: 'İleri' }).click();
    await foto(page, 'hizli-adim3');
    await page.getByRole('button', { name: 'Şimdi ilan ver' }).click(); await warte(page, 900);
    pruefe(await page.getByText('Hemen İlan Verin').count() > 0, 'hizli: „Şimdi ilan ver“ öffnet die Verkaufsmaske');
    const r = await maskeAusfuellen(page, { name: 'hizli', baslik: 'Bisiklet kaskı Giro, M beden, az kullanılmış', kat: 'spor-outdoor', alt: 'bisiklet', marka: 'Giro', fiyat: 900, durum: 'az_kullanilmis',
      aciklama: 'İki sezon kullanıldı, darbe almadı. Ayar düğmesi ve iç pedler sağlam. Kadıköy elden teslim.' });
    pruefe(r.status === 201, `hizli: POST /api/ilanlar → ${r.status}`);
    const ilan = r.body.ilan || {};
    st.ilan2 = { id: ilan.id, uuid: ilan.uuid, durum: ilan.ilan_durum, ai: r.body.ai_sonuc, toast: r.toast, mesaj: r.body.mesaj };
    notiz(`hizli: ilan_durum=${ilan.ilan_durum} ai=${JSON.stringify(r.body.ai_sonuc)} toast="${r.toast}"`);
    pruefe(!(ilan.ilan_durum === 'moderasyonda' && /yayınlandı/.test(r.toast)), `hizli: Meldung passt zum Ergebnis (toast „${r.toast}“, Status ${ilan.ilan_durum})`);
    merke();
    pruefe(await ueberlauf(page) <= 0, 'hizli: kein waagerechter Überlauf (390 px)');
    await ctx.close();
  },
  // v1.33.2: Escape in einer offenen Combobox schließt nur die Liste, nicht die Verkaufsmaske.
  async escape() {
    for (const vp of [MOBIL, DESKTOP]) {
      const { ctx, page } = await seite('A', vp);
      await page.goto(`${BASIS}/#/`); await warte(page, 1500);
      await satKnopf(page).click(); await warte(page, 900);
      await page.getByPlaceholder(/Tertemiz Çiziksiz/).fill('Escape-Test');
      const il = page.getByRole('combobox', { name: 'Şehir' }).first();
      await il.click(); await il.fill('İst'); await warte(page, 300);
      const listeVorher = await page.getByRole('listbox').count();
      await page.keyboard.press('Escape'); await warte(page, 500);
      const maske = await page.getByText('Hemen İlan Verin').count() > 0;
      pruefe(listeVorher > 0 && maske && await page.getByRole('listbox').count() === 0, `escape/${vp.width}: 1. Escape schließt nur die Liste, Maske bleibt`);
      pruefe(await page.getByPlaceholder(/Tertemiz Çiziksiz/).inputValue() === 'Escape-Test', `escape/${vp.width}: Eingaben bleiben erhalten`);
      await page.keyboard.press('Escape'); await warte(page, 700);
      pruefe(await page.getByText('Hemen İlan Verin').count() === 0, `escape/${vp.width}: 2. Escape schließt die Maske`);
      await ctx.close();
    }
  },
  // v1.33.4: Landet das Inserat in İlan Onayı, sagt die Meldung das auch.
  async toast() {
    const { ctx, page } = await seite('A', MOBIL);
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    await satKnopf(page).click(); await warte(page, 900);
    const r = await maskeAusfuellen(page, { name: 'toast', baslik: 'PlayStation 5 sıfır kutusunda', kat: 'elektronik', alt: 'oyuncu', marka: 'Sony', fiyat: 4000, durum: 'sifir',
      aciklama: 'Sıfır kutusunda. Ayırtmak için önce 1.000 TL kaporayı IBAN hesabıma gönderin, kargoyu sonra yaparım. Sadece WhatsApp.' });
    const d = r.body.ilan && r.body.ilan.ilan_durum;
    st.ilan4 = { id: r.body.ilan && r.body.ilan.id, uuid: r.body.ilan && r.body.ilan.uuid, durum: d }; merke();
    notiz(`toast: Status ${d}, Meldung „${r.toast}“`);
    pruefe(d === 'moderasyonda' ? /incelemeye alındı/.test(r.toast) : /yayınlandı/.test(r.toast), `toast: Meldung passt zum Ergebnis (${d})`);
    await ctx.close();
  },
  // v1.33.5: „Medya işleniyor…“ verschwindet ohne Reload, sobald die Engine fertig ist.
  async medyayenile() {
    const { api, tokenFuer } = require('../_hilfe');
    const form = new FormData();
    form.append('baslik', 'Logitech G29 direksiyon seti pedallı');
    form.append('aciklama', 'Az kullanıldı, pedal seti ve masa bağlantısı dahil. Kadıköy elden teslim veya kargo.');
    form.append('fiyat', '6500'); form.append('durum', 'az_kullanilmis'); form.append('kategori_id', '89');
    form.append('sehir', 'İstanbul'); form.append('ilce', 'Kadıköy');
    form.append('fotograflar', new Blob([fs.readFileSync(`${MEDIEN}/foto2.jpg`)], { type: 'image/jpeg' }), 'foto2.jpg');
    form.append('video', new Blob([fs.readFileSync(`${MEDIEN}/video55s.mp4`)], { type: 'video/mp4' }), 'video55s.mp4');
    const r = await api('POST', '/ilanlar', { token: await tokenFuer(78), form });
    const il = (r.body && r.body.ilan) || {};
    st.ilan5 = { id: il.id, uuid: il.uuid, durum: il.ilan_durum }; merke();
    notiz(`medyayenile: Inserat ${r.status} ${il.ilan_durum}, video_durum ${il.video_durum}`);
    if (il.ilan_durum !== 'aktif') await q("UPDATE ilanlar SET ilan_durum='aktif' WHERE id=$1 AND user_id=78", [il.id]);
    const vorher = (await q('SELECT goruntulenme FROM ilanlar WHERE id=$1', [il.id])).rows[0].goruntulenme;
    const { ctx, page } = await seite('B', DESKTOP);
    await page.goto(`${BASIS}/#/ilan/${il.uuid}`); await page.reload(); await warte(page, 2500);
    // zweite Galerie-Station (Video bzw. „Medya işleniyor…“) anwählen
    await page.getByRole('button', { name: 'Fotoğraf 2', exact: true }).click(); await warte(page, 600);
    const anfang = await page.getByText(/Medya işleniyor/).count() > 0;
    await foto(page, 'medya-isleniyor');
    let weg = false; let s = 0;
    for (; s < 90 && !weg; s += 3) { await warte(page, 3000); weg = await page.getByText(/Medya işleniyor/).count() === 0 && await page.locator('video').count() > 0; }
    const db = (await q('SELECT video_durum, goruntulenme FROM ilanlar WHERE id=$1', [il.id])).rows[0];
    pruefe(anfang, 'medyayenile: Detail zeigt anfangs „Medya işleniyor…“');
    pruefe(weg && db.video_durum === 'tamam', `medyayenile: verschwindet ohne Reload nach ~${s} s (DB ${db.video_durum})`);
    await foto(page, 'medya-fertig');
    notiz(`medyayenile: Aufrufe ${vorher} → ${db.goruntulenme} (Nachfragen mit ?medya=1 zählen nach dem Ausrollen nicht)`);
    await ctx.close();
  },
  // Panel-Reiter beider Kunden: laden, kein Überlauf (Konsole wird global geprüft)
  async panel() {
    for (const [wer, vp] of [['A', MOBIL], ['B', DESKTOP]]) {
      const { ctx, page } = await seite(wer, vp);
      for (const tab of ['ilanlarim', 'tekliflerim', 'favorilerim', 'degerlendirmeler', 'aramalar']) {
        await page.goto(`${BASIS}/#/panel/${tab}`); await page.reload(); await warte(page, 1800);
        const txt = await page.locator('body').innerText();
        pruefe(txt.length > 200 && await ueberlauf(page) <= 0 && !/Bu bölüm yüklenemedi/.test(txt), `panel/${wer}/${vp.width}: ${tab} lädt, kein Überlauf`);
        if (tab === 'degerlendirmeler') {
          await foto(page, `panel-degerlendirme-${wer}`);
          const fremd = (await q("SELECT count(*)::int n FROM degerlendirmeler WHERE durum='onaylandi' AND degerlendirilen<>$1", [wer === 'A' ? 78 : 71])).rows[0].n;
          notiz(`panel: fremde freigegebene Bewertungen in der DB: ${fremd} (dürfen hier nicht erscheinen)`);
        }
      }
      await ctx.close();
    }
  },
  // 1d) Inserate in İlan Onayı → mit dem Test-Admin freigeben; danach Suchindex prüfen.
  async moderasyon() {
    // Drittes Inserat (über die API als A) mit Kapora/IBAN-Hinweis — soll in die Warteschlange.
    if (!st.ilan3) {
      const { api, tokenFuer } = require('../_hilfe');
      const form = new FormData();
      form.append('baslik', 'iPhone 15 Pro 256 GB sıfır kapalı kutu');
      form.append('aciklama', 'Sıfır kapalı kutu. Ayırtmak için önce 2.000 TL kaporayı IBAN hesabıma gönderin, sonra kargolarım. Sadece WhatsApp.');
      form.append('fiyat', '9500'); form.append('durum', 'sifir'); form.append('kategori_id', '2');
      form.append('sehir', 'İstanbul'); form.append('ilce', 'Kadıköy');
      form.append('fotograflar', new Blob([fs.readFileSync(`${MEDIEN}/foto1.jpg`)], { type: 'image/jpeg' }), 'foto1.jpg');
      const r = await api('POST', '/ilanlar', { token: await tokenFuer(78), form });
      const il = (r.body && r.body.ilan) || {};
      st.ilan3 = { id: il.id, uuid: il.uuid, durum: il.ilan_durum, ai: r.body && r.body.ai_sonuc };
      notiz(`moderasyon: drittes Inserat ${r.status} → ${il.ilan_durum} (KI ${JSON.stringify(r.body && r.body.ai_sonuc && { skor: r.body.ai_sonuc.skor, sebep: r.body.ai_sonuc.sebep })})`);
      pruefe(il.ilan_durum === 'moderasyonda', 'moderasyon: verdächtiges Inserat landet in İlan Onayı');
      merke();
    }
    const ids = [st.ilan1, st.ilan2, st.ilan3].filter(Boolean);
    const { ctx, page } = await seite(null, DESKTOP);
    await adminAnmelden(page);
    await page.goto(`${ADMIN}#/ilanonay`); await warte(page, 1500);
    await foto(page, 'admin-ilanonay');
    for (const il of ids) {
      const row = (await q('SELECT id, ilan_durum, user_id FROM ilanlar WHERE uuid=$1', [il.uuid])).rows[0];
      if (!row) { pruefe(false, `moderasyon: Inserat ${il.uuid} fehlt`); continue; }
      if (row.user_id !== 78) throw new Error('fremdes Inserat — Abbruch');
      if (row.ilan_durum === 'moderasyonda') {
        const karte = page.locator('.card').filter({ hasText: (await q('SELECT baslik FROM ilanlar WHERE id=$1', [row.id])).rows[0].baslik });
        pruefe(await karte.count() > 0, `moderasyon: Inserat ${row.id} steht in İlan Onayı`);
        await karte.getByRole('button', { name: /Onayla/ }).click(); await warte(page, 1500);
        const neu = (await q('SELECT ilan_durum FROM ilanlar WHERE id=$1', [row.id])).rows[0].ilan_durum;
        pruefe(neu === 'aktif', `moderasyon: Freigabe durch Test-Admin → ${neu}`);
        il.freigegeben = true;
      } else notiz(`moderasyon: Inserat ${row.id} ist ${row.ilan_durum} (keine Freigabe nötig)`);
      await warte(page, 1500);
      const meili = await meiliHat(il.uuid);
      pruefe(meili, `moderasyon: Inserat ${row.id} im Suchindex (Meili) nach ${il.freigegeben ? 'Freigabe' : 'Anlage'}`);
    }
    merke();
    await ctx.close();
  },
  // 1e) Video-Jobs der Medien-Engine
  async medya() {
    for (const il of [st.ilan1, st.ilan2].filter(Boolean)) {
      let r;
      for (let i = 0; i < 30; i++) {
        r = (await q('SELECT video_durum, video_url, video_poster_url FROM ilanlar WHERE uuid=$1', [il.uuid])).rows[0];
        if (r && r.video_durum !== 'isleniyor') break;
        await new Promise((x) => setTimeout(x, 2000));
      }
      const job = (await q("SELECT id, durum, boyut_once, boyut_sonra, sure_ms FROM medya_isleri WHERE ilan_uuid=$1 AND tip='video' ORDER BY id DESC LIMIT 1", [il.uuid]).catch(() => ({ rows: [] }))).rows[0];
      pruefe(r && r.video_durum === 'tamam' && r.video_url && r.video_poster_url, `medya: Video ${il.uuid.slice(0, 8)} → ${r && r.video_durum}, Poster ${!!(r && r.video_poster_url)}`);
      notiz(`medya: Job ${JSON.stringify(job || null)}`);
      il.video_job = job && job.id;
    }
    merke();
  },
  // 2) B findet das Inserat über Suche und Kategorie, Favorit, öffnet es und schreibt A.
  async suche() {
    const il = st.ilan1;
    // Suche (390 px)
    let { ctx, page } = await seite('B', MOBIL);
    await page.goto(`${BASIS}/#/`); await warte(page, 1500);
    const such = page.getByPlaceholder('Ne arıyorsunuz?').first();
    await such.fill('WH-1000XM4'); await such.press('Enter'); await warte(page, 2500);
    await foto(page, 'suche-ergebnis');
    const treffer = page.getByText('Sony WH-1000XM4 Kablosuz Kulaklık', { exact: false });
    pruefe(await treffer.count() > 0, `suche: Suche „WH-1000XM4“ findet das Inserat (${hash(page)})`);
    await ctx.close();
    // Kategorie (1280 px), Favorit, Detail, Mesaj Gönder
    ({ ctx, page } = await seite('B', DESKTOP));
    await page.goto(`${BASIS}/#/kategori/tv-goruntu-ses`); await page.reload(); await warte(page, 2500);
    await foto(page, 'kategori');
    const karte = page.getByText('Sony WH-1000XM4 Kablosuz Kulaklık').first();
    pruefe(await karte.count() > 0, 'suche: Kategorie „TV, Görüntü & Ses“ zeigt das Inserat');
    if (await karte.count()) { await karte.click(); await warte(page, 2000); }
    else { await page.goto(`${BASIS}/#/ilan/${il.uuid}`); await page.reload(); await warte(page, 2000); }
    pruefe(hash(page) === `#/ilan/${il.uuid}`, `suche: Detailseite geöffnet (${hash(page)})`);
    const fav = page.locator('button').filter({ has: page.locator('svg.lucide-heart') }).first();
    await fav.click(); await warte(page, 1200);
    const f = (await q('SELECT count(*)::int n FROM favoriler WHERE user_id=71 AND ilan_id=$1', [il.id])).rows[0].n;
    pruefe(f === 1, 'suche: Favorit gespeichert (favoriler)');
    await foto(page, 'detail-B');
    await page.getByText('Mesaj Gönder').first().click(); await warte(page, 2000);
    pruefe(/^#\/mesajlar\/\d+$/.test(hash(page)), `suche: Mesaj Gönder → ${hash(page)}`);
    st.konusma = Number(hash(page).split('/').pop()) || null; merke();
    await sende(page, 'Merhaba, kulaklık hâlâ satılık mı? Kadıköy\'de elden alabilirim.', 'suche: B schreibt A');
    await foto(page, 'chat-B-1');
    // Favoritenliste
    await page.goto(`${BASIS}/#/panel/favorilerim`); await page.reload(); await warte(page, 2000);
    pruefe(await page.getByText('Sony WH-1000XM4').count() > 0, 'suche: Favorit erscheint in „Favorilerim“');
    await ctx.close();
  },
  // 3) Chat A↔B, Pazarlık, Teklif (Annahme + Ablehnung), verdächtige Nachricht.
  async chat() {
    const il = st.ilan1;
    let { ctx, page } = await seite('A', DESKTOP);
    await page.goto(`${BASIS}/#/mesajlar/${st.konusma}`); await page.reload(); await warte(page, 2500);
    pruefe(await page.getByText(/hâlâ satılık mı/).count() > 0, 'chat: A sieht die Nachricht von B');
    await sende(page, 'Merhaba, evet satılık. Fiyatta biraz pazarlık payı var.', 'chat: A antwortet');
    await ctx.close();
    ({ ctx, page } = await seite('B', MOBIL));
    await page.goto(`${BASIS}/#/mesajlar/${st.konusma}`); await page.reload(); await warte(page, 2500);
    pruefe(await page.getByText(/pazarlık payı var/).count() > 0, 'chat: B sieht die Antwort');
    await sende(page, '3.800 TL olur mu? Bugün alabilirim.', 'chat: B Pazarlık im Chat');
    // Teklif 1 (wird abgelehnt) und Teklif 2 (wird angenommen) über „Teklif Yap“
    for (const [n, betrag] of [[1, 3500], [2, 3900]]) {
      await page.goto(`${BASIS}/#/ilan/${il.uuid}`); await page.reload(); await warte(page, 2000);
      await page.getByRole('button', { name: /Teklif Yap/ }).first().click(); await warte(page, 500);
      await page.locator('input[type=number]').last().fill(String(betrag));
      const ant = page.waitForResponse((r) => r.url().endsWith('/api/teklifler') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Gönder', exact: true }).last().click();
      const r = await ant;
      pruefe(r.status() === 201, `chat: Teklif ${n} (${betrag} TL) → ${r.status()}`);
      await warte(page, 2200);
    }
    await foto(page, 'teklif-B');
    // verdächtige Nachricht von B
    await page.goto(`${BASIS}/#/mesajlar/${st.konusma}`); await page.reload(); await warte(page, 2500);
    await sende(page, 'Ayırman için şimdi 500 TL kapora göndereyim, IBAN numaranı yazar mısın? Ya da sen bana TR33 0006 1005 1978 6457 8413 26 hesabına at, WhatsApp\'tan yazışalım.', 'chat: B verdächtige Nachricht (IBAN/Kapora)');
    await ctx.close();
    const m = (await q('SELECT id, tehlikeli, tehlike_turu FROM mesajlar WHERE konusma_id=$1 ORDER BY id DESC LIMIT 1', [st.konusma])).rows[0];
    pruefe(m && m.tehlikeli, `chat: KI markiert die Nachricht als riskant (${m && m.tehlike_turu})`);
    // A sieht Warnung, nimmt Teklif 2 an, lehnt Teklif 1 ab
    ({ ctx, page } = await seite('A', MOBIL));
    await page.goto(`${BASIS}/#/mesajlar/${st.konusma}`); await page.reload(); await warte(page, 2500);
    pruefe(await page.getByText(/Dikkat: Bu mesaj dolandırıcılık belirtisi taşıyor/).count() > 0, 'chat: Warnung erscheint beim Empfänger (A)');
    await foto(page, 'chat-A-warnung');
    await page.goto(`${BASIS}/#/panel/tekliflerim`); await page.reload(); await warte(page, 2000);
    await page.getByRole('button', { name: 'Satıcıyım' }).click(); await warte(page, 1500);
    const zeile = (betrag) => page.locator('div').filter({ hasText: new RegExp(`^.*${betrag.toLocaleString('tr-TR')} TL`) }).filter({ has: page.getByRole('button', { name: 'Kabul' }) }).last();
    await zeile(3500).getByRole('button', { name: 'Reddet' }).click(); await warte(page, 1200);
    await zeile(3900).getByRole('button', { name: 'Kabul' }).click(); await warte(page, 1200);
    await foto(page, 'teklif-A');
    const t = (await q('SELECT teklif_fiyat::int f, status FROM teklifler WHERE ilan_id=$1 ORDER BY id', [il.id])).rows;
    pruefe(t.some((x) => x.f === 3500 && x.status === 'reddedildi'), 'chat: A lehnt Teklif 3.500 TL ab');
    pruefe(t.some((x) => x.f === 3900 && x.status === 'kabul'), 'chat: A nimmt Teklif 3.900 TL an');
    await ctx.close();
    // B sieht den Status
    ({ ctx, page } = await seite('B', DESKTOP));
    await page.goto(`${BASIS}/#/panel/tekliflerim`); await page.reload(); await warte(page, 2000);
    const txt = await page.locator('main, body').first().innerText();
    pruefe(/Kabul/i.test(txt) && /Redd/i.test(txt), 'chat: B sieht angenommenes und abgelehntes Gebot in „Tekliflerim“');
    const bild = (await q("SELECT count(*)::int n FROM bildirimler WHERE user_id IN (71,78) AND olusturma_tarihi > now() - interval '1 hour'")).rows[0].n;
    notiz(`chat: Benachrichtigungen an A/B in der letzten Stunde: ${bild}`);
    await foto(page, 'teklif-B-status');
    await ctx.close();
  },
  // 4) Einigung und Abwicklung — was bietet das System heute?
  async abwicklung() {
    const il = st.ilan1;
    let { ctx, page } = await seite('B', DESKTOP);
    await page.goto(`${BASIS}/#/ilan/${il.uuid}`); await page.reload(); await warte(page, 2000);
    const hemen = page.getByText('Hemen Al').first();
    notiz(`abwicklung: Knopf „Hemen Al“ vorhanden: ${await hemen.count() > 0}`);
    if (await hemen.count()) {
      await hemen.click(); await warte(page, 2000);
      const wert = await page.getByPlaceholder('Mesaj yazın...').inputValue().catch(() => '');
      notiz(`abwicklung: Hemen Al → ${hash(page)}, vorbefüllter Text: „${wert.slice(0, 80)}“`);
      await foto(page, 'hemen-al');
    }
    const teslimat = await page.goto(`${BASIS}/#/ilan/${il.uuid}`).then(() => warte(page, 1500)).then(() => page.locator('body').innerText());
    notiz(`abwicklung: Detail nennt Teslimat (Elden/Kargo): ${/Elden|Kargo/i.test(teslimat)}`);
    await ctx.close();
    // A: „Satıldı“ im Panel?
    ({ ctx, page } = await seite('A', DESKTOP));
    await page.goto(`${BASIS}/#/panel/ilanlarim`); await page.reload(); await warte(page, 2000);
    // Genau die Karte dieses Inserats: vom Titel aus zum naechsten Vorfahren mit „Satıldı“-Knopf
    // (nie den ersten Knopf im Raster — Lehre aus dem Vorfall 12.09.)
    const karte = page.getByText('Sony WH-1000XM4 Kablosuz Kulaklık', { exact: false }).first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="Satıldı"]][1]');
    const satildi = karte.locator('button', { hasText: 'Satıldı' });
    pruefe(await satildi.count() === 1, 'abwicklung: Knopf „Satıldı“ für A in İlanlarım (an der richtigen Karte)');
    if (await satildi.count() === 1) {
      await satildi.click(); await warte(page, 700);
      await foto(page, 'satildi-onay');
      await page.getByRole('button', { name: 'Evet, satıldı' }).click(); await warte(page, 1800);
      const d = (await q('SELECT ilan_durum FROM ilanlar WHERE id=$1', [il.id])).rows[0].ilan_durum;
      pruefe(d === 'satildi', `abwicklung: Inserat steht auf ${d}`);
      await warte(page, 1500);
      pruefe(!(await meiliHat(il.uuid)), 'abwicklung: verkauftes Inserat nicht mehr im Suchindex');
    }
    await foto(page, 'satildi-A');
    // Bewertung / Treuhand: gibt es eine Oberfläche?
    await page.goto(`${BASIS}/#/panel/degerlendirmeler`); await page.reload(); await warte(page, 2000);
    const degKnopf = await page.getByRole('button', { name: /^Değerlendir$|Puan ver|Yorum yaz/ }).count();
    pruefe(degKnopf > 0, 'abwicklung: Oberfläche zum Bewerten des Handelspartners');
    await foto(page, 'degerlendirme-A');
    await page.goto(`${BASIS}/#/`); await warte(page, 1200);
    const islem = await page.evaluate(() => [...document.querySelectorAll('button,a')].some((e) => /Aldıklarım|İşlemlerim|Güvenli Ödeme/.test(e.textContent || '')));
    notiz(`abwicklung: Menüeintrag Aldıklarım/İşlemlerim sichtbar: ${islem}`);
    await ctx.close();
    const tx = (await q('SELECT count(*)::int n FROM islemler WHERE 71 IN (alici_id,satici_id) OR 78 IN (alici_id,satici_id)')).rows[0].n;
    notiz(`abwicklung: islemler-Zeilen für A/B: ${tx}`);
  },
  // 5) Admin-Sicht: Kundenakte A und B, Riskli Mesajlar, Medya Motoru
  async admin() {
    const { ctx, page } = await seite(null, DESKTOP);
    await adminAnmelden(page);
    for (const [wer, uid] of [['A', 78], ['B', 71]]) {
      const no = (await q('SELECT musteri_no FROM users WHERE id=$1', [uid])).rows[0].musteri_no;
      await page.goto(`${ADMIN}#/musteri/${no}/zaman`); await warte(page, 2500);
      const txt = await page.locator('#view').innerText().catch(() => '');
      const erwartet = wer === 'A' ? [/ilan/i, /mesaj/i, /giriş/i] : [/teklif/i, /mesaj/i, /giriş/i];
      pruefe(erwartet.every((r) => r.test(txt)), `admin: Zeitleiste ${wer} (${no}) zeigt die Ereignisse`);
      await foto(page, `admin-akte-${wer}`);
      if (wer === 'B') {
        await page.goto(`${ADMIN}#/musteri/${no}/mesajlar`); await warte(page, 2000);
        pruefe(await page.locator('.msg.risk').count() > 0, 'admin: Akte B → Mesajlar zeigt die riskante Nachricht rot');
      }
    }
    await page.goto(`${ADMIN}#/riskmesaj`); await warte(page, 2000);
    pruefe(await page.getByText(/kapora göndereyim/).count() > 0, 'admin: Riskli Mesajlar enthält die Nachricht');
    await foto(page, 'admin-riskmesaj');
    await page.goto(`${ADMIN}#/medya/isler?tip=video`); await warte(page, 2000);
    const jobTxt = await page.locator('#view').innerText().catch(() => '');
    pruefe(/tamam|Tamam/.test(jobTxt) && /KP-\d{4}-\d{7}/.test(jobTxt), 'admin: Medya Motoru listet die Video-Jobs');
    await foto(page, 'admin-medya');
    await page.goto(`${ADMIN}#/ilanonay`); await warte(page, 1500);
    await foto(page, 'admin-ilanonay-nachher');
    await ctx.close();
  },
  // 6) Browser-Zurück, Rechtsseiten, Cookie-Banner, Konsole, Überlauf (beide Breiten)
  async seiten() {
    for (const vp of [MOBIL, DESKTOP]) {
      const w = vp.width;
      // Cookie-Banner ohne Vorbelegung
      const ctx0 = await browser.newContext({ viewport: vp, locale: 'tr-TR' });
      const p0 = await ctx0.newPage(); p0.on('pageerror', (e) => konsole.push(`gast: ${e.message}`));
      await p0.goto(`${BASIS}/#/`); await warte(p0, 1800);
      pruefe(await p0.getByRole('button', { name: 'Reddet' }).count() > 0, `seiten/${w}: Cookie-Banner erscheint`);
      await p0.getByRole('button', { name: 'Reddet' }).first().click().catch(() => {}); await warte(p0, 400);
      pruefe(await p0.evaluate(() => !!localStorage.getItem('kapbeni_cookie_consent')), `seiten/${w}: Reddet speichert die Wahl`);
      for (const slug of ['kvkk', 'kullanim-kosullari', 'guvenli-alisveris', 'mesafeli-satis', 'kunye']) {
        await p0.goto(`${BASIS}/#/${slug}`); await p0.reload(); await warte(p0, 1200);
        pruefe((await p0.locator('body').innerText()).length > 500 && await ueberlauf(p0) <= 0, `seiten/${w}: Rechtsseite #/${slug} lädt, kein Überlauf`);
      }
      await ctx0.close();
      // Zurück durch die Stationen des Käufers
      const { ctx, page } = await seite('B', vp);
      const stationen = [`#/`, `#/kategori/tv-goruntu-ses`, `#/ilan/${st.ilan1.uuid}`, `#/mesajlar/${st.konusma}`, `#/panel/tekliflerim`, `#/panel/favorilerim`];
      await page.goto(`${BASIS}/#/`); await warte(page, 1500);
      // Stationen per Klick erreichen ist je Seite verschieden — hier per App-Navigation (pushState wie die App)
      for (const s of stationen.slice(1)) {
        await page.evaluate((h) => { location.hash = h }, s); await warte(page, 1300);
      }
      let ok = true; const besucht = [];
      for (let i = stationen.length - 2; i >= 0; i--) {
        await page.goBack(); await warte(page, 1200);
        besucht.push(hash(page));
        if (hash(page) !== stationen[i] && !(stationen[i] === '#/' && hash(page) === '')) ok = false;
        const ue = await ueberlauf(page);
        if (ue > 0) pruefe(false, `seiten/${w}: waagerechter Überlauf ${ue}px auf ${hash(page)}`);
      }
      pruefe(ok, `seiten/${w}: Browser-Zurück über alle Stationen (${besucht.join(' ← ')})`);
      await ctx.close();
    }
  },
  // Aufräumen: alles, was dieser Test angelegt hat (nur Testkonten 71/78).
  async aufraeumen() {
    const start = fs.readFileSync('/root/kp-e2e-start.txt', 'utf8').trim();
    // BEHALTEN=206,…: Zwischenaufräumen, diese Inserate bleiben (z. B. für weitere Schritte)
    const behalten = (process.env.BEHALTEN || '').split(',').filter(Boolean).map(Number);
    const ilanIds = (await q("SELECT id, uuid FROM ilanlar WHERE user_id=78 AND created_at >= $1::timestamptz", [start + 'Z'])).rows.filter((r) => !behalten.includes(r.id));
    notiz(`aufraeumen: ${ilanIds.length} Inserate von A seit ${start}`);
    const ilanArsiv = require('../../src/lib/ilanArsiv');
    for (const r of ilanIds) {
      await q('DELETE FROM teklifler WHERE ilan_id=$1 AND alici_id=71 AND satici_id=78', [r.id]);
      await q('DELETE FROM favoriler WHERE ilan_id=$1 AND user_id=71', [r.id]);
      await q('DELETE FROM mesajlar WHERE konusma_id IN (SELECT id FROM konusmalar WHERE ilan_id=$1 AND alici_id=71 AND satici_id=78)', [r.id]);
      await q('DELETE FROM konusmalar WHERE ilan_id=$1 AND alici_id=71 AND satici_id=78', [r.id]);
      const e = await ilanArsiv.ilanSilVeArsivle({ uuid: r.uuid, sahipId: 78, grund: 'silindi', kaynak: 'test' }).catch((x) => ({ hata: x.message }));
      notiz(`aufraeumen: Inserat ${r.id} → ${JSON.stringify(e).slice(0, 80)}`);
      // Archivkopie dieses Testinserats samt Dateien wieder entfernen
      const no = (await q('SELECT musteri_no FROM users WHERE id=78')).rows[0].musteri_no;
      fs.rmSync(`/var/www/kapbeni/uploads/archiv/${no}/${r.uuid}`, { recursive: true, force: true });
    }
    await q("DELETE FROM ilan_arsiv WHERE user_id=78 AND created_at >= $1::timestamptz", [start + 'Z']).catch((e) => notiz('ilan_arsiv: ' + e.message));
    if (behalten.length) return;
    await q("DELETE FROM medya_isleri WHERE user_id=78 AND created_at >= $1::timestamptz", [start + 'Z']).catch((e) => notiz('medya_isleri: ' + e.message));
    await q("DELETE FROM musteri_olaylari WHERE user_id IN (71,78) AND created_at >= $1::timestamptz", [start + 'Z']);
    await q("DELETE FROM bildirimler WHERE user_id IN (71,78) AND olusturma_tarihi >= $1::timestamp", [start]);
    await q("DELETE FROM degerlendirmeler WHERE degerlendiren IN (71,78) AND created_at >= $1::timestamptz", [start + 'Z']).catch(() => {});
    for (const f of ['/tmp/kp-e2e-A.json', '/tmp/kp-e2e-B.json']) if (fs.existsSync(f)) fs.unlinkSync(f);
  },
};

async function adminAnmelden(page) {
  await page.goto(ADMIN); await warte(page, 800);
  await page.fill('#login-email', 'ui-test-admin@test.kapbeni.com');
  await page.fill('#login-pw', fs.readFileSync('/root/kp-admin-test.pw', 'utf8').trim());
  await page.click('#login-btn');
  await page.waitForSelector('#sidebar', { timeout: 8000 });
  await warte(page, 600);
}
async function meiliHat(uuid) {
  const meili = require('../../src/lib/meili');
  try {
    const d = await meili.meili('GET', `/indexes/ilanlar/documents/${encodeURIComponent(uuid)}`); return !!(d && d.uuid);
  } catch { return false; }
}
/** Nachricht im offenen Chat senden und die API-Antwort prüfen. */
async function sende(page, text, label) {
  const inp = page.getByPlaceholder('Mesaj yazın...');
  await inp.fill(text);
  const ant = page.waitForResponse((r) => r.url().includes('/api/mesajlar/konusma/') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await page.getByRole('button', { name: 'Gönder', exact: true }).last().click();
  const r = await ant;
  await warte(page, 1500);
  const sichtbar = await page.getByText(text.slice(0, 30), { exact: false }).count() > 0 && (await inp.inputValue()) === '';
  pruefe(r && r.status() === 200 && sichtbar, `${label} (HTTP ${r ? r.status() + ' ' + new URL(r.url()).pathname : '—'}, sichtbar ${sichtbar})`);
  return r && r.status() === 200;
}

(async () => {
  const wahl = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCHRITTE).filter((s) => s !== 'aufraeumen');
  fs.mkdirSync(AUS, { recursive: true });
  // Sicherheitsnetz: A und B muessen Testkonten sein
  const k = (await q('SELECT id, email, test_verisi FROM users WHERE id IN (71,78) ORDER BY id')).rows;
  if (k.length !== 2 || !k.every((x) => x.test_verisi) || k[0].email !== KUNDE.B || k[1].email !== KUNDE.A) throw new Error('Testkonten 71/78 stimmen nicht');
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    for (const s of wahl) {
      console.log(`\n── ${s} ──`);
      try { await SCHRITTE[s](); } catch (e) { pruefe(false, `${s}: Abbruch ${e.message.split('\n').filter((z) => /locator|waiting for|Error|exceeded/.test(z)).slice(0, 3).join(' / ')}`); }
    }
  } finally { await browser.close(); await pool.end(); }
  pruefe(konsole.length === 0, `Konsole/Seitenfehler: ${konsole.length ? konsole.slice(0, 8).join(' | ') : 'keine'}`);
  console.log(fehler.length ? `\n${fehler.length} Fehler` : '\nalles gruen');
  process.exit(fehler.length ? 1 : 0);
})();
