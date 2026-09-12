# KapBeni — Projekt- und Arbeitsstand

Diese Datei ist das Gedächtnis des Projekts. **Sie wird bei jedem Auftrag gepflegt, nicht nur
einmal angelegt.** Nach jedem Feature und jedem Fix kommt ein Eintrag dazu — ergänzen, niemals
überschreiben. Wer hier liest, soll ohne Rückfragen weiterarbeiten können.

---

## 1. Architektur

Marktplatz-SPA (React 18 + TypeScript + Vite), gebaut als statisches Bundle, ausgeliefert von
nginx. Backend: drei Node-Dienste unter PM2 plus Postgres, Redis und Meilisearch.

| Dienst | Port | Pfad | PM2-Name |
|---|---|---|---|
| Frontend (Build) | — | `/opt/kapbeni/Kapbeni_Prod/src/dist` | — |
| API | 3001 | `/opt/kapbeni/api` | `kapbeni-api` |
| Express-Admin | 3002 | `/opt/kapbeni/admin` | `kapbeni-admin` |
| KYC (FastAPI) | 8001 | `/opt/kapbeni/kyc` | `kapbeni-kyc` |
| Postgres | 5432 (nur localhost) | DB `sattigitti_db` | — |
| Redis | 6379 (nur localhost) | — | — |
| Meilisearch | 7700 (nur localhost) | `/opt/meilisearch` | — |

**nginx-Vhosts** (`/etc/nginx/sites-available/`):
- `kapbeni.com` — öffentlich (443), proxyt `/api/` → 3001 und `/admin` → 3002
- `kapbeni-prod` — Port 3003, gleicher `root` wie kapbeni.com (Test/LAN)
- `kapbeni-live-ref` — Port 3004, **temporär**, liefert den Live-Stand vom 22.07. aus
  (`/opt/_vergleich/live-20260722`) für 1:1-Vergleiche
- `00-catchall` — weist unbekannte Hosts ab (444)

**Wichtige Pfade**
```
/opt/kapbeni/CLAUDE.md              diese Datei — Projektgedächtnis
/opt/kapbeni/Kapbeni_Prod/src/      Frontend-Quelle (src/) + Build (dist/)
/opt/kapbeni/api/src/routes/        API-Endpunkte
/opt/kapbeni/admin/server.js        Express-Admin (eigene Identitätsebene!)
/etc/kapbeni.env                    Secrets (JWT_SECRET, DATABASE_URL, …)
/var/www/kapbeni/uploads/           Upload-Verzeichnis
/opt/_archiv/kapbeni-freeze-*       Vollsicherungen (kapbeni-freeze.sh)
```

**Bauen und ausrollen**
```bash
cd /opt/kapbeni && ./deploy.sh patch "Kurzbeschreibung"   # der übliche Weg
```
Erhöht `VERSION`, schreibt den CHANGELOG-Eintrag, prüft Typen, baut, lädt die Dienste neu,
committet, taggt und pusht. Siehe `DEPLOY.md`. Nur bauen, ohne Version und Commit:
```bash
cd /opt/kapbeni/Kapbeni_Prod/src && npx tsc --noEmit && npm run build   # → dist/
pm2 reload kapbeni-api --update-env                                      # nach API-Änderungen
```
Immer absolute `/opt/kapbeni`-Pfade verwenden. `dist/` wird von **drei** Vhosts ausgeliefert,
ein Build geht also sofort auf kapbeni.com live.

**Versionierung** — `/opt/kapbeni/VERSION` ist die **einzige** Quelle. Von dort liest
`Kapbeni_Prod/src/vite.config.ts` beim Bauen (Fußzeile der Website) und `admin/server.js`
beim Start (Fußzeile der Admin-Seitenleiste). Die Nummer wird nie von Hand in eine
Quelldatei geschrieben. Fehlt die Datei, steht an beiden Stellen `dev`.

**Git** — Repository `CNKRTM/kapbeni`, Wurzel ist `/opt/kapbeni` (Frontend, API, Admin und
KYC-Quelle zusammen). Zugang über einen Deploy-Key unter `~/.ssh/kapbeni_deploy` (0600),
eingebunden als Host-Alias `github-kapbeni` in `~/.ssh/config`. Der private Schlüssel
verlässt den Server nicht. Ausgeschlossen sind `node_modules/`, `venv/`, `dist/`,
Sicherungskopien — und sämtliche Zugangsdaten; die stehen ausschließlich in
`/etc/kapbeni.env` und sind in `.gitignore` gesperrt.

### Zwei getrennte Admin-Ebenen — häufige Fehlerquelle
- **SPA-AdminPanel** (in der App): prüft `users.rol === 'admin'`, nutzt `/api/admin/*`
- **Express-Admin** (`:3002/admin`): eigene Tabelle **`admin_users`**, eigenes Passwort.
  Ein `rol='admin'` in `users` öffnet `:3002` **nicht**.

### Authentifizierung — harte Regel
Die API kennt **nur Bearer-Token**. Es gibt keinen Cookie-Pfad (kein `cookie-parser`, kein
`Set-Cookie`); der Login legt den JWT nur in `localStorage['sg_token']` ab.
**`fetch(..., { credentials: 'include' })` authentifiziert dort nie.** Jeder auth-pflichtige
Aufruf läuft über den zentralen Client `ve` aus `src/api/index.ts` — der setzt den Header und
wirft bei 401/!ok. `ve` hängt `BASE='/api'` selbst an, der Pfad darf also kein `/api` enthalten.

---

## 2. Styleguide — verbindlich für alles Neue

> **Regel:** Ausschließlich bestehende Schriftarten, Farben, Abstände und Komponenten-Styles
> verwenden. Keine neuen Fonts, keine neuen Style-Patterns, keine abweichenden Button-, Karten-
> oder Textformate. Alles Neue muss aussehen, als wäre es schon immer Teil der Seite gewesen.
> Vor dem Bauen die wiederverwendbaren Klassen/Komponenten identifizieren und hier festhalten.

### Farben
Definiert doppelt — als CSS-Variablen in `src/index.css` und als Tailwind-Farben in
`tailwind.config.ts`. **Immer `primary` verwenden, nie ein rohes `#b61722` schreiben.**

| Token | Wert | Verwendung |
|---|---|---|
| `primary` | `#b61722` | Hauptaktionen, Preise, aktive Zustände |
| `primary-container` | `#8a1019` | gedrückt/dunkler |
| `secondary` | `#1d4ed8` | blaue Hinweisflächen |
| `tertiary` | `#15803d` | Erfolg/Bestätigung |

Graustufen kommen aus Tailwind (`gray-100` Ränder, `gray-400`/`gray-500` sekundärer Text,
`gray-900` Überschriften). Seitenhintergrund: `#f8f9fa` (auf `body`).

### Schrift
- `body`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif`
- In Inline-Styles steht an ~47 Stellen `fontFamily: "'Plus Jakarta Sans', sans-serif"`.
  **Diese Schrift wird nirgends geladen** (kein Google-Fonts-Link in `index.html`) und fällt
  faktisch auf die Body-Schrift zurück. Bestehende Konvention beibehalten, aber keine neuen
  Font-Deklarationen einführen und **keinen** Webfont nachladen.

### Icons
- **Tabler Icons** als lokaler Webfont: `<i className="ti ti-car" />` (~69 Verwendungen).
  Liegt unter `public/vendor/tabler-icons/`, bewusst **lokal statt CDN**.
- **lucide-react** als React-Komponenten (36 Dateien), v. a. in Details/Navbar.
- Kategorie-Icons: Tabler-Klassen, siehe `TABLER_ICON` in `src/data/kategoriAgac.ts`.

### Komponenten-Muster (aus `pages/Details.tsx`, `components/ProductCard.tsx`)
```
Karte (Block)      bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
Karte (groß)       bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4
Hauptbutton        bg-primary text-white py-2.5 rounded-xl font-semibold text-sm
Sekundärbutton     bg-gray-100 text-gray-800 py-2.5 rounded-xl font-semibold text-sm
Umrandeter Button  border border-gray-200 rounded-xl  (+ hover:border-primary)
Badge/Chip         px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide
Hinweisfläche      bg-blue-50 border border-blue-200 rounded-xl p-4
Listenzeile        flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50
Produktbild        relative aspect-square overflow-hidden
```
Radien: `rounded-xl` für Bedienelemente, `rounded-2xl`/`rounded-3xl` für Flächen,
`rounded-full` für Chips. Abstände in Tailwind-Schritten (`gap-3`, `p-4`, `py-2.5`).

### Wiederverwendbare Bausteine
| Zweck | Datei |
|---|---|
| Produktkarte (Raster + Liste) | `components/ProductCard.tsx` |
| Horizontaler Slider/Karussell | `components/OneCikanSliders.tsx` |
| Kategoriebaum + Live-Zähler | `data/kategoriAgac.ts` (`useKategoriAgac`, `mitAnzahl`) |
| Navigation/History | `src/navigation.ts` |
| API-Client (Bearer) | `src/api/index.ts` (`ve`) |

Türkische Oberflächentexte, deutsche Code-Kommentare.

---

## 3. Chronik — was gebaut und gefixt wurde

### 2026-09-10

**Tabler-Icons lokal eingebunden** — `public/vendor/tabler-icons/` statt
`cdn.jsdelivr.net`. Zweck: kein Drittanbieter-Request beim Seitenaufruf. Belegt: der alte
Stand (:3004) lädt jsdelivr weiterhin, der neue nicht.

**Auth-Header-Fehler behoben** — `pages/Details.tsx`: fünf Aufrufe (Takip GET/POST, Teklif,
Inserat löschen, Şikayet) nutzten `credentials:'include'` ohne Authorization und liefen in 401,
obwohl der Nutzer eingeloggt war. Auf den zentralen Client `ve` umgestellt. Zusätzlich
beseitigt: `handleReport` und `handleDelete` meldeten **Erfolg auch im Fehlerfall**
(`fetch` wirft bei HTTP-Fehlern nicht) — der Nutzer sah „gesendet", gespeichert wurde nie etwas.

**Admin-Nutzerliste repariert** — `api/src/routes/admin.js`: vier Queries nutzten die Spalte
`kyc_durum`, die Spalte heißt `kyc_durumu`. Die Helfer `one()/many()` verschluckten den
SQL-Fehler und lieferten `[]` mit HTTP 200 — ein Defekt, der wie ein Leerzustand aussah.
Korrigiert, JSON-Feldname per Alias `kyc_durumu AS kyc_durum` stabil gehalten (AdminPanel liest
`k.kyc_durum`). SQL-Fehler werden jetzt geloggt. Gleiche Ursache in `routes/satici.js`:
`kyc_onaylandi` war immer `false`.

**Pfad-Fehler im Frontend** — `/api/kayitli` → `/api/kayitli-aramalar` (4 Stellen in
`api/index.ts`, `Dashboard.tsx`, `Discover.tsx`), `/destek/tickets` → `/destek/ticket/benim`
(`DestekMerkezi.tsx`). Beide lieferten vorher 404.

**Domain `sattimgitti.transas24.com` entfernt** — Vhost, Symlink, vier `.bak`-Dateien und
Let's-Encrypt-Zertifikat. DNS war NXDOMAIN, kein aktiver Dienst.

**Brute-Force-Schutz für den Express-Admin** — `admin/server.js`: `/admin/api/giris` auf
20 Versuche je 15 Minuten pro Client-IP. Der `keyGenerator` akzeptiert `X-Real-IP` nur von
lokalen Proxy-Anfragen, sonst wäre der Header fälschbar und ein Angreifer könnte den echten
Admin aussperren.

**Zugriff eingeschränkt** — `/admin` im kapbeni.com-Vhost auf `127.0.0.1`,
`192.168.50.0/24`, die eigene öffentliche IP (Hairpin-NAT) und die bekannte Anschluss-IP.
`ufw` aktiviert: von außen nur 22, 80, 443; 3001/3002/3003/3004/8001 dicht, LAN frei.

### 2026-09-11

**Kategorie-Filter repariert** — `pages/Discover.tsx:252` verglich `l.category` (Anzeigename
„Araba") mit `selectedCategory` (Slug „araba") — der Filter fand nie etwas. `Listing` um
`categorySlug` erweitert (7 Mapping-Stellen), Filter vergleicht jetzt den Slug. Zweite Ursache:
`submitListing` in `App.tsx` sendete **gar kein `kategori_id`** — jedes über die UI angelegte
Inserat landete mit `NULL` in der DB und war unauffindbar.

**Kategorien kommen aus der API** — `data/categories.ts` (269 Einträge) und die Tabelle
`kategoriler` (351) waren auseinandergelaufen, nur 74 gemeinsame Slugs. Neu:
`data/kategoriAgac.ts` mit `useKategoriAgac()` als einzige Quelle für Navigation, Dropdown,
Sidebar, Mega-Menü und Sat-Modal. `data/categories.ts` ist damit verwaist.

**Live-Inseratszahlen** — `api/src/routes/kategoriler.js` liefert je Knoten `adet`
(rekursiv inkl. Unterkategorien) und `adet_direkt`. Kein Snapshot, keine Zählerspalte: bei
jedem Aufruf frisch gezählt. Anzeige „Araba (2)" über `mitAnzahl()` an allen vier Stellen.

**Browser-History** — neu: `src/navigation.ts`. Die App hatte keinerlei History-Anbindung,
der Zurück-Button verließ kapbeni.com. Jetzt bildet jeder sichtbare Zustand eine Hash-URL ab
(`#/kategori/<slug>`, `#/ilan/<uuid>`, `#/satici/<id>`, `#/panel/<tab>`, `#/mesajlar/<id>`,
`#/arama?q=`). Modals bekommen bewusst **keine** eigene Route. Dabei aufgedeckt und behoben:
Panel-Reiter und Chat-Auswahl lagen in lokalem State ohne Rückmeldung nach oben
(`onTabChange`, `onChatChange` ergänzt).

**„Geri Dön" nutzt `history.back()`** — die eingebauten Zurück-Knöpfe legten vorher eine neue
Station an und sprangen auf die Startseite, während der Browser-Knopf zur Kategorie führte.
Über einen Index im History-State (`navIdxRef`) wird erkannt, ob eine eigene Station davor
liegt; bei Direkteinstieg per Link greift ein Fallback, damit der Knopf die Seite nicht verlässt.

**Kleinere Korrekturen dabei** — `decodeURIComponent` abgesichert (ein `%` in der URL erzeugte
eine komplett weiße Seite), Antwortform beim Nachladen geprüft (`#/ilan/boosted` erzeugte ein
Geisterinserat), Abbruchschutz für parallele Ladevorgänge, `GET /api/ilanlar/<ungültig>`
antwortet mit 404 statt 500 samt Postgres-Fehlertext.

**Teklif Yap auf der Produktseite** — Der Button hieß „Teklif Ver" und lag unauffällig in der
Seitenleiste; die Funktion war seit dem Auth-Fix vom 10.09. bereits lauffähig. Umbenannt auf
**„Teklif Yap"** und um einen **Verlauf der eigenen Gebote** ergänzt: beim Öffnen des Modals
lädt `pages/Details.tsx` über `GET /api/teklifler?rol=alici&ilan_uuid=<uuid>` alle bisherigen
Gebote zu genau diesem Inserat und zeigt sie mit Betrag und Status.
Dafür `api/src/routes/teklifler.js` um den optionalen Filter `ilan_uuid` erweitert (vorher
hätte die Detailseite alle Gebote des Nutzers laden müssen); dabei fiel auf, dass der
`status`-Filter hart auf `$2` stand und mit einem zweiten Parameter kollidiert wäre — auf
`$${p.length+1}` umgestellt.
Status-Farben und -Etiketten sind dieselben wie im Panel (`pages/Dashboard.tsx`), damit ein
Gebot überall gleich aussieht. Belegt: `POST /api/teklifler` → **201**, Verlauf zeigt danach
„₺1.500 · Cevap Bekliyor".
**Grenze der API:** Es gibt keine Gegenangebote — `teklifler` hat eine Zeile je Gebot, der
Verkäufer kann nur `kabul`/`reddedildi`. Eine echte Verhandlung (Verkäufer bietet zurück)
wäre eine Backend-Erweiterung, siehe Backlog.

**Hemen Al als Kontakt-Abkürzung** — Neuer Knopf in der Seitenleiste der Produktseite, direkt
neben „Mesaj Gönder". **Kein Checkout, keine Zahlung**: er öffnet nur den Chat mit dem
Verkäufer und legt den Satz „Bu ürünü hemen satın almak istiyorum." schon ins Eingabefeld —
abschicken muss der Käufer selbst.

Ablauf: `hemenAl()` in `src/src/App.tsx` ruft `POST /api/mesajlar/konusma` mit der
`ilan_uuid` auf (dieselbe Route wie „Mesaj Gönder", die Route ist idempotent und liefert bei
einer bereits bestehenden Unterhaltung dieselbe ID zurück), setzt `selectedChatId` und
wechselt auf den Reiter `messages`. Der vorbereitete Text läuft über den State
`chatVorlage` → Prop `initialText` an `pages/Messages.tsx`; ein Effect dort schreibt ihn ins
Eingabefeld, sobald die Unterhaltung geladen ist, und meldet über `onTextUebernommen()`
zurück, damit der Text nach dem ersten Mal nicht erneut gesetzt wird (sonst hätte er jede
eigene Eingabe wieder überschrieben). Ohne Anmeldung öffnet stattdessen das Login-Fenster.

Styleguide: `bg-tertiary` (Grün) als Gegenstück zum primären „Mesaj Gönder", gleiche
Höhe/Radien/Schatten wie die übrigen Seitenleisten-Knöpfe, Icon `ti ti-shopping-cart`.
Belegt: Klick → `POST /api/mesajlar/konusma` **200** → URL `#/mesajlar/4`, Chat offen,
Eingabefeld enthält den Satz (Screenshot `4-hemenal-chat.png`).

**Hinweis:** Dieser Weg nutzt die echte Chat-API. Der ältere `startChat()` mit lokalen IDs
(`chat_<zeitstempel>`) bleibt daneben bestehen — siehe Backlog, zwei parallele Chat-Systeme.

**Benzer İlanlar — Empfehlungsleiste am Fuß der Produktseite** — Neuer Abschnitt unterhalb
der zweispaltigen Detailansicht: waagerechter Streifen mit Inseraten plus eine Chip-Reihe
„Daha Fazla Kategori".

**Auswahl serverseitig**, neuer Endpunkt `GET /api/ilanlar/:uuid/benzer?limit=12`
(`api/src/routes/ilanlar.js`). Bewusst nicht im Browser gefiltert: das Frontend hält immer
nur die gerade sichtbare Seite an Inseraten — eine Auswahl daraus wäre je nach Einstiegspunkt
verschieden und nach einem Direktaufruf der Detail-URL sogar leer. Die Antwort trennt zwei
Listen, damit die Oberfläche ehrlich bleibt:
- `ilanlar` — dieselbe Kategorie samt Unterkategorien (zwei Ebenen, gleiche Logik wie `GET /`)
- `diger_ilanlar` — Auffüller aus anderen Kategorien, nur so viele wie oben fehlen
Sortierung wie in der Kategorieliste (`zirve` → `plus` → neu). Das Inserat selbst ist immer
ausgeschlossen, ungültige/unbekannte UUID → 404.
**Fallstrick dabei:** `kategori_id NOT IN (…)` wertet bei `kategori_id IS NULL` zu NULL aus —
das Inserat ohne Kategorie (Asus Notebook) wäre still aus dem Auffüller gefallen. Deshalb
`COALESCE(i.kategori_id, -1)`.

**Oberfläche** `src/src/components/BenzerIlanlar.tsx`. Die Karten sind unverändert
`components/ProductCard.tsx` im Grid-Modus, nur in einen Streifen fester Breite gesetzt —
dieselben Radien, Schatten, Preisfarbe und Favoritenherzen wie in Kategorie- und Suchliste.
Rahmen und Kopfzeile folgen dem Muster der übrigen Detailkarten
(`bg-white rounded-2xl border border-gray-100 shadow-sm`, Tabler-Icon in `#e53935`).
Pfeiltasten blenden sich nur ein, solange in die jeweilige Richtung noch etwas zu scrollen
ist. Während des Ladens stehen Platzhalter in Kartenform, kein Springen des Layouts.
Die Chips kommen aus `useKategoriAgac()` — also aus demselben Kategorie-Endpunkt wie
Navigation, Dropdown, Mega-Menü und Sidebar, samt der dort gepflegten Stückzahl.

**Ein Klick = eine History-Station**: die Karte ruft `selectProduct` aus `App.tsx` auf,
derselbe Weg wie aus der Kategorieliste. Belegt: `#/ilan/9fb5…` → Klick → `#/ilan/a14e…`,
`history.length` 2 → 3, Zurück landet wieder auf dem Ausgangsinserat.

**Nebenbefund, noch offen:** Bei einem Direktlink auf `#/ilan/<uuid>` findet `navAnwenden()`
das Inserat in `data/mockData.ts` (die Mock-Einträge tragen dieselben UUIDs wie die echten)
und zeigt dessen hartkodierte Daten statt der DB-Daten. Diese Mock-Einträge haben kein
`categorySlug` und führen den Slug im Anzeigefeld `category`. Der Slider hängt deshalb nicht
am übergebenen Inserat, sondern nimmt die Kategorie aus der eigenen Server-Antwort. Der
eigentliche Mangel steht im Backlog.

**Zentralisiert:** Die Abbildung API-Zeile → `Listing` liegt jetzt als `ilanZuListing()` in
`src/src/api/index.ts`; `App.tsx` nutzt sie über `einzelnesIlanZuListing`. Vorher gab es sie
nur in `App.tsx`, mit dem Slider wären es zwei Kopien gewesen.

**Bildergalerie und Video (8 + 1)** — Bestandsaufnahme vorweg: das Limit von 8 Bildern stand
bereits in Modal *und* API. Fehlend war die **Anzeige** — `pages/Details.tsx` zeigte ein
einziges `<img src={listing.image}>`, alle weiteren Bilder lagen unsichtbar in der DB. Alle
9 aktiven Inserate hatten deshalb genau ein Foto. `ilanlar.has_video` existierte seit jeher,
war überall `false` und wurde von keiner Zeile Code gesetzt oder gelesen; ein Feld für die
Videoquelle gab es nicht.

*Schema (unverändert geblieben):*
```
ilan_fotograflar(id, ilan_id FK→ilanlar ON DELETE CASCADE,
                 url varchar(500), sira int, ana_foto bool)
```
*Migration:* `ALTER TABLE ilanlar ADD COLUMN video_url varchar(500)` — ein Video je Inserat,
deshalb Spalte statt eigener Tabelle; `has_video` spiegelt, ob gesetzt, und macht den längst
vorhandenen Filter `videolu=true` aus `GET /api/ilanlar` endlich brauchbar.

*Upload* (`api/src/routes/ilanlar.js`): `upload.array('fotograflar', 8)` →
`upload.fields([{fotograflar, 8}, {video, 1}])`. multer kennt nur **eine** gemeinsame
`fileSize`-Schranke, die steht deshalb auf dem größeren Wert (20 MB, Video) und die engere
Bildgrenze (10 MB) wird je Datei im Handler geprüft — **vor** dem INSERT, sonst stünde ein
Inserat ohne Bilder in der DB. multer bricht zudem schon vor dem Handler ab; ohne den Mantel
`ilanUpload` sähe der Verkäufer dafür einen 500er ohne Grund. Video wird roh abgelegt
(`<uuid>_video.mp4|webm`), es gibt keine Transkodierung — daher die enge Grenze.
Akzeptiert: `video/mp4`, `video/webm`, `video/quicktime` (iPhone-MOV, als .mp4 abgelegt).

*Infrastruktur:* nginx `client_max_body_size` 20M → **60M** in `kapbeni.com` und
`kapbeni-prod`; `/etc/kapbeni.env` `MAX_UPLOAD_SIZE` 10mb → 40mb (die Variable wird von
keinem Code gelesen, sie dokumentiert nur). `kapbeni-prod` (:3003) bekam zusätzlich einen
`location /uploads/`-Proxy — dort waren hochgeladene Dateien vorher gar nicht erreichbar.

*Verkaufsmaske* (`components/SellModal.tsx`): Video-Feld mit Vorschau und Entfernen-Knopf,
Grenzen als Konstanten neben denen der API. Reihenfolge der Bilder über **‹ ›-Knöpfe** auf
jeder Kachel statt Ziehen — funktioniert auch auf dem Telefon und mit der Tastatur; das
erste Bild trägt „Kapak" und wird `ana_foto`. Zu große oder zu viele Dateien werden beim
Auswählen abgefangen, nicht erst beim Absenden.

*Detailseite:* Galerie aus Fotos + optionalem Video, Pfeile mit Ringschluss, Zähler „3 / 9",
Vorschaukacheln (Video als dunkle Kachel mit `ti-player-play-filled`). Die Medien kommen aus
**derselben** Detail-Antwort, die der Bereich ohnehin schon holt — keine zusätzliche Anfrage.
Solange sie unterwegs ist, steht das Titelbild aus der Liste da, damit nichts springt.

*Belegt* (Testinserate danach samt Dateien entfernt, 9 aktive Inserate unverändert):
8 Bilder + MP4 → 201, `sira` 0–7, `ana_foto` nur auf 0, `has_video=t`; Auslieferung über
nginx HTTP 200 und **206 mit `Content-Range`**, also Springen im Video möglich.
Grenzfälle je 400 mit passendem Text: 9 Bilder, Video 21 MB, JPEG als Video, zwei Videos.
Ohne Video weiterhin 201. Galerie: Zähler 1/9 → 9/9 → Ringschluss auf 1/9, Video spielt
(`readyState 4`, 640×360, Steuerung sichtbar).
**Anmerkung zum Testbrowser:** das quelloffene Chromium der Testumgebung kann kein H.264
(`canPlayType('video/mp4; codecs=avc1…')` → `""`). Das Abspielen ist deshalb mit einem
WebM/VP9 belegt; für MP4 ist die Auslieferung (206, `video/mp4`) nachgewiesen. Chrome,
Safari und Firefox liefern H.264 mit.

**Teilen-Menü mit echten Zielen** — Hinter dem Teilen-Symbol lag bisher nur
`navigator.clipboard.writeText(window.location.href)`; kein Ziel, kein Rückfallweg. Neu:
`src/src/components/PaylasMenu.tsx` mit WhatsApp, Telegram, X, Facebook, E-Posta und
„Bağlantıyı Kopyala". Auf Geräten mit `navigator.share` steht „Cihazda Paylaş" zusätzlich
oben — nur dann, denn die Funktion gibt es im Wesentlichen nur auf Telefonen und nur im
sicheren Kontext.

**Der alte Knopf tat über http gar nichts.** `navigator.clipboard` existiert ausschließlich
im sicheren Kontext (https oder localhost); auf `http://192.168.50.100:3003` ist das Objekt
schlicht nicht vorhanden, der Aufruf lief ins Leere und der Nutzer sah trotzdem den Haken.
`inZwischenablage()` prüft jetzt `window.isSecureContext` und fällt sonst auf ein
unsichtbares `<textarea>` mit `document.execCommand('copy')` zurück. Belegt durch Einfügen
mit Strg+V: über http kommt `http://192.168.50.100:3003/#/ilan/…` an, über
`https://kapbeni.com` die echte Adresse. Scheitert auch das, erscheint die Adresse als Text
zum Abschreiben, statt still nichts zu tun.

**Geteilt wird eine gebaute Adresse**, `window.location.origin + '/#/ilan/' + uuid`, nicht
`window.location.href` — so wird immer genau dieses Inserat geteilt, unabhängig davon, was
gerade im Hash steht. Die Domain steht nirgends fest verdrahtet.

Styleguide: bewusst **keine Markenfarben**. Jede Zeile nutzt dieselbe Form wie „Konumu
Haritada Gör" in der Detailansicht — Symbolquadrat `w-8 h-8 rounded-lg bg-primary/8` mit
Tabler-Icon in `--color-primary`, Beschriftung `text-sm font-semibold text-gray-700`,
`hover:bg-gray-50`. Rahmen wie die übrigen Karten. Alle Marken-Icons stammen aus dem bereits
eingebundenen `@tabler/icons-webfont@3.0.0`, es kam keine Schrift und keine Bilddatei dazu.
Externe Ziele mit `target="_blank" rel="noopener noreferrer"`, `mailto:` ohne `target`.
Menü schließt bei Escape und Klick daneben; auf 390 px Breite bleibt es im Fenster (82–322 px),
die Seite läuft nicht waagerecht über.

**Dabei gefunden und behoben — Inserate ließen sich überhaupt nicht anlegen.**
`POST /api/ilanlar` antwortete mit `permission denied for sequence ilan_numarasi_seq`. Der
Trigger `trg_set_ilan_numarasi` auf `ilanlar` ruft `nextval('ilan_numarasi_seq')` auf; diese
Sequenz gehört `postgres`, während alle anderen `sattigitti` gehören, und der API-Benutzer
hatte kein `USAGE`. Es war die **einzige** Sequenz ohne Recht. Behoben mit
`GRANT USAGE, SELECT ON SEQUENCE ilan_numarasi_seq TO sattigitti`. Der Fehler bestand
unabhängig von dieser Änderung und erklärt, warum in der DB ausschließlich die ursprünglichen
Startdaten stehen.

**Freeze `kapbeni-freeze-20260911-134115`** — 349 MB, 32 Dateien, Prüfsummen vollständig OK.
Enthält alles aus diesem Tag: Spalte `ilanlar.video_url`, nginx `client_max_body_size 60M`
in beiden Vhosts, den `/uploads/`-Proxy auf `:3003`, die neuen Bausteine
`BenzerIlanlar.tsx` / `PaylasMenu.tsx` — und im DB-Dump das reparierte
`GRANT SELECT,USAGE ON SEQUENCE ilan_numarasi_seq TO sattigitti`, ohne das ein Restore den
Fehler „Inserate lassen sich nicht anlegen" wieder mitbrächte.

**`kapbeni-freeze.sh` erweitert:** Der ufw-Regelsatz wird jetzt **vom Skript selbst** ins
MANIFEST geschrieben, nicht mehr von Hand nachgetragen — ufw hält seine Regeln unter
`/etc/ufw`, liegt also außerhalb des Tarballs und fehlte beim Restore sonst ersatzlos.
Die Nachbau-Befehle stammen aus `ufw show added`, das genau die Zeilen ausgibt, mit denen
die Regeln angelegt wurden; die SSH-Regel wird nach vorn sortiert, damit niemand sich beim
Nachbauen vor `ufw enable` selbst aussperrt. Ein erster Versuch, die Befehle aus
`ufw status numbered` abzuleiten, erzeugte Unsinn (`ufw allow 1]`), weil die laufende Nummer
als eigenes Feld mitgezählt wird — deshalb der Umweg über `show added`.

**GitHub-Anbindung und Versionierung** — Repository `CNKRTM/kapbeni`, erster Commit
`993ae2f` (v1.0.0), 146 Dateien, 16,3 MB.

*Zuschnitt:* Wurzel ist `/opt/kapbeni`, nicht nur `Kapbeni_Prod`. Grund: von den Änderungen
des 11.09. liegt etwa die Hälfte in `api/src/routes/` — bei einem reinen Frontend-Repo wäre
sie unversioniert geblieben. Außerdem liegt `VERSION` so an der Wurzel und Frontend wie
Admin lesen sie aus derselben Stelle.

*Vor dem ersten Commit geprüft:* keine `.env`-Dateien, keine Schlüssel- oder
Zertifikatsdateien im Baum; die zu committende Dateiliste einzeln auf private Schlüssel,
GitHub-/AWS-/Slack-/OpenAI-Token und Zugangsdaten-Zuweisungen durchsucht. Drei Treffer
waren Fehlalarme (SQL-Spalte `api_key`, Antwortfeld `token`). `ecosystem.config.js` enthält
nur `env_file`-Verweise, keine Werte.

*`deploy.sh`* — `./deploy.sh [patch|minor|major] "Text"`, `--dry-run` zeigt nur an. Sieben
Schritte: Vorbedingungen (Semver gültig, `origin/main` nicht voraus) → Nummer erhöhen →
CHANGELOG-Abschnitt oben einfügen → `tsc --noEmit` → bauen über das vorhandene
`build-deploy.sh` (dessen dist-Sicherung und Rotation werden mitbenutzt statt verdoppelt) →
Dienste neu laden und prüfen → committen, taggen, pushen. Reihenfolge ist Absicht: erst
prüfen, dann bauen, zuletzt veröffentlichen.

**Drei Fehler im eigenen Skript, beim ersten echten Lauf gefunden und behoben:**
1. Die Prüfung lief sofort nach `pm2 reload`, der Port war noch zu — der Lauf brach bei
   einem gesunden Dienst ab. Jetzt bis zu 15 Sekunden Wiederholung.
2. `C=$(curl … || echo 000)` gab bei Fehlschlag `000000` aus, weil curl **und** das
   `||` je `000` schrieben. Jetzt eine Funktion mit sauberem Rückgabewert.
3. **Der wichtigste:** Der Build läuft vor der Dienstprüfung. Beim Abbruch in Schritt 6 blieb
   ein live ausgeliefertes Bundle mit `1.1.0` stehen, während `VERSION` schon wieder `1.0.0`
   sagte. Das Aufräumen holt jetzt zusätzlich das `dist` aus der Sicherung zurück, die
   `build-deploy.sh` vor dem Build angelegt hat, und lädt den Admin neu (er liest `VERSION`
   beim Start).
Außerdem prüfte die Bundle-Kontrolle auf `v1.1.0`, vite backt aber `"1.1.0"` ohne das `v`
aus der JSX-Zeile ein — der Test hätte immer angeschlagen.

*Belegt:* Rücksetzen funktioniert (Abbruch ließ `VERSION` auf `1.0.0`), danach v1.1.0
vollständig durchgelaufen: Bundle trägt `"1.1.0"`, Admin zeigt `v1.1.0`, Fußzeile auf
kapbeni.com zeigt `v1.1.0`, Tags `v1.0.0`/`v1.1.0` auf `origin/main`.

*Doku nach dem Cankartim-Muster:* `README.md` (Technikstapel + Verweise), `DEPLOY.md`
(Ablauf, Rollback, Freeze, Geheimnisse), `CHANGELOG.md` (neueste zuerst), und diese Datei
als laufender Stand.

**Nachgezogen:** Diese Datei liegt jetzt an der Repo-Wurzel (`/opt/kapbeni/CLAUDE.md`)
statt unter `Kapbeni_Prod/` — verschoben mit `git mv`, die Historie bleibt also erhalten.
Damit entspricht sie dem Cankartim-Vorbild und wird von Werkzeugen gefunden, die im
Arbeitsverzeichnis nach `CLAUDE.md` suchen. Die Verweise in `README.md` (3) und
`CHANGELOG.md` (1) sind mitgezogen.

### 2026-09-12

**Punkt 1 — Inserate bearbeiten.** Befund vorweg: es existierte **nichts** dafür. Kein
PUT/PATCH auf `/api/ilanlar/:uuid` (Gegenprobe: 26 Treffer für `UPDATE ilanlar` im Backend,
kein einziger mit `baslik`, `aciklama` oder `kategori_id` im `SET`), keine Route zum
Hinzufügen oder Löschen einzelner Fotos, keine für `video_url`, keine Bearbeiten-Oberfläche.
Die einzige Inhaltsänderung überhaupt war `PATCH /api/ilanlar/:id/fiyat` — nur der Preis.

*Neu: `PUT /api/ilanlar/:uuid`* (`api/src/routes/ilanlar.js`). Besitzprüfung wie im
DELETE-Handler (`WHERE uuid=$1 AND user_id=$2`, 404 statt 403 — die user_id steckt in
derselben Klausel). Ändert Titel, Beschreibung, Preis, Kategorie, Zustand, Ort sowie Fotos
und Video. Leere Felder werden übergangen, damit Teiländerungen keine unbeteiligten Spalten
leeren; `ilce` darf ausdrücklich geleert werden und geht deshalb einen eigenen Weg.

*Fotos als Zielzustand statt als Einzelbefehle.* Das Feld `sirala` ist die vollständige
Wunschreihenfolge: je Eintrag entweder die URL eines Bestandsbildes oder `#yeni:N` als
Platzhalter für die N-te mitgeschickte Datei. Ein erster Entwurf nahm nur eine
Behalten-Liste — damit landeten neue Fotos immer am Ende, und die Maske hätte eine
Reihenfolge angezeigt, die das Ergebnis nicht hat. Fremde URLs werden verworfen, sonst ließe
sich über das Feld ein Bild eines anderen Inserats einhängen. Belegt: neues Foto zwischen
zwei Bestandsbilder und an die erste Stelle (wird dort Titelbild).

*Die KI-Moderation läuft beim Bearbeiten bewusst nicht erneut* — sie ist ausgefallen (410)
und würde über ihren freundlichen Rückfallwert ohnehin alles durchwinken (siehe Backlog).

*Oberfläche:* `components/SellModal.tsx` dient beiden Zwecken; gesetzte `vorgabe` = Bearbeiten.
Der **Bild-State musste dafür umgebaut werden**: vorher lagen Dateien und Vorschauen in zwei
Feldern (`images: File[]`, `previews: string[]`), die stillschweigend gleich lang sein
mussten. Bestandsbilder haben aber keine Datei. Die Folgen wären gewesen: Zähler zeigt 0/8
bei acht Bildern, `handleFiles` überschreibt beim Hinzufügen eines einzigen Fotos alle
Bestandsbilder, Entfernen trifft das falsche Bild, Sortierpfeile funktionieren gar nicht,
und ohne Bildänderung ginge der **Unsplash-Platzhalter** als `foto_url` an die API. Jetzt
eine Liste `Bild[]`, in der Bestandsbild und neue Datei nebeneinander stehen.

*Drei Datendreher mitbehoben*, die jeden Wert auf dem Rückweg umgekippt hätten:
- Zustand: `DURUM_ETIKET` liefert `'Az Kullanılmış'`, im Select steht aber
  `'İkinci El - Az Kullanılmış'` — eigene Zuordnung `DURUM_ZU_OPTION`.
- Kategorie: aus der API kommt **ein** Slug ohne Angabe der Ebene. Der Baum wird jetzt
  rückwärts durchsucht (Effect, weil `useKategoriAgac()` asynchron nachliefert).
- Ort: `sehir`/`ilce` werden getrennt übergeben statt über die zusammengeklebte
  `location`-Zeichenkette, die in beiden Richtungen verschieden sortiert ist.

*Erreichbar von zwei Stellen:* „Düzenle" auf der Detailseite neben „Sil", **nur wenn
`isOwner`** — für alle anderen wird der Knopf gar nicht gerendert, nicht nur ausgegraut
(belegt: unsichtbar ohne Anmeldung und für einen angemeldeten Fremden). Und als Overlay auf
jeder Karte in `İlanlarım` (`pages/Dashboard.tsx`), links positioniert, damit er nicht auf
dem Herz-Icon von `ProductCard` (`absolute top-2 right-2`) sitzt; Muster 1:1 von
`pages/Profile.tsx` übernommen, `e.stopPropagation()`, sonst öffnet die Karte darunter.

*Nebenwirkung beseitigt:* `GET /api/ilanlar/:uuid` zählte bei jedem Aufruf `goruntulenme`
hoch — das Öffnen der eigenen Bearbeiten-Maske hätte die eigene Aufrufzahl gefälscht. Eigene
Aufrufe zählen jetzt nicht mehr mit.

---

**Punkt 2 — Foto-Upload auf Handy und Tablet.** Die Vermutung traf nicht zu: **die
Dateiauswahl funktionierte bereits** mit Kamera und Galerie.
- `accept="image/jpeg,…"` blockiert die Kamera nicht; beide Plattformen entscheiden am
  `image/`-Präfix.
- Das fehlende `capture`-Attribut ist der **Grund** dafür, kein Mangel: `capture` nähme die
  Galerie weg, statt die Kamera hinzuzufügen. Bewusst **nicht** nachgerüstet.
- `className="hidden"` (`display:none`) blockiert `.click()` auf keiner Plattform, solange
  der Klick in einer Nutzergeste liegt — tut er.
- Drag&Drop gibt es im gesamten Frontend gar nicht (einziger Treffer: `draggable={false}`);
  der Baustein war also nie „nur für Desktop" gebaut.
- Dass `image/heic` in `accept` fehlt, ist ebenfalls richtig: genau deshalb liefert iOS
  Mediathek-Fotos als JPEG.

*Behoben wurden stattdessen die zwei echten Mängel:*
1. **Serverseitig fehlte die Bild-MIME-Prüfung**, die es für Video längst gab — `multer`
   lief ohne `fileFilter`. Ein HEIC, das den `accept`-Dialog umgeht (Dateien-App, anderer
   Client), ließ `sharp` platzen (libvips ohne HEVC-Decoder); weil der `INSERT` **vor** der
   Bildschleife läuft, blieb dann ein fotoloses Inserat in der DB stehen. Neu: `FOTO_TYPEN`
   und die gemeinsame Prüfung `medienPruefen()`, die POST und PUT benutzen — **vor** jedem
   Schreiben. Belegt: HEIC → 400 mit klarem Text, kein Geister-Inserat.
2. **Die Bedienelemente auf den Vorschaukacheln waren 20 px** — unter dem WCAG-Minimum von
   24 px, auf einer 80-px-Kachel dicht beieinander. Jetzt 28 px (Entfernen, beide
   Sortierpfeile) und 32 px beim Video. Auf 390 px gemessen: Kachel 80 px, Knöpfe 26–28 px,
   kein waagerechter Überlauf.

---

**Punkt 3 — Löschbutton reagierte nicht.** Es gibt **drei** Löschknöpfe; zwei waren kaputt.

1. **AdminPanel** (`pages/AdminPanel.tsx:151`) — rief `DELETE /api/admin/ilanlar/:uuid`;
   **diese Route existierte nicht**. Die Anfrage fiel in den 404-Catch-All, `ve` warf, es gab
   kein `catch`, das Promise verpuffte, `reload()` lief nie. Weder Meldung noch Wirkung —
   exakt das gemeldete Symptom. Route in `api/src/routes/admin.js` ergänzt, `catch` mit
   sichtbarer Meldung im Panel nachgezogen.
2. **Detailseite** — löschte zwar, rief danach aber nur `onBack()`. Die Startseite lädt ihre
   Liste nicht neu (`fetchListings` läuft einmal beim Mounten) und spiegelt sie in
   `localStorage`; das Inserat stand danach weiter da. Neu: `onDeleted` nimmt es aus der
   Liste, verlässt die Ansicht und lädt nach.
3. **Dashboard** hatte gar keinen Löschknopf — und hielt nach einer Löschung an anderer
   Stelle seine eigene, veraltete Liste. Neu: `refreshSignal`, das App.tsx nach Bearbeiten
   und Löschen erhöht. **Dabei ein zweiter Fehler:** der Ladeeffekt hing nur an `[tab]`, das
   Leeren des Merkers blieb also wirkungslos — `loaded` gehört in die Abhängigkeiten.
   Erst danach verschwand das gelöschte Inserat wirklich aus der Ansicht.

*Und der Kernbefund:* `DELETE /api/ilanlar/:uuid` **löschte überhaupt nicht**, es setzte nur
`ilan_durum='pasif'` — meldete aber „İlan kaldırıldı". Am laufenden System belegt: Zeile,
Fotozeile und Bilddatei überlebten, `GET /:uuid` lieferte das „gelöschte" Inserat **ohne
Token** an jeden mit dem Link aus und zählte die Aufrufe weiter hoch. Nach deiner
Entscheidung wird jetzt **endgültig gelöscht**.

**Sieben Fremdschlüssel auf `ilanlar` stehen auf NO ACTION** und hätten ein `DELETE`
blockiert. Geschäftsunterlagen dürfen dabei nicht verschwinden, nur weil ein Verkäufer sein
Inserat entfernt: `odemeler`, `payments`, `islemler`, `degerlendirmeler`, `ilan_sikayetler`,
`ilan_vitaminler` und `support_tickets` behalten ihre Zeile und verlieren nur den Verweis
(`ilan_id=NULL`, alle Spalten sind NULL-fähig). Gebote sind ohne Inserat gegenstandslos und
gehen mit. Fotos, Favoriten, Chats, Warenkorb, Merkmale und Beobachter räumt die DB per
CASCADE ab. Alles in **einer Transaktion**; die Dateien werden erst nach dem COMMIT
entfernt, damit ein Rollback keine Bilder kostet. Belegt mit fünf tatsächlich belegten
Blocker-Tabellen: Löschen lief durch, alle Unterlagen überlebten.

Außerdem: `DELETE` mit numerischer ID gab vorher 500 mit rohem Postgres-Text
(`invalid input syntax for type uuid`) — die Route prüft die Kennung jetzt wie die
Detail-Route und antwortet 404.

**Direktlink geschlossen:** `GET /api/ilanlar/:uuid` liefert für nicht aktive Inserate 404,
außer für den Eigentümer (der seine Bearbeiten-Maske laden muss). Dafür wertet die Route den
Token **optional** aus (`optionalerNutzer()`), statt auth-pflichtig zu werden.

**Fehlermeldungen kamen nie an:** Die API antwortet mit dem Feld `hata`, der Client las nur
`message` — es erschien immer der generische Text „Hata oluştu". `api/index.ts` liest jetzt
`hata || message || error`. Erst dadurch sagt ein fehlgeschlagenes Löschen oder Speichern,
woran es lag.

**Adversariale Gegenprüfung vor dem Ausrollen — zehn bestätigte Funde, alle behoben.**
Vier Prüfer gegen den Arbeitsbaum, jeder gemeldete Fund einzeln am laufenden System
nachgestellt. Der Reihe nach, vom Schwersten:

1. **PUT vernichtete Bestandsfotos, bevor die neuen geschrieben waren.** Die entfallenen
   Zeilen und Dateien gingen zuerst weg, `sharp` lief erst danach. Brach es ab — etwa bei
   einer Datei, die nur vorgibt ein Bild zu sein; der MIME-Typ kommt aus dem
   Multipart-Header des Clients und ist frei setzbar — waren die alten Bilder
   unwiederbringlich weg und das Inserat stand ohne jedes Bild weiter öffentlich da.
   Jetzt: **erst alle neuen Bilder in den Speicher umwandeln**, dann die Datenbankarbeit in
   **einer Transaktion** (samt `SELECT … FOR UPDATE`, weil zwei gleichzeitige Änderungen
   sonst ein Inserat ohne Titelbild und mit Lücken in der Reihenfolge hinterließen),
   Dateien ganz zuletzt. Belegt: kaputte Datei → 400, Foto und Datei unverändert erhalten.
2. **`dateienEntfernen()` löschte Dateien fremder Inserate.** `POST /` übernimmt `foto_url`
   unverändert als Fotozeile — dort ließ sich der Pfad der Bilddatei eines fremden Inserats
   eintragen und über ein eigenes Wegwerf-Inserat löschen. Jetzt zwei Schranken: der
   Dateiname **muss** mit der uuid des eigenen Inserats beginnen, und keine andere Zeile
   darf die URL noch führen. Belegt am Titelbild eines fremden Inserats: überlebt PUT und
   DELETE.
3. **Löschen zerstörte laufende Geschäfte.** Ein Inserat mit offener Treuhand-Transaktion
   ließ sich jederzeit entfernen. Die Belegzeile überlebte zwar, fiel aber aus
   `GET /api/islemler/benim` heraus (INNER JOIN auf `ilanlar`) — der Vorgang verschwand für
   Käufer **und** Verkäufer, das Geld hing, und der Chatverlauf ging per CASCADE mit. Ein
   Verkäufer hätte nach einer Beschwerde die Beweislage löschen können. Jetzt **409**,
   solange eine Transaktion in `odeme_bekleniyor`, `aktif`, `askida`, `kargoya_verildi`
   oder `itiraz_acildi` steht — in beiden Löschpfaden, auch im Admin.
4. **Die Direktlink-Sperre war zu breit.** `!== 'aktif'` traf auch `askida` (setzt der Kauf),
   `satildi` und `moderasyonda`. Der Käufer verlor die Seite des gekauften Objekts in dem
   Moment, in dem er kaufte. Jetzt nur `pasif`.
5. **`Details.tsx` holte die Daten ohne Token** (rohes `fetch` mit `credentials:'include'` —
   die API kennt keinen Cookie-Pfad). Die Eigentümer-Ausnahme griff damit ausgerechnet auf
   der Seite nicht, für die sie gedacht war: beim eigenen zurückgezogenen Inserat gab es
   404, `isOwner` blieb false, und Düzenle **und** Sil verschwanden. Jetzt über `ve`.
6. **Der Admin-Papierkorb riss den API-Prozess mit.** Im 404-Zweig wurde die Verbindung
   freigegeben und danach noch einmal im `finally`; `pg` wirft beim zweiten `release()`
   synchron, nach der bereits gesendeten Antwort — Express fängt das aus einem
   async-Handler nicht ab. Ein Doppelklick genügte. Jetzt läuft die Existenzprüfung über
   den Pool, die eigene Verbindung wird genau einmal freigegeben. Belegt: drei Klicks
   hintereinander, API lebt.
7. **Der Speichern-Knopf blieb nach einem Fehlschlag dauerhaft auf „Kaydediliyor…".**
   `setSpeichert(true)` hatte keine Gegenstelle, und `setBearbeiteVorgabe(p => p)` löste
   kein Neurendern aus. Der Nutzer konnte die Maske nur noch schließen — und verlor dabei
   genau die Eingaben, die der Fehlerzweig schützen sollte. Jetzt gibt `onSave` ein
   Versprechen zurück, die Maske fängt den Fehler, zeigt ihn im Formular und gibt den Knopf
   frei.
8. **`#yeni:00` umging die Entdoppelung** — zwei Fotozeilen auf dieselbe Datei. Wird jetzt
   über die Zahl entdoppelt, nicht über die Zeichenkette.
9. **Keine Wertprüfung:** `fiyat=0` und negative Preise wurden gespeichert, ein zu langer
   Titel erzeugte einen 500er mit rohem Postgres-Text. Jetzt 400 mit klarer Meldung für
   Preis, Titellänge und Zustandscode; rohe SQL-Meldungen gehen nicht mehr an den Aufrufer.
10. **Gelöschte Inserate blieben im Suchindex** und wurden über `/api/arama` weiter
    ausgeliefert. `meiliSync.deleteListing()` läuft jetzt beim Löschen (beide Pfade),
    `syncListing()` beim Bearbeiten. **Die Admin-Löschung schrieb außerdem keinen
    `audit_log`-Eintrag** — jetzt schon.

Kleinere Nachzüge: Profilseite warnte noch mit dem alten, harmlosen Text vor der jetzt
endgültigen Löschung; ein gespeicherter Bezirk, den `data/cities.ts` nicht kennt, fiel beim
Bearbeiten aus dem Auswahlfeld und wäre beim Speichern verloren gegangen.

*Widerlegt und deshalb nicht geändert:* Ein Prüfer hielt den Prozessabsturz (Fund 6) für am
laufenden System auslösbar; die Gegenprüfung zeigte, dass er ihn nur in einer isolierten
Instanz reproduzieren konnte. Behoben wurde er trotzdem — die Ursache war echt.

**„Favorilerim" riss die ganze Seite weiß.** Von der Gegenprüfung gefunden, bestand schon
vorher. Ursache: `GET /api/favoriler` antwortet mit `{ ilanlar: [...] }`, der Client sagte
aber `ve.get<Listing[]>` zu — eine Typzusage, die TypeScript nicht prüfen kann, weil sie
erst zur Laufzeit gilt. Das Dashboard setzte das **Objekt** unverändert als Liste:
`favoriler.length` war `undefined`, der Leerzustand griff deshalb nicht, und der
Else-Zweig rief `.map(...)` auf einem Objekt auf. Belegt mit `A.map is not a function` und
einer Seite mit Textlänge 0 — React reißt bei einem Fehler im Rendern den ganzen Baum ab,
also verschwindet auch Navigation und Fußzeile.

Behoben an der Wurzel: `favorilerApi.getAll()` packt jetzt aus **und** bildet über
`ilanZuListing` ab. Beides war nötig — die Rohzeilen tragen `baslik`/`fiyat`, nicht
`title`/`price`; ohne die Abbildung hätten die Karten leere Titel und „0 ₺" gezeigt.
Zusätzlich eine Wache beim Setzen und beim Rendern (`Array.isArray`), damit eine geänderte
Antwortform nie wieder die Seite mitreißt.

**Gegenprobe für die übrigen Reiter:** Alle Endpunkte des Dashboards wurden mit ihrer
tatsächlichen Antwort verglichen. `/teklifler`, `/sikayet/benim`, `/kayitli-aramalar` und
`/degerlendirme/son` liefern Arrays; `/kazanc` und `/ilanlar/benim` liefern Objekte, werden
dort aber korrekt ausgepackt. `/favoriler` war die einzige Fehlstelle.

**Fehlergrenze um die Dashboard-Reiter** (`src/src/components/FehlerGrenze.tsx`). React
bricht beim Fehler im Rendern den gesamten Baum ab — deshalb riss ein einzelner kaputter
Reiter bisher die ganze Seite weiß, samt Navigation und Fußzeile. Jetzt erscheint an der
Stelle des Reiters eine Meldung im Seitendesign („Bu bölüm yüklenemedi", mit *Tekrar Dene*),
während Seitenleiste, Navigation und Fußzeile stehen bleiben. Der Schlüssel ist der Reiter,
damit eine Meldung beim Wechseln verschwindet.

**Ein erster Anlauf griff nicht, und der Grund ist lehrreich:** eine Fehlergrenze fängt nur
Fehler im Render ihrer **Nachfahren**. Der fehlerhafte Ausdruck stand aber direkt im JSX von
`Dashboard` selbst (`{favoriler.map(…)}`) — er wirft, während React *Dashboard* rendert, und
die Grenze ist da noch gar nicht an der Reihe. Der Test zeigte weiterhin Textlänge 0.
Behoben mit der Hülle `<Inhalt render={() => …}>`, die den Ausdruck erst in ihrem eigenen
Render auswertet und ihn damit zu einem Kind-Render macht. Der Komponententyp bleibt stabil,
es wird also nichts bei jedem Durchlauf neu eingehängt.
*Belegt:* Der alte Favorilerim-Fehler wurde zum Test vorübergehend wieder eingebaut — vorher
Textlänge 0 und `P.map is not a function`, nachher Meldung im Bereich, Navigation und
Seitenleiste erhalten, Reiterwechsel räumt sie ab. Danach zurückgebaut; alle neun Reiter
laden fehlerfrei.

**Lösch-Bestätigung als eigenes Modal** (`src/src/components/OnayModal.tsx`) statt
`window.confirm()`. Das native Fenster sieht auf jedem Gerät anders aus, schreibt
„kapbeni.com says…" darüber und passt zu nichts auf dieser Seite; auf iOS lässt es sich
zudem unterdrücken. Die Optik ist keine Neuerfindung, sondern dieselbe wie beim
Şikayet-Dialog in `pages/Details.tsx`: dunkler Überzug, weiße Karte `rounded-2xl`, zwei
gleich breite Knöpfe `rounded-xl` (grau abbrechen, rot bestätigen), Tabler-Icon im
getönten Quadrat. Text unverändert übernommen. Escape und Klick daneben schließen,
der bestätigende Knopf bekommt den Fokus.
Umgestellt an **allen vier** Stellen, an denen ein Inserat gelöscht wird: Bearbeiten-Maske
(`SellModal`), Detailseite (`Details`), Profilseite (`Profile`) und Admin-Tabelle
(`AdminPanel`). Im Frontend gibt es jetzt kein `confirm()` mehr.
*Achtung beim Nachbauen:* Beim Umstellen von `Profile.tsx` war die Bestätigung kurzzeitig
ersatzlos entfernt — `deleteListing` löschte ohne Rückfrage. Beim Ersetzen eines `confirm()`
immer prüfen, dass das Modal die Abfrage wirklich übernimmt.

**Nach dem Löschen bleibt man, wo man war.** Vorher stand in zwei Pfaden fest
`setActiveTab('home')` — wer aus „İlanlarım" heraus löschte, landete auf der Startseite und
verlor den Ort, an dem er gerade arbeitete. Jetzt merkt sich `loeschHerkunftRef` beim
Öffnen eines Inserats (`selectProduct`) und beim Öffnen der Bearbeiten-Maske, woher der
Nutzer kam; nach dem Löschen führt der Weg dorthin zurück: `dashboard` → Panel,
Reiter „İlanlarım"; `profil` → Profilseite; sonst in die gewählte Kategorie und erst als
letztes auf die Startseite.
*Belegt:* Löschen über „Düzenle" aus İlanlarım → bleibt auf `#/panel/ilanlarim`. Karte im
Dashboard öffnen, auf der Detailseite „Sil" → ebenfalls zurück auf `#/panel/ilanlarim`
(vorher landeten beide Wege auf `#/`). Abbrechen löscht nichts und lässt die Maske offen.

**Navigation nach dem Löschen — zweiter Anlauf, jetzt über die Browser-Historie.**
Der erste Versuch merkte sich die Herkunft in einem Ref (`loeschHerkunftRef`). Das hielt
nur, solange die Seite nicht neu geladen wurde — nach einem Reload oder beim Einstieg über
einen geteilten Link war die Herkunft weg und der Nutzer landete doch wieder auf der
Startseite. Der Ref ist entfernt.

Jetzt gilt eine einzige Regel in `nachDemLoeschen()`: **nur navigieren, wenn gerade die
Detailansicht genau dieses Inserats offen ist** — die kann nicht stehen bleiben. Wird aus
einer Liste heraus gelöscht (Panel „İlanlarım", Profilseite), bleibt die Ansicht wie sie
ist und nur die Liste baut sich neu auf. Für den Detailfall übernimmt der vorhandene
`zurueck()`-Helfer: er nutzt die Browser-Historie und führt dorthin, wo der Nutzer wirklich
herkam. Gibt es keinen eigenen Verlauf (Reload, geteilter Link), geht es ins Panel statt auf
die Startseite — wer sein eigenes Inserat löscht, verwaltet Inserate.

**Wichtig dabei:** `selectedListing` wird in diesem Zweig **nicht** geleert. Sonst sieht der
Effect „details ohne Inserat → Startseite" den Zwischenzustand und springt nach Hause,
bevor `popstate` die richtige Ansicht herstellt.

*Belegt, live auf kapbeni.com:* Panel → Düzenle → Sil → `#/panel/ilanlarim` (Liste 7 → 6).
Panel → Karte → Detail → Sil → `#/panel/ilanlarim`. Detail nach Seiten-Neuladen → Sil →
`#/panel/ilanlarim`. Profilseite → Sil → `#/profil`. Kategorie → Detail → Sil →
`#/kategori/elektronik`. Auf 390 px ebenso.

**Dabei die eigentliche Ursache gefunden: ein Fehlschlag von `/api/auth/ben` warf den Nutzer
aus seiner Sitzung.** `AuthContext` löschte den Token bei **jedem** Fehler:
```js
.catch(() => { localStorage.removeItem('sg_token'); setToken(null) })
```
Gleichzeitig lag auf `/api/auth` ein Limit von **20 Anfragen je 15 Minuten** — und
`GET /auth/ben` läuft bei jedem Seitenaufruf mit. Nach rund zwanzig Seitenaufrufen kam 429,
der Token flog raus, `isLoggedIn` ist `!!user` und damit false: der Nutzer sah sich plötzlich
abgemeldet auf der Startseite. Das erklärt das gemeldete Symptom besser als jeder Redirect
im Lösch-Handler.

Zwei Korrekturen:
- `api/src/index.js`: das enge Limit gilt jetzt nur für `/api/auth/giris` und
  `/api/auth/kayit` (Zugangsdaten, Brute-Force-Schutz bleibt: 20 je 15 Minuten).
  `/api/auth/ben` ist ein billiger, angemeldeter Lesezugriff und bekommt 60 je Minute.
- `context/AuthContext.tsx`: nur eine **echte** Ablehnung (401) beendet die Sitzung. Bei
  einem 429, 500 oder Netzaussetzer bleibt der Token liegen und es wird einmal nachgefasst.
*Belegt:* 30 Aufrufe von `/auth/ben` → 30 × 200; 25 Fehlanmeldungen an `/auth/giris` →
20 durchgelassen, 5 × 429.

---

### ⚠ Vorfall 2026-09-12 — vier echte Inserate durch einen Testfehler gelöscht

**Was passiert ist.** Beim Prüfen der Lösch-Navigation habe ich Browser-Tests gegen die
Live-Seite gefahren. Der Selektor griff daneben:
```js
[...document.querySelectorAll('div.relative')].filter(x => /ZZ Redirect/.test(x.innerText))
```
`div.relative` trifft nicht nur die einzelne Karte, sondern auch **jeden umschließenden
Container**, dessen Text irgendwo „ZZ Redirect" enthält. `k[0]` war deshalb der äußerste
Container, und `k[0].querySelector('img')` bzw. `…querySelector('button…')` landete auf der
**ersten Karte im Raster** — nicht auf dem Testinserat.

**Betroffen** (alle Konto `users.id=1`, laut `audit_log`):
| id | Titel | Zustand | Zeit |
|---|---|---|---|
| 23 | Matbaa Isler A5 1000 Adet | pasif | 11:42:43 |
| 13 | Asus Notebook | pasif | 11:42:55 |
| 11 | Asus Notebook | pasif | 11:46:27 |
| 12 | Asus Notebook | **aktif** | 12:04:31 |

**Wiederhergestellt:** ids 11, 12, 13 samt Fotozeilen aus
`/opt/_archiv/kapbeni-freeze-20260911-134115`, mit ihren ursprünglichen IDs, in einer
Transaktion; `ilanlar_id_seq` nachgezogen. Der Bestand entspricht danach wieder exakt dem
Freeze (11 Inserate, 9 aktiv, keine verwaisten Fotozeilen).

**Nicht wiederherstellbar:** `Matbaa Isler A5 1000 Adet` (id 23, uuid
`7753dd06-116a-48b1-80d5-08ed2c65ed0b`). Es wurde am 12.09. um 09:09 angelegt — nach dem
letzten Freeze. Das `audit_log` hält nur das Moderationsergebnis fest, keinen Inhalt; die
Bilddatei wurde beim Löschen mit entfernt. Bekannt sind nur Titel, Eigentümer, Zustand
(`pasif`) und dass es ein Foto hatte.

**Lehren, die ab jetzt gelten:**
1. **Keine schreibenden Browser-Tests gegen kapbeni.com.** Der Teststand `:3003` liefert
   dasselbe Bundle und dieselbe API; es gab keinen Grund, live zu testen.
2. **Testdaten gehören dem Testkonto** (`users.id=15`), nie dem echten Konto. Dann trifft
   ein danebengreifender Selektor im schlimmsten Fall wieder nur Testdaten.
3. **Selektoren müssen die Karte treffen, nicht irgendeinen Vorfahren.** Verlässlich ist der
   Weg über das Titel-Element und `closest()`, nicht ein Filter über `innerText` eines
   Containers.
4. **Vor zerstörenden Testläufen einen Freeze ziehen** — der vorhandene war einen Tag alt,
   und genau das eine Inserat, das dazwischen entstand, ist verloren.

**Zu große Videos werden verkleinert statt abgelehnt.** Vorher wies die Maske alles über
20 MB ab. Jetzt nimmt der Server bis **100 MB** an und rechnet herunter, was über 20 MB liegt.

*Gemessen* auf dieser Maschine (6 Kerne, ffmpeg 6.1.1, kein nutzbarer GPU-Encoder), Quelle
65 MB / 1080p / 30 fps / 40 s:

| Ziel | Wanduhr | CPU | RAM | Ergebnis |
|---|---|---|---|---|
| **720p CRF 28** | **17,7 s** | 80,6 s (≈4,6 Kerne) | 268 MB | **10,8 MB** |
| 720p CRF 26 | 18,0 s | 85,3 s | 268 MB | 16,5 MB |
| 1080p CRF 30 | 28,3 s | 129,4 s | 452 MB | 36,7 MB |

Daher 720p bei CRF 28. Die Rechenzeit skaliert praktisch linear: eine Minute Material ≈ 27 s.
Live belegt: 65 MB → **11 MB in 15,8 s**, 1280×720 h264.

*Umsetzung* — `api/src/lib/video.js` (neu) plus `videoUebernehmen()` in `routes/ilanlar.js`:
- **ffmpeg läuft als eigener Prozess**, blockiert die Ereignisschleife also nicht. Die Grenze
  ist die CPU, nicht Node.
- Höchstens **2 gleichzeitige Läufe** (eine eigene kleine Schlange, kein fremdes Paket) —
  einer belegt schon ~4,6 von 6 Kernen. Harte Zeitgrenze 5 Minuten je Lauf.
- **Das Video geht auf die Platte, nicht in den Arbeitsspeicher.** multer lief mit
  `memoryStorage`; bei 100 MB läge die Datei vollständig im RAM des einen API-Prozesses, und
  die Maschine hat knapp 3 GB. Eine eigene Storage-Weiche schickt nur das Feld `video` auf
  die Platte, Bilder bleiben im Speicher (sharp arbeitet ohnehin auf Puffern).
- **Ein iPhone-MOV wird jetzt immer umgerechnet.** Vorher landete es unverändert unter der
  Endung `.mp4`, der Container blieb aber QuickTime.
- Im Bearbeiten-Pfad läuft das Umrechnen **vor** der Transaktion und schreibt ins
  Zwischenverzeichnis; verschoben wird erst nach dem COMMIT — dieselbe Ordnung wie bei den
  Bildern.
- nginx: `client_max_body_size` 60M → **120M**, `proxy_read_timeout` und `proxy_send_timeout`
  auf **300 s** (die Vorgabe von 60 s hätte die Verbindung mitten im Umrechnen gekappt).

**Dabei gefunden: ein kaputtes Video ging als 201 durch.** Eine beliebige Datei mit dem
MIME-Typ `video/mp4` wurde ungeprüft abgelegt, solange sie klein genug war — das Inserat
meldete „İlanınız yayında!", die Galerie zeigte ein totes Element. Der MIME-Typ kommt aus dem
Multipart-Header des Clients und sagt nichts über den Inhalt. `videoLib.pruefen()` lässt jetzt
**ffprobe** über die Datei laufen, **vor** dem Anlegen. Belegt: kaputte Datei → 400, kein
Geisterinserat.
**Und ein zweiter Fund beim Aufräumen:** bei jedem frühen Abbruch (falsches Format, zu viele
Fotos, Rechtefehler) blieb die Rohdatei im Zwischenverzeichnis liegen, weil
`videoUebernehmen()` gar nicht erst lief. Das Aufräumen hängt jetzt an `res.on('finish')` und
greift damit unabhängig vom Ausgang. Belegt: drei Fehlschläge hintereinander → 0 Reste.

---

**„Konumu Kullan" in der Erstellmaske.** Neuer Knopf über den Feldern Şehir/İlçe. Bei
erteilter Freigabe werden beide vorbelegt; verweigert der Nutzer, bleibt die Auswahl von Hand
unverändert möglich.

*Befund vorweg:* Şehir/İlçe sind zwei `<select>` aus der **statischen** Datei
`data/cities.ts` (80 Städte — Aksaray fehlt —, 971 Bezirke, **keine Koordinaten**). Die DB hat
saubere Tabellen `iller` (81) und `ilceler` (973), ebenfalls ohne Koordinaten, und
`ilanlar.il_id`/`ilce_id` sind überall NULL. Die Routen `/api/iller` benutzt kein Frontend.
Ein Koordinaten-Datensatz existiert nirgends, PostGIS ist nicht installiert.

*Gewählter Weg:* Nominatim, aber **über den eigenen Server** — neue Route
`GET /api/iller/konum?lat=&lon=`. Drei Gründe: die Position des Nutzers geht nicht direkt an
einen Dritten (OSM sieht nur unsere Server-IP), der von Nominatim verlangte User-Agent lässt
sich nur serverseitig setzen (im Browser wird der Header verworfen — `pages/Discover.tsx`
versucht es bis heute vergeblich), und wir können zwischenspeichern und die Regel von
höchstens einer Anfrage je Sekunde einhalten.

Die Antwort wird gegen `iller`/`ilceler` geprüft, statt sie zu übernehmen. Zwei Eigenheiten
sind eingebaut: Nominatim stellt dem Bezirk oft den Provinznamen voran („Nevşehir Merkez" →
unsere Liste führt „Merkez"), und Schreibweisen weichen ab — deshalb eine türkisch-bewusste
Faltung (`İ/I/ı→i`, `ş→s`, `â→a` …), identisch auf beiden Seiten.

*Belegt* (lesend über HTTPS, ohne Absenden): Kadıköy → İstanbul/Kadıköy · Antalya →
Antalya/Muratpaşa · Göreme → Nevşehir/Merkez · Paris → 404 mit klarer Meldung · ungültige
Koordinaten → 400 · zweiter Aufruf derselben Position 37 ms aus dem Zwischenspeicher.
Verweigerte Freigabe → „Konum izni verilmedi…", Auswahl weiter bedienbar.

**Wichtig für künftige Tests:** Geolocation verlangt einen **sicheren Kontext**. Auf dem
Teststand `http://192.168.50.100:3003` verweigert der Browser grundsätzlich — der Knopf lässt
sich dort nicht prüfen. Die Prüfung lief deshalb rein lesend über `https://kapbeni.com`:
Maske öffnen, Knopf drücken, Werte ablesen, schließen. Kein Absenden, keine Testdaten.

---

**Nach dem Anlegen bleibt man, wo man war.** `App.tsx` hatte im Erfolgszweig von
`submitListing` ein unbedingtes `setActiveTab('home')` — wer aus „İlanlarım" heraus ein
Inserat anlegte, landete auf der Startseite. Dieselbe Regel wie beim Löschen: nur navigieren,
wenn die aktuelle Ansicht nicht stehenbleiben kann. Die Erstellmaske ist ein Overlay **ohne
eigene Route**, die Ansicht darunter kann also immer bleiben — die Zeile entfällt ersatzlos.
Dazu `setListenSignal`, sonst bliebe ein offenes „İlanlarım" veraltet. `selectedListing` wird
dabei nicht angefasst, sonst greift das Sicherheitsnetz „details ohne Inserat → Startseite".
*Belegt:* Anlegen aus `#/panel/ilanlarim` → bleibt dort, Liste 0 → 1.

---

### ⚠ Vorfall 2026-09-12 (zweiter) — Prüf-Agent löschte erneut zwei echte Inserate

Beim Befund zu diesen drei Punkten löschte einer der Prüf-Agenten um 12:31 die Inserate
**id 11 und id 13** (beide „Asus Notebook", `pasif`) über die API mit einem Token für
`users.id=1` — obwohl im Auftrag ausdrücklich stand: *„Testdaten NUR fuer das Testkonto
users.id=15, niemals fuer users.id=1"* und *„Die vorhandenen Inserate (ids 1-8, 11, 12, 13)
NICHT veraendern oder loeschen."* Vermutlich hielt er die zwei gleichnamigen pasiven
Einträge für eigene Rückstände.

Beide wurden erneut aus `/opt/_archiv/kapbeni-freeze-20260911-134115` wiederhergestellt,
mit ihren IDs und Fotozeilen. Stand danach: 12 Inserate, darunter das neue `id 14
„Matbaa El Afisi A5"` des Betreibers, unberührt.

**Verschärfte Regel, ab sofort:** Prüf-Agenten dürfen **überhaupt kein Token für `users.id=1`
erzeugen** — nicht für Lese-, nicht für Schreibzugriffe. Wer Eigentümer-Rechte braucht,
nimmt `users.id=15`. Ein Verbot, bestimmte Datensätze anzufassen, reicht nicht: es setzt
voraus, dass der Agent sie zuverlässig erkennt.

**Bilder-Modal (Lightbox) auf der Detailseite.** Ein Klick auf das Produktbild öffnet die
Bilder gross: durchblätterbar mit Pfeilen, Pfeiltasten, Wischen und Vorschaukacheln;
schliessbar per X, Klick daneben und Escape. Der Hintergrund scrollt nicht mit.

*Keine zweite Datenquelle:* Die Lightbox nutzt dieselbe Liste `stationen` wie die Galerie
auf der Seite. Dafür musste sie aber erst erreichbar werden — sie stand in einer **sofort
ausgeführten Funktion mitten im JSX**, und `stationen`, `i` und `springe` lebten nur
innerhalb dieses Render-Ausdrucks. Aus einem `useEffect` (Tastatur) oder einem über
`createPortal` gerenderten Modal war daran nicht heranzukommen. Jetzt auf Komponentenebene:
`stationen` als `useMemo`, `springe` als `useCallback`.

**Dabei ein bestehender Fehler behoben:** `springe` rechnete mit dem rohen `aktiv` statt mit
dem geklammerten Index. Liefert die Detail-Antwort weniger Stationen als vorher (Foto
gelöscht, Video entfernt), stand `aktiv` ausserhalb — und der Pfeil sprang von einer
unsichtbaren Position aus weiter.

*Einzelheiten:* Nur Fotos öffnen die Lightbox, beim Video nicht — dort würde der Klick mit
den eingebauten Bedienelementen kollidieren. Die Hülle folgt `components/OnayModal.tsx`
(Backdrop-Klick, `stopPropagation`, `role="dialog"`/`aria-modal`, Escape) und rendert über
`createPortal` an `document.body` wie die übrigen neun Overlays — sonst hinge sie im
Detail-Container mit seinen Radien und `overflow-hidden` fest. z-Index **100**: belegt waren
bis dahin 30/40/50/60/70/80/90/95 und 200 (Paket-Modal), das aber nie gleichzeitig offen ist.
Wischen und Scrollsperre gab es im Projekt bisher nirgends; beides ist bewusst schlicht
gehalten (waagerechte Strecke ab 50 px, `body.overflow` mit Wiederherstellung beim Schliessen).

*Belegt:* Öffnen → „1 / 2", 2 Kacheln, Scrollsperre aktiv. Pfeil vor → „2 / 2", Pfeiltaste ←
→ „1 / 2", aktive Kachel wandert mit. Escape, Klick daneben und X schliessen, Scrollsperre
wird aufgehoben. Auf 390 px: Tippen öffnet, Wischen ← blättert vor, Wischen → zurück, kein
waagerechter Überlauf. Der Überzug misst `srgb(25,25,25)` — genau die 10 % Durchschein von
`bg-black/90`.

---

**Wasserzeichen auf allen hochgeladenen Inseratsbildern.** Serverseitig beim Verarbeiten,
nicht als CSS-Überlagerung — die liesse sich mit einem Rechtsklick umgehen, weil `/uploads/`
die Originaldatei direkt ausliefert.

*Neu: `api/src/lib/bild.js`.* Beide sharp-Ketten (Anlegen `ilanlar.js:416`, Bearbeiten
`:549`) waren **wortgleich** und wurden zu einem Helfer zusammengezogen. Zwei Kopien hätten
sonst irgendwann auseinandergedriftet, und Bilder aus dem Anlegen sähen anders aus als aus
dem Bearbeiten. Der Helfer gibt immer einen **Puffer** zurück; der Bearbeiten-Pfad braucht
das so, weil dort erst nach dem COMMIT geschrieben wird.

*Werte, an echten Produktfotos verglichen* (Auto, Telefon, Sessel):

| Deckkraft | Wirkung |
|---|---|
| 16 % | auf hellen Flächen fast verschwunden |
| **22 %** | **überall lesbar, Produkt vollständig sichtbar** |
| 28 % | legt sich spürbar über die Ware |

Gewählt: **22 %, diagonal −30°, 65 % der Bildbreite, mittig**. Vorlage ist
`logo-footer.png` (heller Schriftzug, rotes Zeichen) — `logo-navbar.png` ist dunkelblau und
verschwindet auf dunklen Fotos; bei der hellen Fassung trägt wenigstens das Rot überall.

*Kosten, gemessen an einem 4000×3000-Bild über acht Durchläufe:*

```
ohne Wasserzeichen  216 ms je Bild, 30 KB
mit  Wasserzeichen  266 ms je Bild, 35 KB
Aufschlag           +49 ms (+23 %),  Datei +15 %
```

Bei acht Bildern gut 0,4 s — neben der Upload-Dauer nicht wahrnehmbar. Das Zeichen kommt
**nach** dem Skalieren und **vor** der WebP-Kodierung, es gibt also keinen zweiten
Kodierdurchgang. Das gedrehte, abgedunkelte Logo wird je Bildgrösse einmal erzeugt und
wiederverwendet (Zwischenspeicher auf 40 Einträge begrenzt).

**Stolperstein beim Bauen:** Durch die Drehung wächst der Rahmen des Logos — ein 2:1-Logo
bei 65 % Bildbreite ist nach 30° höher als ein querformatiges Bild, und sharp lehnt ein
Overlay ab, das grösser ist als das Ziel (`Image to composite must have same dimensions or
smaller`). Das Zeichen wird jetzt auf 92 % der Bildfläche begrenzt.

**Zweiter Fund, mitbehoben:** Keine der sharp-Ketten rief `.rotate()` auf. Ohne das verwirft
sharp die **EXIF-Ausrichtung**, und WebP trägt kein Orientierungs-Tag — ein hochkant
aufgenommenes Handyfoto blieb dauerhaft quer. Für das Wasserzeichen doppelt wichtig: es sässe
sonst verdreht im Bild.

**Nicht angefasst:** Avatare (`users.js:14`, 400×400 mit `fit:'cover'` und runder Darstellung
— ein Logo wäre unlesbar oder verdeckte das Gesicht) und KYC-Bilder (laufen gar nicht durch
sharp, der Python-Dienst rechnet auf dem Rohbild).

**Kein rückwirkender Lauf** — und die Zahlen stützen das deutlich: von 14 Zeilen in
`ilan_fotograflar` zeigen nur **3** auf lokale Dateien, 9 auf fremde Adressen (Unsplash,
Google-Usercontent) und 2 enthalten Freitext statt eines Pfads. Von den 7 WebP auf der Platte
sind 4 verwaist. Ein Nachtrag beträfe also genau drei Dateien, würde aber unumkehrbar in
vorhandene Bilder schreiben. Wenn es später doch gewünscht ist: eigenes Skript mit Sicherung
und Trockenlauf.

---

## 4. Offene Punkte / Backlog

**Funktional**
- `DELETE /api/ilanlar/:uuid` löscht endgültig — es gibt **kein** „vorübergehend zurückziehen"
  mehr in der Oberfläche. Die Route `PUT /:id/yeniden` (wieder veröffentlichen) existiert
  weiterhin, wird aber von keiner Ansicht benutzt. Drei Inserate stehen noch auf `pasif`
  (ids 11, 13, 23) und sind nur noch für ihren Eigentümer sichtbar.
- **Neue Inserate landen nicht im Suchindex**: `meiliSync.syncListing()` wird beim Anlegen
  (`POST /api/ilanlar`) nicht aufgerufen, nur beim Bearbeiten und über den nächtlichen Lauf.
  Eine Suche nach einem frisch angelegten Inserat findet es deshalb nicht.
- Die Fehlergrenze schützt bislang nur die Dashboard-Reiter. Detailseite, Keşfet, Profil
  und Einstellungen haben keine — dort nimmt ein Renderfehler weiterhin die Seite mit.
  Dasselbe Muster (`FehlerGrenze` + `Inhalt`) ließe sich dort anwenden.
- Dateien ohne Inserat: vier Bilder vom 22.07. liegen verwaist unter
  `/uploads/ilanlar/`. Seit dem Lösch-Fix entstehen keine neuen mehr, die alten bleiben.
- Bearbeiten erfasst nur die Felder der Maske. `kargo_var`, `elden_teslim`, `kargo_ucreti`,
  `pazarlik` und `teklife_acik` kennt die Tabelle, aber weder Anlege- noch Bearbeiten-Maske.
- Teklif: keine Gegenangebote möglich (Verkäufer kann nur annehmen/ablehnen). Für eine
  echte Verhandlungshistorie bräuchte es eine Tabelle `teklif_karsi` o. ä. plus UI.
- `DestekMerkezi.tsx` ruft `/destek/tickets/:id` und `…/mesaj` auf — **dafür gibt es keine
  API-Routen** (nur `PATCH /ticket/:id` für Admins). Fehlende Backend-Routen, kein Tippfehler.
- Mehrere AdminPanel-Reiter laufen ins Leere (404): `teklifler`, `boost`, `paketler`,
  `mesajlar`, `kategoriler`, `hero`, `slider`, `oneriler`, `destek`.
- `startChat` (`App.tsx`) erzeugt lokale IDs `chat_${Date.now()}`; solche Chat-Links sind nicht
  teilbar und nach einem Reload leer. Zwei parallele Chat-Systeme (App-State vs. API).
- `api/src/routes/odeme.js:26` und `agim.js:23` verweisen hartkodiert auf die **entfernte**
  Domain `sattimgitti.transas24.com` (Zahlungs-Rückkehr-URL, Einladungslink).
- Ein aktives Inserat (Asus Notebook, id=12) hat keine `kategori_id`.
- **KI-Moderation antwortet nicht mehr**: `ai.service` protokolliert beim Anlegen eines
  Inserats `AI atlandı: 410 status code (no body)` — der NVIDIA-Endpunkt ist abgeschaltet.
  Der Rückfall (`{onaylandi:true, skor:70}`) sorgt dafür, dass jedes Inserat sofort `aktif`
  wird; faktisch findet **keine Moderation statt**. Fällt nicht auf, weil der Rückfall
  absichtlich freundlich ist.
- **Mock-Daten überdecken echte Inserate**: `data/mockData.ts` trägt dieselben UUIDs wie die
  DB-Inserate und dient als Anfangswert von `listings`. Bei einem Direktlink auf
  `#/ilan/<uuid>` findet `navAnwenden()` den Mock-Eintrag und zeigt dessen hartkodierte
  Werte, statt die API zu befragen; `categorySlug` fehlt dort, `category` enthält den Slug
  statt des Anzeigenamens. Saubere Lösung: bei einem Direktaufruf immer nachladen oder die
  Mock-Daten entfernen, sobald die API-Liste steht.
- Destek Merkezi und Paketler sind Vollbild-Overlays ohne eigene Route — Zurück verlässt dort
  die darunterliegende Ansicht.
- Scrollposition wird beim Zurückgehen nicht wiederhergestellt.

**Daten/Inhalt**
- Zwei Zeilen in `ilan_fotograflar` (ids 11 und 13) enthalten in der Spalte `url` keinen
  Pfad, sondern den Freitext „i5 Ismelnci Asus". `POST /api/ilanlar` übernimmt das Feld
  `foto_url` ungeprüft — deshalb konnte das überhaupt entstehen. Eine Prüfung auf eine
  brauchbare URL fehlt dort weiterhin.
- Vier der sieben WebP unter `/uploads/ilanlar` sind verwaist (keine Zeile verweist darauf).
- Die meisten Inseratsbilder liegen gar nicht bei uns, sondern sind externe Unsplash- und
  Google-Usercontent-Adressen — sie bekommen folglich auch kein Wasserzeichen.
- `hero_slider` enthält 7 gepflegte Slides, `GET /api/slider` liefert sie — **kein Bundle ruft
  sie ab**, die Startseite zeigt hartkodierte Slides. Texte tragen noch die alte Marke.
- 88 hartkodierte Unsplash-Bilder + Google-Usercontent als Platzhalter.
- Fahrzeug-Attribute: EAV-Schema (`kategori_ozellik_tanimlari`, 60 Definitionen, 198 Optionen)
  und `GET /api/ilanlar/ozellikler/:kategori_id` sind fertig — **kein Frontend nutzt sie**,
  `ilan_ozellik_degerleri` ist leer.
- `data/categories.ts` ist verwaist und kann gelöscht werden.

**Datenschutz**
- Detailseite verlinkt auf `google.com/maps` (früher: eingebettete OSM-Karte per Nominatim).

**Betrieb**
- `kapbeni-live-ref` (:3004) und `/opt/_vergleich` sind temporär und können nach Abschluss der
  Vergleiche entfernt werden.
- `pm2` zeigt für `kapbeni-api` einen historischen Restart-Zähler aus einem behobenen
  Crashloop; `pm2 reset kapbeni-api` setzt ihn zurück.
