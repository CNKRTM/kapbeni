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
/opt/kapbeni/Kapbeni_Prod/src/      Frontend-Quelle (src/) + Build (dist/)
/opt/kapbeni/api/src/routes/        API-Endpunkte
/opt/kapbeni/admin/server.js        Express-Admin (eigene Identitätsebene!)
/etc/kapbeni.env                    Secrets (JWT_SECRET, DATABASE_URL, …)
/var/www/kapbeni/uploads/           Upload-Verzeichnis
/opt/_archiv/kapbeni-freeze-*       Vollsicherungen (kapbeni-freeze.sh)
```

**Bauen und ausrollen**
```bash
cd /opt/kapbeni/Kapbeni_Prod/src && npx tsc --noEmit && npm run build   # → dist/
pm2 reload kapbeni-api --update-env                                      # nach API-Änderungen
```
Immer absolute `/opt/kapbeni`-Pfade verwenden. `dist/` wird von **drei** Vhosts ausgeliefert,
ein Build geht also sofort auf kapbeni.com live.

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

---

## 4. Offene Punkte / Backlog

**Funktional**
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
