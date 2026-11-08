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
| Medya Motoru (seit v1.28) | 3901 (nur 127.0.0.1) | `/opt/kapbeni/api/src/medyaMotoru.js` | `kapbeni-media` |
| Postgres | 5432 (nur localhost) | DB `sattigitti_db` | — |
| Redis | 6379 (nur localhost) | — | — |
| Meilisearch | 7700 (nur localhost) | `/opt/meilisearch` | — |

**nginx-Vhosts** (`/etc/nginx/sites-available/`):
- `kapbeni.com` — öffentlich (443), proxyt `/api/` → 3001 und `/kapbeniadmin/` → 3002
  (Admin unter `/kapbeniadmin/admin`, seit v1.7.1; `/admin` → 404)
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

**Wasserzeichen nutzt jetzt das Navbar-Logo.** Quelle gewechselt von
`logo-footer.png` auf `logo-navbar.png` — dieselbe Grafik, die unter
`https://kapbeni.com/logo-navbar.png` ausgeliefert wird.

*Zwei Klarstellungen zum Ausgangspunkt:* Das Wasserzeichen war **nie**
programmatisch nachgebaut; es hat von Anfang an eine echte Logodatei verwendet, nur eben die
helle Fassung. Und die Datei unter der URL ist **byte-identisch** mit der lokalen
(SHA256 `66c837ff…`, 823 692 B) — deshalb bleibt es beim Dateipfad statt eines Netzabrufs:
das Wasserzeichen soll nicht davon abhängen, ob beim Hochladen gerade eine Verbindung nach
außen steht.

*Transparenz geprüft:* `srgba`, 4 Kanäle, `hasAlpha=true`, mittleres Alpha 100. Der Kanal
bleibt beim Einbetten erhalten — `ensureAlpha()` sichert ihn ab, die Drehung bekommt einen
vollständig durchsichtigen Hintergrund, und die Deckkraft wird über den Alphakanal geregelt
(`dest-in`) statt über eine Hintergrundfläche. Gegenprobe an drei Punkten im
Wasserzeichenbereich eines fertigen Bildes: `srgb(196,196,192)`, `srgb(12,12,10)`,
`srgb(153,156,162)` — natürliche Bildwerte, also kein deckender Kasten um das Logo.

Position, Deckkraft und Drehung unverändert: 22 %, −30°, 65 % der Bildbreite, mittig.

*Zur Lesbarkeit:* Der Schriftzug dieser Fassung ist dunkelblau (#253147) statt hell. Auf sehr
dunklen Fotos tritt er zurück; dort tragen das rote Zeichen und die weiße Wagenkontur. Auf
hellen Fotos ist er deutlich besser lesbar als die vorherige Fassung. An drei frisch
hochgeladenen Bildern geprüft (hell, hell, dunkel).

### 2026-11-07

**Bestandsaufnahme nach acht Wochen Pause.** Server, GitHub und kapbeni.com standen
unverändert auf v1.6.1, Arbeitsbaum sauber. Abweichung von dieser Datei: der KYC-Dienst
lauscht auf `0.0.0.0:8001`, nicht nur lokal (ufw hält den Port von außen dicht). Neuer
Zugang für Claude-Sitzungen: Schlüssel `claude_srv` in `/root/.ssh/authorized_keys`.

**Freeze `kapbeni-freeze-20261107-195628`** — 410 MB, Prüfsummen OK, vor allen Änderungen.

**KI-Moderation neu — Claude Haiku statt NVIDIA (v1.7.0).** Drei Ursachen dafür, dass seit
Wochen *keine* Moderation stattfand:
1. NVIDIA hat `meta/llama-3.1-70b-instruct` am 26.08.2026 abgeschaltet (410). Fast alle
   übrigen Modelle antworten für dieses Konto mit 404; das einzig erreichbare
   (`mistral-large-4`) braucht 38–60 s je Aufruf — für das Anlegen eines Inserats untauglich.
2. Der Rückfall `{onaylandi:true, skor:70}` schaltete jedes Inserat ungeprüft frei.
3. **Die Richtung von `skor` war nirgends festgelegt.** Im Test bekam eine eindeutige
   Betrugsanzeige (IBAN-Vorkasse, iPhone für 4.500 TL) **98** — als Risikowert gemeint,
   vom Code (`skor >= 40` → aktiv) als „unbedenklich" gelesen.

Neu in `api/src/services/ai.service.js`, `moderasyonYap()`:
- Modell `claude-haiku-5-5` (überschreibbar per `KAPBENI_MOD_MODEL`), Schlüssel
  `ANTHROPIC_API_KEY` aus `/etc/kapbeni.env`, `@anthropic-ai/sdk` 0.27 → **1.6.0**.
- Antwortformat per JSON-Schema erzwungen (`output_config.format`), `effort: low`,
  Zeitgrenze 20 s, ein Wiederholversuch.
- `skor` ist ausdrücklich ein **Vertrauenswert**: 100 = unbedenklich, 0 = Betrug/Spam.
- Jeder Ausfall (kein Schlüssel, Zeitüberschreitung, 401, 429, Ablehnung, abgeschnittene
  Antwort) liefert `hata: true`. `routes/ilanlar.js` setzt `aktif` nur, wenn die Prüfung
  lief, freigab **und** `skor >= 40`; sonst `moderasyonda`. `ilanlar.ai_karar`
  (varchar 20) kennt dafür zusätzlich `hata`, `ai_score` bleibt dann NULL.

*Belegt* (getrennter Testordner, danach gelöscht): IBAN-iPhone 3 → Warteschlange,
IKEA-Sessel 92 → aktiv, „asdf test" 1 TL 5 → Warteschlange, Kinderwagen 88 → aktiv; je
1–3 s. Falscher Schlüssel → `anahtar geçersiz`, Warteschlange. Nach dem Ausrollen auf dem
Server erneut: Sessel 88 → aktiv.

**Admin-Seite „İlan Onayı"** (`admin/public/index.html`). Die Endpunkte
`GET /admin/api/ilanlar?durum=moderasyonda`, `…/:id/onayla`, `…/:id/reddet` gab es in
`admin/server.js` längst — **keine Oberfläche rief sie auf**. Wartende Inserate wären also
unsichtbar liegen geblieben. Jetzt eigener Menüpunkt unter İlanlar: Karte mit Bild,
Titel, Preis, Nutzer, Beschreibung (HTML-escaped), KI-Begründung und Abzeichen
(„KI-Prüfung ausgefallen" oder „KI-Güven <Wert>" in Rot/Gelb/Grün), Knöpfe Ansehen,
Onayla, Reddet (mit Grund). Die Dashboard-Kachel zeigt „İlan onayı bekliyor".

**Admin-Adresse verlegt (v1.7.1).** Öffentlich jetzt `https://kapbeni.com/kapbeniadmin/admin`.
nginx (`kapbeni.com`-Vhost) streicht `/kapbeniadmin` (`proxy_pass http://localhost:3002/;`),
der Dienst selbst sieht weiter `/admin` — `admin/server.js` blieb unverändert, im LAN gilt
weiter `http://192.168.50.100:3002/admin`. `location /admin` antwortet mit **404**.
IP-Sperre unverändert übernommen. Die Seite rechnet ihre API-Basis jetzt aus der eigenen
Adresse (`location.pathname` bis `/admin` + `/api`), statt fest `/admin/api` zu nehmen —
so funktioniert dieselbe Datei unter beiden Adressen. Sicherung des alten Vhosts:
`/root/kapbeni.com.nginx.bak-20261107`.
*Belegt:* `/admin` → 404, `/admin/api/dashboard` → 404, `/kapbeniadmin/admin` → 200,
`/kapbeniadmin/admin/api/dashboard` → 401 („Giriş gerekli").

**Schlüssel-Eintrag in `/etc/kapbeni.env`** — beim Bearbeiten von Hand war die Datei auf
`0644` gefallen (für alle lesbar); zurück auf `0600`. Sicherung
`/etc/kapbeni.env.bak-20261107` (ebenfalls `0600`).

### 2026-11-08

Arbeitspaket Website + API zu den Abschnitten F, H, L, M der Auftragssammlung (Admin folgt
durch einen späteren Agenten). Sechs Versionen, jede mit eigener Migration unter
`api/migrations/` und vorher `kapbeni-freeze.sh`.

**v1.9.0 — F: Telefon, TCKN, VKN.** Gemeinsame Prüfungen in `api/src/lib/dogrula.js` und
`Kapbeni_Prod/src/src/lib/dogrula.ts` (identische Regeln): `telefonNormalize()` → E.164
`+905XXXXXXXXX` (Nichtziffern weg, führendes `0090`/`90`/`0` ab, genau 10 Ziffern mit 5),
`telefonGoster()` → `+90 5XX XXX XX XX`, `tcknGecerli()` (Stelle 10/11), `vknGecerli()`
(GİB-Algorithmus, gegen echte VKN von Hepsiburada/Trendyol geprüft), `vergiNoGecerli()` (VKN
oder TCKN für Şahıs şirketi). Eingesetzt in `auth/kayit`, neuer Route `auth/kurumsal-kayit`
(AuthModal rief sie schon auf — sie fehlte, 404), `PUT users/profil`, `PATCH ayarlar`,
`gsm/gonder`, `satici-dogrulama`. Frontend: Komponente `components/TelefonInput.tsx` in
Registrierung (bireysel + kurumsal), Ayarlar, Profil-Modal, GSM-Modal. Ayarlar zeigt
Speicherfehler jetzt an (vorher `catch {}`) und geht über `ve.patch` statt rohem fetch.
Kurumsal-Angaben: `firma_adi`, `vkn`, `mersis_no` gab es schon, **`users.vergi_dairesi`** neu;
MERSİS 16-stellig geprüft. **`users.test_verisi boolean default false`** angelegt, `id=15`
markiert. Migration `20261108_01_formulare_telefon.sql` (Funktion `kp_telefon_e164`):
**keine Konflikte** mit `users_phone_key`; umgestellt id 1 und 15; **nicht normalisierbar**
und unverändert: id 5 (`0000000000`) und id 6 (`0500000000`, Demo-Konto) — Platzhalter.

**v1.10.0 — F: İl/İlçe-Combobox.** `data/iller.ts` (`useIller`, `useIlceler`, Modul-Cache,
`tuerkischFalten`), `components/Combobox.tsx` (klappt nach unten, Tippen filtert, freie
Eingabe bleibt, Tastatur), `components/IlIlceAlanlari.tsx` (zwei Zellen, Raster beim
Aufrufer). Ersetzt die statische Liste in SellModal, Ayarlar (Profil + Adresse),
EditProfileModal und Keşfet-Filter. **`data/cities.ts` gelöscht** (80 İl, Aksaray fehlte).
„Konumu Kullan" in der Verkaufsmaske liest jetzt dieselben Tabellen; Keşfet ruft statt
Nominatim direkt aus dem Browser ebenfalls `GET /api/iller/konum` auf.

**v1.11.0 — L: Kundennummer.** `users.musteri_no` (unique, NOT NULL), Sequenz
`musteri_no_seq`, Trigger `trg_musteri_no` → `KP-<Jahr der Registrierung>-<7-stellig>`,
**fortlaufend ohne Neustart pro Jahr** (über 9 999 999 wird nicht abgeschnitten). Weil der
Trigger vergibt, bekommt auch ein künftiger Google-Login automatisch eine Nummer. Bestand
nach `created_at`: id 1 → `KP-2026-0000001`, 5 → …02, 6 → …03, 15 → …04. GRANT auf die
Sequenz für `sattigitti`. API: `/auth/ben`, `/ayarlar`, Registrierung, Login,
`GET /ilanlar/:uuid` (`satici_musteri_no`, `satici_kayit_tarihi`, jetzt auch `satici_uuid`),
`GET /ilanlar` (Liste), `GET /satici/:id/profil` (`musteri_no`, `kayit_tarihi`). Frontend:
`components/UyeRozeti.tsx` (`UyelikChip` „Eylül 2026'dan beri üye" mit tr. Monatsnamen und
Suffix nach Vokalharmonie, `MusteriNo`) im Verkäuferkasten der Detailseite (ersetzt das
hartkodierte „Üyelik Tarihi: 2024"), Profil, Panel-Seitenleiste, Verkäuferprofil.

**v1.12.0 — M: Zustand + Marke.** Vier Codes `sifir | yeni_gibi | az_kullanilmis |
kullanilmis`, Bestand `ikinci_el` → `kullanilmis`, Default `kullanilmis`, CHECK
`ilanlar_durum_check` (NULL erlaubt für Kategorien ohne Zustand). Zentral:
`api/src/lib/ozellik.js` (`DURUM_KODLARI`, `tanimlarGetir`, `ozellikleriPruefe`,
`ozellikleriYaz`, `ilanOzellikleri`) und im Frontend `DURUM_SECENEKLERI`/`DURUM_ETIKET`/
`DURUM_KISA` in `api/index.ts` (alle lokalen Zustandstabellen entfernt). EAV: Feld „durum“
gelöscht; Marke einheitlich `alan_adi='marka'`, `tip='secim'`, freie Eingabe erlaubt
(`serbest`); Listen für 14 Hauptkategorien (Antika ohne Marke; Immobilien/Dienste gibt es im
Baum nicht), immer „Diğer“ am Ende. Fahrzeugfelder (Model/Yıl/KM/…) hängen jetzt an
`araba-araba` bzw. `motosiklet-marka`, damit Ersatzteile/Felgen sie nicht erben. Pflicht nur
noch Model/Yıl/KM bei `araba-araba`. Endpunkt `GET /ilanlar/ozellikler/:id`: Elternkette,
tiefere Ebene gewinnt bei gleichem `alan_adi`, Marke zuerst. POST/PUT speichern `ozellikler`
(JSON `{tanim_id: wert}`) in `ilan_ozellik_degerleri` (Unique-Index ilan+tanim), PUT ersetzt
in derselben Transaktion; Kategorie gewechselt ohne Werte → fremde Werte werden entfernt.
Detail liefert `ozellikler` + `durum_etiket`; Liste filtert `?durum=` (validiert) und
`?marka=`. Meili: Dokument trägt `marka`/`durum`, filterbar (Settings beim Start gesetzt),
`/api/arama?marka=&durum=`; **POST ruft jetzt `syncListing` auf**. SellModal: dynamische
Felder (Marke als Combobox, Select, Zahl), Zustand Pflicht, Knopf „KI ile açıklama öner“
(`/ilanlar/ai/aciklama-oner`, Vorschlag mit „Kullan“). Keşfet: Filter „Durum“.

**v1.13.0 — M: „Hızlı İlan Ver – 3 adımda“.** `components/HizliIlanModal.tsx` im OnayModal-Stil,
drei Schritte (Hazırlık / Başlık & açıklama / Yayınla), „Şimdi ilan ver“ öffnet die
Verkaufsmaske. Eigener History-Eintrag: Browser-Zurück schließt, X geht per
`history.back()`. Im Panel bei İlanlarım (Kopfzeile) und im Leer-Zustand.

**v1.14.0 — H: Kontolöschung.** Ein Weg in `api/src/lib/hesapSilme.js`:
`aktif → silme_bekliyor` (30 Tage) `→ silindi`. Antrag setzt laufende Inserate auf `pasif`
und merkt den alten Zustand in **`ilanlar.silme_oncesi_durum`**; Token werden sofort ungültig.
Anmeldung in der Frist widerruft (Inserate zurück, Hinweis `bilgi` in der Login-Antwort,
AuthModal zeigt ihn). Cron täglich 03:30 (Europe/Istanbul) in `lib/cron.js` anonymisiert:
Name, E-Mail (`silindi+<id>@silindi.kapbeni.invalid`), Telefon (`silindi-<id>`), TCKN-Hash,
TCKN als VKN, Ansprechpartner, Adresse, IBAN, Avatar u. a.; Passwort unbrauchbar, Inserate
`pasif`/`yayin_durum='kaldirildi'`, Adressen gelöscht, **musteri_no bleibt**. Zahlungen/
Rechnungen unberührt. `DELETE /api/users/me` läuft in denselben Ablauf. audit_log:
`hesap.silme_talebi`, `hesap.silme_iptal`, `hesap.anonimlestirildi`. Spalten für den Admin:
`durum`, `silinme_istegi`, **`silindi_at`** (neu). Bestätigungsmail über `utils/mailer.js`
(nicht an Testkonten). Login vergleicht E-Mail jetzt ohne Groß-/Kleinschreibung.

**Tests** — `api/tests/` (`node --test --test-concurrency=1 tests/`, 14 Tests, alle grün):
`_hilfe.js` erzeugt Token nur für Konten mit `test_verisi=true` und **verweigert id=1**.
Schreibende Tests legen eigene Konten unter `@test.kapbeni.com` bzw. ein eigenes Inserat
des Testkontos an und räumen sie wieder ab. Oberfläche: `api/tests/ui/masken.js`
(Playwright, 390 px und 1280 px, Szenarien iller, musteri, satis, hizli, silme; Fotos unter
`/tmp/kp-ui/`). Braucht `playwright-core` unter **`/opt/_pwtest`** (außerhalb des Repos) und
das vorhandene Chromium in `~/.cache/ms-playwright`. Achtung Rate-Limit `/api` 120/min:
Node-Tests und UI-Tests nicht direkt hintereinander ohne Pause laufen lassen.

**Arbeitspaket Admin (Auftragssammlung N, B, C) — v1.15 bis v1.21.** Sieben Versionen, je
eine Migration `api/migrations/20261108_05…08`, vor der ersten Datenmigration Freeze
`kapbeni-freeze-20261108-001313`.

*v1.15.0 — Sidebar nach Cankartım (B).* `admin/public/index.html`, Konfiguration `SIDEBAR`
(Gruppen TEMEL, PAZARYERİ, DESTEK, MUHASEBE & FİNANS, SİSTEM, GITHUB/DEPLOY; alle vorhandenen
Seiten einsortiert). Kopf mit `img/kapbeni-logo-acik.webp` und rotem Balken „YÖNETİM PANELİ“
(`#b61722`), Gruppen klappbar (`localStorage kp_sb_gruplar`), Zähler in Klammern aus
`GET /admin/api/sidebar-sayac` (İlan Onayı, Şikayetler, Riskli Mesajlar, KYC, Kurumsal Onay,
Destek; alle 60 s, Header `X-Kp-Arka`), Plakette YENİ 14 Tage ab `yeni:'JJJJ-MM-TT'`, Leiste
auf 72 px (`kp_sb_daralt`), Breite per Ziehen 220–420 px (`kp_sb_genislik`), am Handy
Schublade mit ☰. Fuß „Kap Beni vX · Commit“ aus `GET /admin/api/bau` (öffentlich; Hash per
`git rev-parse`, 60 s Cache — deploy.sh committet erst nach dem Neuladen). Vorbereitete
Einträge `hazirlaniyor:true` (Müşteri Akte, Medya Motoru, Yedekleme, Deploy Yönetimi, Test
Sunucu) zeigen „Hazırlanıyor“. **Hash-Routing** `#/<seite>[/<arg>]` (`aktuelleRoute`,
`routeAnwenden`, `hashchange`); Kundendetail `#/kullanicilar/<id>`; Alias `#/apibaglantilar`
→ `#/entegrasyonlar`. Logos als WebP unter `admin/public/img/` (aus `Kapbeni_Prod/src/public`,
mit sharp beschnitten/verkleinert), Static zusätzlich unter `/admin` (`index:false,
redirect:false` — sonst 301 auf `/admin/`, deploy.sh bricht ab). `admin_users.test_verisi`
neu (Migration 05).

*v1.16.0 — Entegrasyonlar (C).* Kern `api/src/lib/entegrasyon.js` (von API **und** Admin
benutzt): Anbieter claude, iyzico, smtp, resend, turnstile, google_musteri, google_admin,
netgsm (vorbereitet), r2 (vorbereitet), meilisearch, nominatim. Tabelle
`entegrasyon_ayarlari` (Migration 06): `credentials` = AES-256-GCM-Umschlag `{v,iv,tag,ct}`
mit **`INTEGRATION_ENCRYPTION_KEY`** (neu in `/etc/kapbeni.env`, per `openssl rand -hex 32`
erzeugt, 0600; Sicherung `/etc/kapbeni.env.bak-20261108-entegrasyon`). Lesereihenfolge je
Feld DB → .env → Standard, Herkunft wird angezeigt; Geheimfelder nur maskiert `••••1234`,
leer/Maske beim Speichern = unverändert, `__SIL__` leert. Cache 10 s je Prozess (Änderungen
aus dem Admin erreichen die API nach ≤ 10 s). Readiness wie Cankartım: Devre Dışı / Eksik /
Hazır / Doğrulanmış (letzter Test ok und nach der letzten Änderung). Tests lesend: Claude
`models.retrieve`, iyzico `installmentInfo` per IYZWSv2-Signatur **immer Sandbox** solange
nicht prod (Modus live auf Staging wird abgelehnt), SMTP `verify`, Resend `/domains`,
Turnstile `siteverify` (Testschlüssel bzw. Dummy-Token), Google Token-Endpunkt mit
unbrauchbarem Code (`invalid_grant` = Zugang stimmt), Meili `/health`+`/indexes`, Nominatim
reverse. API: `GET /admin/api/entegrasyonlar`, `POST …/:provider`, `POST …/:provider/test`,
`GET …/claude/modeller` (Modellliste). Speichern/Test nur `super_admin`; audit_log nur
Feldnamen. `/admin/api/api-durum` → 308 auf `entegrasyonlar`, `api-test` → 410. Claude-Modell
und An/Aus wirken in `services/ai.service.js` (`claudeAyar`). **Meili-Schlüssel** aus
`meili.js` entfernt → `MEILI_HOST`/`MEILI_MASTER_KEY` in `/etc/kapbeni.env` (Wert unverändert
übernommen). Nominatim-User-Agent aus der Integration (`routes/iller.js`).

*v1.17.0 — Admin-Login (N).* Zweigeteilt wie Medical: links `#1a2e4a` mit weißer Logo-Karte
(„Kap Beni – Yönetim Paneli“, „Test Staging Server“), rechts Staging-Banner, „Yönetici
Girişi“, Karte E-posta/Şifre/Turnstile-Platz/„Giriş Yap“/„Şifremi unuttum“, „Google ile
giriş“ (deaktiviert, „Yakında“), Hinweise yetkili personel + IP-Protokoll, Fuß Version ·
Commit, Compendus-Logo, „© Compendus Ltd. Şti. — …“. Unterseiten `#/giris`,
`#/sifremi-unuttum`, `#/yeni-sifre?t=`. Öffentlich `GET /admin/api/giris-yapilandirma`.
**Sitzungen** `admin_oturumlar` (Migration 07): Token trägt `sid`, `adminAuth` prüft Sitzung
(offen, nicht abgelaufen, Admin aktiv); alte Tokens ohne `sid` → 401 (jeder Admin musste sich
einmal neu anmelden). `POST /admin/api/cikis` schließt serverseitig, `GET /admin/api/ben`.
Jeder Versuch mit IP im audit_log (`admin.giris`, `admin.giris_hata`). Nebenbei: Eingabefelder
bekamen wieder Innenabstand (Tailwind-Preflight setzte `padding:0`, Selektoren mit `:not()`).

*v1.18.0 — Bildschirmsperre (N).* 15 min ohne Aktivität (Maus/Tasten/Scroll/Touch; Herzschlag
`POST /admin/api/aktivite` höchstens 1×/min) → `POST /kilitle`, Overlay mit Blur, Inhalt von
`#view` wird geleert; links Uhr, Datum tr, Compendus-Karte, KVKK-Hinweis; rechts Logo, „Ekran
kilitli“, Admin-Karte (Initialen, Name, Rolle), Passwort, „Kilidi aç“, „Başka kullanıcıyla
giriş / Çıkış“; Knopf „🔒 Kilitle“ oben. **Serverseitig**: `adminAuth` sperrt selbst, wenn
`son_aktivite` > 15 min (Hintergrundabrufe mit `X-Kp-Arka: 1` zählen nicht), und antwortet
gesperrt mit **423** außer `/ben`, `/kilit-ac`, `/cikis`, `/kilitle` — die Sperre übersteht
Reload. `POST /kilit-ac`: bcrypt, Limit 10 Fehlversuche/15 min je IP
(`skipSuccessfulRequests`), nach 5 Fehlern in der Sitzung wird sie geschlossen; audit
`admin.kilit`, `admin.kilit_ac`, `admin.kilit_ac_hata`, `admin.kilit_cikis`.

*v1.19.0 — Şifremi unuttum (N).* `admin_sifre_sifirlama` (Migration 08): Token 32 Byte
base64url, nur SHA-256 gespeichert, 30 min, einmal nutzbar (atomares UPDATE), ältere offene
Tokens verfallen. `POST /admin/api/sifre-unuttum` (5/15 min je IP, Antwort immer „Eğer bu
e-posta kayıtlıysa …“, audit `admin.sifre_unuttum` mit `bulundu`), `GET …/sifre-yenile/
kontrol`, `POST …/sifre-yenile` (≥ 10 Zeichen, groß, klein, Ziffer, nicht der E-Mail-Name;
schließt alle Sitzungen des Admins; audit `admin.sifre_yenilendi`). Link
`${ADMIN_PUBLIC_URL|https://kapbeni.com/kapbeniadmin/admin}#/yeni-sifre?t=…`.
**`api/src/utils/mailer.js` neu**: Resend (live) > SMTP (live, Rückfall `SMTP_*` aus .env) >
nur Protokoll; `logIcerik` (Reset-Link) steht nur außerhalb prod im pm2-Log. Rückgabe
`{gonderildi,kanal}`. Die Maske zeigt „gönderilmez, yalnızca sunucu günlüğüne yazılır“,
solange kein Kanal steht — heute der Fall.

*v1.20.0 — Turnstile (N).* Admin-Login, Şifremi unuttum (Admin), Kunden-Login, Bireysel- und
Kurumsal-Registrierung (`components/Turnstile.tsx` im AuthModal, `authApi.login/register`
mit `turnstile`). Öffentlich `GET /api/auth/yapilandirma` (Site-Key, Google-Status).
Server: `entegrasyon.turnstileDogrula()` — `test` (Standard) = offizielle Testschlüssel, keine
Prüfung; `live` = `siteverify`, ohne/abgelehntes Token 400 (`alan:'turnstile'`); `disabled`
oder fehlende Schlüssel = keine Prüfung. Das Widget rendert in einer Shadow-DOM — Tests
prüfen `input[name="cf-turnstile-response"]`, nicht das iframe.

*v1.21.0 — Google-Login vorbereitet (N).* Knöpfe im Admin-Login und AuthModal sichtbar,
deaktiviert mit „Yakında“, bis die Integration live und vollständig ist. Gerüst:
`GET /api/auth/google/baslat|callback` und `GET /admin/api/google/baslat|callback` (sonst
404), state als JWT (10 min), Code-Tausch + `tokeninfo` (aud, email_verified) in
`entegrasyon.googleCodeTausch`. Kunde: Konto per `google_id`/E-Mail, sonst Neuanlage
(`musteri_no` per Trigger, Telefon-Platzhalter `g-<sha1>` — offen, s. Backlog), Rückkehr
`/#/google-giris?token=` (AuthContext übernimmt). Admin: nur `izinliler` (E-Mail oder
`@domain`) **und** vorhandenes aktives `admin_users`-Konto, keine Neuanlage.

*Tests:* `api/tests/n_entegrasyon`, `n_admin_giris`, `n_admin_kilit`, `n_admin_sifre`,
`n_turnstile`, `n_google` (Suite jetzt 20 Tests, alle grün). `_hilfe.js`: `adminGiris()`,
`adminApi()` — nur Test-Admin `ui-test-admin@test.kapbeni.com` (`admin_users.id=3`,
`test_verisi=true`, Passwort zufällig in `/root/kp-admin-test.pw`, 0600). **Nach den Tests
deaktiviert** (`aktif=false`); für neue Läufe vorher `UPDATE admin_users SET aktif=true WHERE
id=3 AND test_verisi` und danach wieder aus. UI: `api/tests/ui/admin.js` (Szenarien sifre,
kilit, giris, entegrasyonlar, sidebar; 390/1280 px; `/tmp/kp-ui/admin-*.png`) und Szenario
`turnstile` in `masken.js`. Achtung: `pm2 reload a b` lädt nur `a` — Dienste einzeln neu
laden. Admin-Limits (Login 20, Entsperren 10, Şifremi unuttum 5 je 15 min) sind
In-Memory und setzen sich beim Neustart des Admins zurück.

**Arbeitspaket Kundenakte (Auftragssammlung A, G, H-Admin, L, M-Admin) — v1.22 bis v1.26.** Migrationen
`api/migrations/20261108_09…11`, Freezes `kapbeni-freeze-20261108-005729` (vor v1.22) und
`…-011444` (vor dem Seed).

*v1.22.0 — A: IP- und Ereignisprotokoll.* Tabelle **`musteri_olaylari`** (user_id FK CASCADE, olay,
hedef_tip, hedef_id, ip, sehir, ulke, isp, cihaz, tarayici, os, user_agent, detay, created_at; Indizes
user+zeit, zeit, ip, olay). Zentral **`api/src/lib/olay.js`**: `istemciIp(req)` (X-Real-IP **nur**
vom lokalen nginx), `geoBul(ip)` offline mit **geoip-lite** 1.4.10 (Il über den Regionscode = Plaka
aus `iller`, private IPs „Yerel ağ“, sonst „—“), `uaCoz()` mit **ua-parser-js 1.0.41** (MIT; v2 ist
AGPL — nicht hochziehen), `yaz()`/`kaydet()` (wirft nie, blockiert nie). ISP kennt geoip-lite nicht
→ „—“ (GeoLite2-ASN bräuchte einen MaxMind-Schlüssel, offen). Geschrieben bei: kayit, giris,
giris_basarisiz (mit sebep), ilan_olustur/duzenle (auch `PATCH /:id/fiyat`)/sil, ilan_kaldirildi,
ilan_reddedildi, mesaj (mit tehlikeli), teklif, sikayet, belge (KYC submit), hesap_silme_talebi,
hesap_askiya/aktif (Admin). `services/geoService.js` ruft **ip-api.com nicht mehr** auf (keine
Kunden-IP an Dritte) und schreibt zusätzlich weiter `kullanici_girisler`. Cron 04:00 löscht
Einträge > 2 Jahre (5651).

*v1.23.0 — G: Archiv beendeter Inserate.* Tabelle **`ilan_arsiv`** (Snapshot: Titel, Beschreibung,
Preis, Kategorie, Marke, Zustand, Ort, Merkmale, `bilder [{url, arsiv}]`, video, grund
`silindi|reddedildi|admin_kaldirdi|hesap_kapatildi`, grund_detay, kaynak, admin_id, ip, Zeiten).
**`api/src/lib/ilanArsiv.js`** ist der **eine** Löschweg (`ilanSilVeArsivle`) für Eigentümer
(`DELETE /api/ilanlar/:uuid`), SPA-Admin (`DELETE /api/admin/ilanlar/:uuid`) und Express-Admin
(`DELETE /admin/api/ilanlar/:uuid`, Grund Pflicht). Erhalten: Besitzprüfung (404), 409 bei offener
Transaktion (jetzt in der Transaktion mit `FOR UPDATE`), Belege `ilan_id=NULL`, Gebote gehen mit,
Dateien erst nach COMMIT, Meili-Delete, audit_log. Dateien werden **verschoben** nach
`/var/www/kapbeni/uploads/archiv/<musteri_no>/<uuid>/` (Namensschranke `<uuid>_` wie früher);
Ablehnen (`/admin/api/ilanlar/:id/reddet`) **kopiert** (Inserat bleibt). Kontoanonymisierung
(`hesapSilme.anonimlestir`) archiviert jetzt alle Inserate (`kontoArsivle`, Fotozeilen weg).
**Nie öffentlich:** API-Static sperrt `/uploads/archiv`, `/uploads/kyc_temp`, `/uploads/belgeler`
(404), nginx `location ^~ /uploads/archiv/ { return 404; }` in `kapbeni.com` und `kapbeni-prod`
(Sicherungen `/root/<vhost>.nginx.bak-20261108-arsiv`). Admin sieht Bilder über
`GET /admin/api/arsiv/dosya/:id/:n?t=` — `<img>` kann keinen Bearer senden, daher kurzlebiges
signiertes Token (30 min, mit `sid`; Sitzung muss offen und entsperrt sein). Cron 04:00 löscht
Snapshots > 2 Jahre samt Dateien.

*v1.23.1 — Rate-Limit je echter IP.* `api/src/index.js` hatte keinen `keyGenerator`: hinter nginx
teilten sich **alle** Besucher ein Limit (z. B. 20 Anmeldungen/15 min für die ganze Seite). Jetzt
Schlüssel = `olay.istemciIp`. Dabei: einige API-Dateien trugen nach dem Sync CRLF — auf LF
normalisiert. **Achtung für Agenten:** Python unter Windows schreibt mit `open(...,'w')` CRLF;
`newline=''` benutzen.

*v1.24.0/1.24.1 — L: Testkunden.* Migration 11: **`users.cinsiyet`** (`k`/`e`/NULL, CHECK) und
**`musteri_belgeleri`** (tur, dosya_url, durum bekliyor/onayli/reddedildi, red_sebebi, gecerlilik,
inceleyen_admin). Seed **`api/scripts/seed-testkunden.js`** (idempotent; `--sil` entfernt nur die 8
Konten per E-Mail-Liste **und** `test_verisi`, samt Inseraten, Dateien, Archiv, Ereignissen,
Nachrichten, Geboten, Beschwerden): Ayşe Yılmaz (k, aktiv), Mehmet Demir (e, nicht aktiv, riskante
Nachrichten, KYC manuell), Kaya Elektronik (kurumsal, onaylı, 10 Inserate), Zeynep Arslan (k, nicht
aktiv), Emre Çelik (e, **Löschantrag** vor 12 Tagen), Deniz Oto (kurumsal, Onay offen), Burak Şahin
(e, **askida**), Elif Koç (k, aktiv, **E2E-Konto**). TCKN/VKN gültig erfunden, Telefon
`+90555001000x`, `@test.kapbeni.com`, 29 Inserate über 9 Hauptkategorien mit Marke/Zustand,
Bilder selbst erzeugt (SVG-Fläche + Text, durch `lib/bild.js`), teils in İlan Onayı, 7 archiviert
(gelöscht/Admin/abgelehnt), ~200 Ereignisse über Wochen mit verschiedenen IPs/Geräten. Passwörter
**nur** in `/root/kp-testkunden.txt` (0600); das E2E-Konto zusätzlich in
**`/root/kp-e2e-testkunde.txt`** (0600). Erneut anlegen: `node api/scripts/seed-testkunden.js`.

*v1.25.0 — A: Kundenliste und Kundenakte* (Teile 3 und 4 in einer Version, sie teilen
`admin/musteri.js` und die Admin-Seite). Sidebar TEMEL → **Müşteriler** (Bireysel, Kurumsal,
Kurumsal Onay, KYC İstekleri); „Müşteri Akte – Hazırlanıyor“ entfernt, `#/kullanicilar[/<id>]`
leitet um. **Liste** `GET /admin/api/musteriler` serverseitig: Suche Nummer/Name/Firma/E-Mail/
Telefon (`telefonNormalize` + Ziffern)/VKN/IP, Filter Tip, Status (aktif 28 Tage / aktif değil /
silme_bekliyor / silindi / askıda), Zeitraum, Test verisi, Sortierung (Whitelist), Seiten, KPI;
Filter stehen in der Adresse (`replaceState`) — Zurück aus der Akte stellt sie wieder her.
**Akte** `#/musteri/<no>/<reiter>` (Reiter per Hash, Zurück geht zum vorigen Reiter): Kopf mit
Abzeichen (rot k / blau e / gelb kurumsal / grau ohne Angabe), pulsierendes AKTİF (letztes Inserat
inkl. Archiv ≤ 28 Tage), rotes „Silme talebi · X gün kaldı“ / „Müşteri ayrıldı“, Askıda, TEST;
sechs Kacheln, Gewerbe-Block (VKN-Prüfung). Reiter Özet (Geschlecht pflegbar), Zaman çizelgesi
(`musteri_olaylari` + ältere Inserate + erhaltene Gebote + Kontovorgänge aus audit_log;
Tageskarten, nur neuester Tag offen, Filter-Chips öffnen passende Tage, Tageschips springen und
blinken, Blok/Liste/Kutucuk in `localStorage kp_akte_gorunum`), İlanlar (Bilder direkt aus
`ilan_fotograflar`, beendete aus dem Archiv, Admin „Kaldır“ mit Grund), Mesajlar (riskante rot),
Teklifler, Şikayetler, IP & Cihaz (Risiko, IP-/Geräteübersicht, andere Konten mit gleicher IP),
Belgeler (Unterlagen Onayla/Reddet, Kurumsal-Onay über `/kurumsal-onayla`, KYC über
`/kyc/:id/onayla|reddet` — **`reddet` fehlte bisher**, 404), İzinler (vorhandene
Kommunikations-/Bildirim-Felder; eine versionierte KVKK-Einwilligungstabelle gibt es nicht),
Notlar (`admin_kullanici_notlar`). Aktionen: Askıya al (Grund Pflicht) / Askıyı kaldır, Not ekle,
Dışa aktar JSON (alles) / CSV (Zeitleiste). Inseratsbilder liefert der Admin selbst unter
`/admin/uploads/ilanlar` (LAN :3002 kennt `/uploads` nicht). Kundennummer-Abzeichen mit Link
jetzt auch in İlan Onayı (+ Marke/Zustand), Riskli Mesajlar, İlan Şikayetleri (Satıcı und
Melder), KYC, Kurumsal Onay.

*v1.26.0 — M: Markenlisten pflegbar.* `admin/kategori.js`: `GET /admin/api/kategoriler` aus der DB
(**behebt „0 ana kategori“ unter :3002**), `GET …/kategoriler/:id/ozellikler` (eigene + geerbte
Merkmale mit Verwendung je Wert), Wert hinzufügen (Dublette tr-insensitiv 409), umbenennen
(optional vorhandene Inseratswerte mitziehen + Meili-Sync), sortieren, entfernen (Inserate behalten
ihren Wert); „Diğer“ bleibt immer am Ende und ist nicht änderbar. Seite Kategoriler mit Reitern
Kategoriler / Özellikler (`#/kategoriler/ozellikler?k=<id>`).

*Tests:* neu `api/tests/o_olay`, `p_arsiv`, `q_testkunden`, `r_musteri`, `s_kategori` (Suite 27,
alle grün); `m_durum_marka` räumt den Archivrest auf, `l_musteri_no` prüft die Reihenfolge nur für
echte Konten (Seed-Konten sind zurückdatiert). UI `api/tests/ui/admin.js` Szenarien
`musteriler`, `akte`, `kategoriler`, `listen` (390/1280 px). Neue Tests legen Konten direkt in der
DB an (`test_verisi=true`) statt über `/auth/kayit` — das Registrierungslimit gilt je IP.
`suite.sh`-Muster: Exit-Code von `node --test` weitergeben, sonst rollt `&& deploy.sh` trotz
Fehlern aus (ist hier einmal passiert, Fehler waren nur Testlimits).

**Arbeitspaket Medien + Zurück (Auftragssammlung I, J, K) — v1.27 bis v1.31.** Migrationen
`api/migrations/20261108_12_medya_motoru.sql` (Tabellen) und `…_13_video_motor.sql` (Spalten an
`ilanlar`, setzt Bestand `video_durum='tamam'`), Freezes `kapbeni-freeze-20261108-015945` (vor dem
`_sm`-Nachziehen) und `…-020855` (vor Migration 13).

*Entscheidung Mischform (J):* **Bilder synchron in der API, Videos asynchron in der Engine.**
Gründe: (1) Das Dekodieren durch sharp ist die Inhaltsprüfung — sie muss vor dem INSERT laufen,
sonst entsteht bei einer kaputten Datei ein Geister-Inserat; dann kann man das Ergebnis auch gleich
behalten. (2) KI-Moderation, Meili-Sync, Karten und Detailseite brauchen sofort ein Titelbild; ein
Inserat ohne Bild in Suche/Liste wäre schlechter als 0,1–0,3 s Wartezeit je Bild. (3) Bilder kosten
wenig (gemessen ≈160 ms für `_lg` aus 12 MP, ≈65 ms für `_sm`), Videos dagegen ~27 s CPU je Minute
und bis 270 MB RAM — die gehören nicht in den API-Prozess (512-MB-Grenze, blockierte Anfrage).
Synchron verarbeitete Bilder werden trotzdem als Job protokolliert (`medya_isleri.senkron=true`),
damit Admin-Kennzahlen und Fehlerliste vollständig sind.

*v1.27.0 — I: zwei Bildgrößen.* `api/src/lib/bild.js`: `bildVarianten()` rechnet `_lg` (1200 px,
WebP q75) und `_sm` (480 px, q70) **beide aus dem Original** (nicht `_sm` aus `_lg`, sonst doppeltes
Wasserzeichen), Wasserzeichen auf beiden (auf `_sm` kräftiger: 32 % Deckkraft, 80 % Breite — bei
22 %/65 % war es bei 480 px kaum zu sehen), `withoutEnlargement`. **EXIF/GPS:** sharp übernimmt
Metadaten nur mit `withMetadata()`/`keepMetadata()` — beides wird nirgends aufgerufen; Test
`u_medya` prüft an einem Foto mit Kamera- und GPS-EXIF, dass `_lg` und `_sm` kein EXIF/XMP/IPTC
tragen. **Namensregel statt Spalte:** neue Dateien `<uuid>_<n>_lg.webp` / `_sm.webp`, Bestand
`<uuid>_<n>.webp` → `<uuid>_<n>_sm.webp`; `kleinUrl()` identisch in `bild.js`, `src/lib/medya.ts` und
im Admin. `ilan_fotograflar.url` zeigt weiter auf die große Datei. POST: Bilder werden **vor** dem
INSERT umgewandelt, Inserat + Merkmale + Fotozeilen in **einer Transaktion**, Dateien erst nach dem
COMMIT (vorher lief die Bildschleife nach dem INSERT ohne Transaktion). `foto_url` ohne Datei nur noch
als `https://…` oder `/uploads/ilanlar/…` (Backlog „Freitext als Bildpfad“). Löschen/Archiv nehmen
`_sm` mit (`dateienEntfernen` prüft die Nutzung des Paares; `ilanArsiv.snapshotYaz` verschiebt `_sm`
still mit). Seed-Testkunden schreiben beide Größen. Frontend: `components/IlanResim.tsx` (`srcset`
480w/1200w + `sizes` aus `SIZES`, Rückfall auf `_lg`, dann „Medya işleniyor…“ statt kaputtem Bild)
in ProductCard (Raster/Liste, damit auch Benzer İlanlar, Profil, Favoriten), Öne Çıkan, Discover,
Boost-Streifen, Teklif-Kacheln; Detail/Lightbox nutzen `_lg`, Vorschaubilder der Galerie `_sm`.
Admin: `imgKlein()` für Kundenakte (Zeitleiste, Kacheln, İlanlar) und İlan Onayı.
Bestand: `node api/scripts/medya-sm-nachziehen.js` (Trockenlauf) / `--uygula` (tar-Sicherung
`/opt/_archiv/kapbeni-uploads-ilanlar-20261108-020038.tar.gz`, legt nur neue Dateien an, nie
überschreiben): 68/68 Bilder, `_lg` 1703 KB → `_sm` 443 KB.

Messung (Skript wie `/tmp/messung.js`: SSIM blockweise 8×8 gegen verlustfrei skalierte Referenz,
Schärfe = Laplace-Varianz; Testbilder selbst erzeugt bzw. vorhandene Uploads, keine fremden Fotos):

| Testbild | Größe | q70 KB / SSIM | q75 KB / SSIM | q80 KB / SSIM |
|---|---|---|---|---|
| Mandelbrot + Korn, 4000×3000, 3,0 MB, mit EXIF/GPS | `_lg` 1200 | 39,2 / 0,9656 | 41,3 / 0,9660 | 48,8 / 0,9681 |
| | `_sm` 480 | 9,9 / 0,9753 | 10,4 / 0,9765 | 12,1 / 0,9792 |
| Testbild Schrift/Verläufe + Rauschen, 4000×3000, 3,2 MB | `_lg` | 24,2 / 0,9448 | 25,8 / 0,9448 | 31,0 / 0,9466 |
| | `_sm` | 4,5 / 0,9174 | 4,9 / 0,9188 | 5,8 / 0,9210 |
| vorhandener Upload, Produktfoto 1200×675 | `_lg` | 121,3 / 0,9851 | 127,3 / 0,9877 | 141,6 / 0,9940 |
| | `_sm` | 25,8 / 0,9776 | 26,9 / 0,9792 | 31,1 / 0,9834 |
| vorhandener Upload, stark verrauscht 1200×1200 | `_lg` | 237,1 / 0,576 | 240,0 / 0,577 | 253,1 / 0,580 |
| | `_sm` | 78,4 / 0,592 | 79,2 / 0,593 | 82,8 / 0,596 |

Schärfe `_lg` (Mandelbrot): Referenz 145, q70 125 / q75 127 / q80 128 — kein sichtbarer Unterschied.
Ergebnis: **`_lg` q75** spart gegenüber q80 10–20 % bei ≤ 0,006 SSIM, **`_sm` q70** liegt nur
0,001–0,005 unter q75. Die Uploads sind schon q80-WebP, deshalb dort kleinere Gewinne.

*v1.28.0 — J: Medya Motoru.* Dienst **`api/src/medyaMotoru.js`**, PM2 **`kapbeni-media`**
(`ecosystem.config.js`, Logs `/var/log/kapbeni/media-*.log`), nur `127.0.0.1:3901`, Token
**`MEDYA_MOTORU_TOKEN`** (und `MEDYA_MOTORU_PORT`) in `/etc/kapbeni.env` per `openssl rand -hex 32`
erzeugt (Sicherung `/etc/kapbeni.env.bak-20261108-medya`). HTTP: `GET /saglik` (ohne Token),
`GET /durum`, `POST /uyandir`. Jobs: `medya_isleri` (tip `bild|bild_sm|video`, durum
`bekliyor|isleniyor|tamam|hata`, senkron, ilan_id/uuid, user_id, kaynak, hedef, deneme, hata,
hata_kullanici, boyut_once/sonra, sure_ms, detay), Abholung `FOR UPDATE SKIP LOCKED`, höchstens
`paralel` (1–2) gleichzeitig, Polling 5 s + Wecken durch die API, Absturz-Rest → zurück auf
`bekliyor`, max. 3 Versuche (nur Zeitgrenze/DB sind wiederholbar, kaputte Dateien sofort `hata`).
Einstellungen `medya_ayarlari` über **`api/src/lib/medyaAyar.js`** (API, Engine, Admin; Grenzen
erzwungen: Video 5–60 s, Parallelität 1–2; Cache 10 s). Ablauf Video (`lib/medyaIs.js`): ffprobe
prüft Inhalt **und Länge vor dem INSERT** (> 60 s → 400 „Video en fazla 60 saniye olabilir“); in
derselben Transaktion Job + `ilanlar.video_durum='isleniyor'`, `video_is_id`; nach dem COMMIT
`rename` der Rohdatei nach `uploads/tmp/medya/`. Engine: immer umrechnen (720p `scale=-2:min(720,ih)`,
H.264 veryfast CRF 28, `yuv420p`, AAC 96k, `+faststart`), Poster WebP aus Sekunde 1 (≤ 1280×720),
Dateien `<uuid>_video_<job>.mp4` / `<uuid>_poster_<job>.webp`, Eintrag nur wenn `video_is_id` noch
passt (ersetzte/entfernte Videos werden verworfen), altes Video/Poster erst nach dem COMMIT weg,
Meili-Sync. Fehler: `video_durum='hata'`, `video_hata` (nur der Eigentümer sieht sie in
`GET /ilanlar/:uuid`), Benachrichtigung `bildirimler` (tip `medya`). Bearbeiten: neues Video
ersetzt das alte erst, wenn es fertig ist; „Video kaldır“ wirkt sofort. Rohdateien fehlgeschlagener
Jobs bleiben 7 Tage (für „Tekrar dene“), Waisen 1 Tag. Neue Spalten `ilanlar.video_durum`,
`video_poster_url`, `video_hata`, `video_is_id`. Frontend: SellModal prüft die Länge schon bei der
Auswahl (HTML5 `duration`, türkische Meldung; unlesbar → Server entscheidet), Detail zeigt
„Medya işleniyor…“ als Galerie-Station, Poster im Player und in den Vorschaubildern, roter Hinweis
für den Eigentümer bei `hata`. `deploy.sh` lädt `kapbeni-media` mit und prüft `:3901/saglik`.
Bestand: `medya-sm-nachziehen.js --video [--uygula]` gibt Videos ohne Poster an die Engine
(Bestand behält seine Länge — die 60-s-Grenze gilt für neue Uploads, `detay.bestand`, keine
Kundenmeldung). Inserat 14 (72 s) wurde so umgerechnet: 6,3 → 6,1 MB + Poster.
**Vorfall:** Der erste Bestandslauf lehnte das 72-s-Video ab und schrieb dabei eine
Benachrichtigung an den Eigentümer des Inserats — das ist **users.id=1**. Sofort gelöscht (eine
Zeile `bildirimler`), Inserat auf `tamam` zurückgesetzt; seitdem melden Bestandsjobs nichts mehr an
Kunden. Kein Token für id 1 erzeugt.

*v1.29.0 — J: Admin SİSTEM → Medya Motoru* (`admin/medya.js`, ersetzt „Hazırlanıyor“). Reiter per
Hash `#/medya` (Genel bakış), `#/medya/isler?durum=&tip=&ara=&sayfa=` (Filter in der Adresse,
`replaceState`), `#/medya/ayarlar`. Kacheln: Kuyrukta, İşleniyor, Başarısız (anklickbar →
gefilterte Liste), Tasarruf MB/% (Summe `boyut_once − boyut_sonra` erledigter Jobs), Ortalama süre
(Video/Görsel, 30 Tage), Disk (`statfs` + Ordnergrößen ilanlar/archiv/tmp-medya); Motor-Status über
`/durum`. Letzte Fehler, Jobliste mit Kundennummer-Link. **Tekrar dene** nur für Engine-Jobs
(`bild_sm`; Videos nur, solange die Rohdatei noch da ist) — synchrone Bildfehler haben keine
Datei (409 mit Erklärung). Einstellungen speichern nur `super_admin`, audit `medya.tekrar`,
`medya.ayarlar`. API: `GET /admin/api/medya/ozet|isler|ayarlar`, `POST …/isler/:id/tekrar`,
`POST …/ayarlar`.

*v1.30.0 — K: Browser-Zurück auf der Website.* **`src/lib/geriTusu.ts`**: `useGeriKapat(offen,
schliessen, {escape})` legt je Fenster einen History-Eintrag an (gleiche URL, Liste `ov` im State);
Zurück schließt das oberste Fenster, X/Escape/Vazgeç gehen per `history.back()`, schließt die App
ein Fenster selbst, wird sein Eintrag entfernt (mehrere auf einmal als ein `history.go(-n)`).
Weil `back()` asynchron ist, laufen alle Pushes über `nachZurueck()` (warten auf das popstate) —
sonst entfernte das Zurück eines gerade geschlossenen Fensters den neuen Eintrag. Escape wirkt nur
auf das oberste Fenster. Reload bei offenem Fenster: `main.tsx` entfernt den toten Eintrag vor dem
Start. Eingebaut in SellModal (Neu/Bearbeiten), AuthModal, KYC, GSM, EditProfile, ProfileDrawer,
OnayModal, PaylasMenu, Lightbox (Details), Paket-Fenster im Footer. HızlıIlanModal behält seine
eigene Lösung (v1.13). **Routen** `#/destek`, `#/paketler` (`NavState.ek`, liegt über der aktuellen
Ansicht; Direkteinstieg → Startseite darunter). App-popstate ignoriert Fenster-Einträge
(`popVonOverlay`, gleicher Schlüssel). **Scrollposition**: `scrollRestoration='manual'`, beim Push
wird die Position vom letzten Klick/Tastendruck in den verlassenen Eintrag geschrieben (`y`), beim
Zurück wiederhergestellt (bis 1,5 s nachgeladen). **Chat:** `startChat` legt keine `chat_<Zeit>`-IDs
mehr an, sondern nutzt `POST /mesajlar/konusma` (Link `#/mesajlar/<id>` übersteht Reload).
**Rechtsseiten:** „Geri“ geht per `history.back()`, bei Direkteinstieg `location.replace('#/')`
(vorher legte `hash=''` einen neuen Eintrag an — Zurück führte wieder auf die Rechtsseite).
Push-Effect hatte `ekRoute` zunächst nicht in den Abhängigkeiten (gefunden durch den UI-Test).

*v1.31.0 — K: Browser-Zurück im Admin.* Seiten/Reiter liefen schon über den Hash (Kundenakte
`#/musteri/<no>/<reiter>`, Kategoriler, Medya). Neu: Fenster (`body > .modal-backdrop`, ~10 Stellen)
und die Handy-Schublade bekommen per MutationObserver einen History-Eintrag (`kpOv`): Zurück schließt
das oberste (erst Escape-Ereignis, damit `sebepModal` sein Promise auflöst, dann entfernen), ✕/
Vazgeç/Speichern nehmen den Eintrag per `history.go(-n)` zurück; tote Einträge (Fenster zu nach
Seitenwechsel) werden übersprungen; Reload bei offenem Fenster entfernt den Eintrag.

*Tests:* neu `api/tests/u_medya.test.js` (Namensregel; 1200/480 px ohne EXIF/GPS; Upload → beide
Dateien, Job protokolliert, Archiv nimmt `_sm` mit; kaputtes Bild → 400 ohne Inserat + Fehler-Job;
Video 65 s → 400; Video 1080p 3 s → Job → 720p H.264/yuv420p/AAC, `moov` vor `mdat`, WebP-Poster,
Rohdatei weg; kaputte Datei → `hata`, Meldung nur für den Eigentümer, Benachrichtigung) und
`v_medya_admin.test.js` (Kennzahlen, Liste, Tekrar dene, 409 für synchrone Fehler, Grenze 60 s).
Suite 34 Tests grün. UI: `api/tests/ui/zurueck.js` (Szenarien seiten, destek, fenster, chat, legal;
390/1280 px; 15 s Pause je Durchlauf wegen Rate-Limit; Chat-Konversationen Testkonto ↔ Seed-Kunde
werden gelöscht), `admin.js` Szenarien `medya`, `zurueck`. Vor dem Ausrollen von v1.30 lief die
UI-Prüfung gegen einen Testbuild (`vite build --outDir /tmp/kp-k-dist`, statischer Server
`/root/kp-vorschau.js` auf 127.0.0.1:3905 mit /api-Weiterleitung) — so geht kein ungetesteter Build
live. Hilfsskript `/root/kp-suite-deploy.sh "<Text>"`: Suite mit Exit-Code, nur bei 0 `deploy.sh minor`.

**Arbeitspaket Rechtsseiten + Cookie-Banner (Auftragssammlung D, E) — v1.32 und v1.33.** Keine
Migration, keine DB-Änderung (deshalb kein Freeze; `deploy.sh` sichert `dist`).

*v1.32.0 — Rechtsseiten, Footer, Künye.* Die 15 Entwurfstexte (`kapbeni/legal-entwurf`, v1.0,
**juristisch ungeprüft**) liegen als HTML-Fragmente unter `src/pages/legal/metinler/<slug>.html`,
aufbereitet per Skript: interne Prüfmarken (`[HUKUKİ KONTROL …]`, `[TEKNİK KONTROL …]`,
`[ÜRÜN KONTROLÜ …]`, `[POLİTİKA KARARI]`, `[… TEYİT EDİLECEK]`) **entfernt** — sie stehen nur noch im
Original-Ordner und im Bericht; zwei, die eine Tabellenzelle allein füllten (yasakli-urunler:
Havalı tüfekler, Ticari plakalar), durch „yayımlanmaz“ ersetzt. Firmendaten und Platzhalter sind
`{{token}}` und werden zur Laufzeit **nur aus `data/sirket.ts`** gefüllt (`hukukMetinleri.ts`,
`metniHazirla()`); leere SIRKET-Felder (vkn, vergiDairesi, mersis, kep, ticaretSicilNo, neu
**`odaAdi`**, **`etbisKayitNo`**) erscheinen grau als „(eklenecek)“, Yürürlük ebenso (Konstante
`YURURLUK_TARIHI`). Ein Text = eigener Chunk (`import.meta.glob(..., {query:'?raw'})`), Hauptbundle
unverändert groß. Gemeinsame Komponente **`pages/legal/HukukSayfasi.tsx`**: „Geri Dön“ (v1.30-Logik
`legalZurueck`), Hinweis „Taslak – hukuki inceleme bekleniyor“ solange `__KAPBENI_ORTAM__ !== 'prod'`,
Karte nach §2, Typografie `.hukuk-metin` in `index.css` (Tabellen in `.hukuk-tablo` scrollen in der
Karte, Inhaltsverzeichnis als Block `.hukuk-icindekiler`). **Anker:** Klicks auf `#abschnitt`
werden abgefangen → `scrollIntoView`, Adresse per `replaceState` auf `#/<slug>?b=<id>` (kein
neuer History-Eintrag; Direktlink/Reload springt zum Abschnitt). Routing: `navigation.ts`
`legalSlug(hash)` ersetzt `LEGAL_HASHES` (15 Slugs + hakkimizda + nasil-calisir + Aliase,
`?b=` gehört zur Seite); Aliase (`HUKUK_ALIAS`, z. B. `#/mesafeli-satis-sozlesmesi`,
`#/on-bilgilendirme-formu`, `#/impressum`) leitet App.tsx per `location.replace` um. Alte
Einzelseiten Kullanım/Gizlilik/Mesafeli/Çerez/İade/Güvenli Alışveriş **gelöscht** (gleiche Routen,
neue Texte); Hakkımızda und Nasıl Çalışır bleiben. Rechtsseiten-Hintergrund jetzt `#f8f9fa` wie
die übrige Seite. **Footer:** Spalten Kurumsal (Hakkımızda, Künye, Kurumsal Satıcı Sözleşmesi,
Hak İhlali) / Yasal (9 Texte) / Paketler / Yardım (Nasıl Çalışır, Güvenli Alışveriş, İlan Verme
Kuralları, Yasaklı Ürünler, ab v1.33 „Çerez Tercihleri“) / İletişim; Logo und Compendus-Block
unverändert. ETBİS: „ETBİS'e Kayıtlıdır“ mit Logo erscheint erst, wenn `SIRKET.etbisKayitNo`
gesetzt ist — bis dahin Platzhalter „ETBİS kaydı yapılıyor“ (Link auf Künye), kein QR. Fußzeile
KVKK → `#/kvkk`, neu „Künye“. **Registrierung (AuthModal):** Links Üyelik Sözleşmesi, Kullanım
Koşulları, KVKK, Açık Rıza (Kurumsal zusätzlich Kurumsal Satıcı Sözleşmesi), alle
`target="_blank"` — das Fenster samt Eingaben bleibt im Ursprungstab, über einer Rechtsseite
liegt nie ein Fenster (Backlog-Punkt K erledigt). Açık rıza nur verlinkt („İsteğe bağlı izinler“),
nicht als mitangenommen formuliert. **Navbar:** Suchfeld `min-w-0` — vorher 4 px waagerechter
Überlauf auf 390 px (bestand schon vor diesem Paket).

*v1.33.0 — Cookie-Banner.* `lib/cerezOnay.ts` (Texte aus `cookie-banner-texte.json`, Knöpfe
„Tümünü kabul et“ / „Reddet“ / „Tercihler“), `components/CerezBanner.tsx`, eingehängt in `main.tsx`
neben `<App/>` (erscheint überall, auch auf Rechtsseiten). Speicher
**`localStorage['kapbeni_cookie_consent']` = `{v:'1.0', zorunlu:true, analitik, pazarlama, zaman}`**;
andere Version oder älter als 12 Monate → neu fragen (`CEREZ_SURUM` erhöhen, wenn ein Werkzeug
dazukommt; Abfrage `analitikIzinli()`/`pazarlamaIzinli()`). Reddet und Kabul gleich groß und gleich
gestaltet; am Handy sitzt die Karte über der BottomNav (`bottom-[72px]`), kein Overlay.
Tercihler-Fenster mit Schaltern je Kategorie, eigener History-Eintrag (`useGeriKapat`), Footer
„Çerez Tercihleri“ öffnet es (`cerezTercihleriniAc()`, Window-Event). Çerez Politikası korrigiert:
Consent-Key genannt, `kapbeni_listings`/`kapbeni_chats` richtig beschrieben (Listen-/Chat-Zustand,
werden beim Abmelden **nicht** gelöscht), Zeile Cloudflare Turnstile ergänzt, Knopfnamen angepasst.
Zustimmung wird **nicht** serverseitig protokolliert (offen, s. Backlog).
Tatsächliche Browser-Speicher der Website: `sg_token`, `kapbeni_cookie_consent`, `kapbeni_listings`,
`kapbeni_chats` — keine Cookies, kein sessionStorage (Admin: `kp_sb_*`, `kp_akte_gorunum`).

*Tests:* Suite 34/34 grün vor jedem Ausrollen. Neu **`api/tests/ui/rechtsseiten.js`** (ohne
Anmeldung, kein Token, schreibt nichts; 390/1280 px): `routen` (15 Routen laden, keine `[`/`{{` im
sichtbaren Text, Taslak-Hinweis, kein waagerechter Überlauf, Künye/Footer ETBİS-Platzhalter, kein
QR, Alias), `toc` (Klick scrollt, `?b=`, kein History-Eintrag, Reload springt), `zurueck` (Footer →
KVKK → Künye → Zurück → Zurück → Startseite; Direkteinstieg → Geri Dön), `banner` (erscheint,
gleich große Knöpfe, verdeckt BottomNav nicht, Reddet/Kabul/Tercihler speichern das Format, Reload
ohne Banner, Footer öffnet, Zurück schließt Tercihler, Versionswechsel fragt neu), `kayit` (4 Links,
neuer Tab, Fenster bleibt); dazu Konsolenfehler je Lauf. `masken.js` und `zurueck.js` belegen die
Cookie-Entscheidung im Init-Script vor (sonst fängt das Banner Klicks ab). Beide Stufen vorher gegen
Testbuild `/tmp/kp-k-dist` + `/root/kp-vorschau.js` (:3905) geprüft.

**E2E-Test Staging (zwei Kunden) — v1.33.1 bis v1.34.1.** Kunde A = Elif Koç (E2E-Konto, users.id=78,
Verkäuferin), Kunde B = Ayşe Yılmaz (id=71, Käuferin), Admin nur Test-Admin id=3 (vorher aktiv, danach
wieder `aktif=false`). Skript **`api/tests/ui/e2e.js`** (Playwright, 390/1280 px, Fotos
`/tmp/kp-ui/e2e-*.png`), Schritte `giris ilan hizli escape toast medyayenile panel moderasyon medya suche
chat abwicklung admin seiten`, Abräumen mit `aufraeumen` (`BEHALTEN=<id>` = Zwischenaufräumen). Anmeldung
über die echte Login-Maske mit den Passwörtern aus `/root/kp-e2e-testkunde.txt` / `kp-testkunden.txt`
(werden nie ausgegeben), Sitzungen in `/tmp/kp-e2e-{A,B}.json` (0600, gelten per Kopie auch für den
Testbuild-Origin), Zustand `/tmp/kp-e2e-state.json`, Testmedien per ffmpeg (`testsrc2`/`mandelbrot`, Video
8 s und 55 s 1080p). Node-Tests je Fix: **`api/tests/w_e2e_ablauf.test.js`** (Suite jetzt 41).

*Gefunden und behoben:*
- **v1.33.1 — Chat von der Website ging nie.** `mesajlarApi.sendMessage` postete seit v1.0 an
  `/mesajlar/konusma/:id`, die Route heißt `/konusma/:id/mesaj` → jede Nachricht 404, `Messages.tsx` legte
  den Text still zurück ins Feld. Pfad korrigiert, Sendefehler erscheint jetzt als Meldung (`role=alert`).
- **v1.33.2 — Escape in einer offenen Combobox schloss die ganze Verkaufsmaske** (Eingaben weg): der
  `document`-Keydown von `useGeriKapat` bekam die Taste mit. `Combobox` verbraucht Escape bei offener
  Liste (`preventDefault` + `nativeEvent.stopPropagation`), `geriTusu` ignoriert `defaultPrevented`.
- **v1.33.3 — İlan Onayı → Suchindex** (Backlog): `onayla` ruft `syncListing`, `reddet` `deleteListing`.
- **v1.33.4 — Meldung nach dem Anlegen** stand immer auf „yayınlandı“, auch bei `moderasyonda`; jetzt
  „İlanınız incelemeye alındı. Onaylandığında yayına girecek.“
- **v1.33.5 — „Medya işleniyor…“ aktualisiert sich selbst** (Backlog): Detailseite fragt alle 5 s (max.
  3 min) `GET /ilanlar/:uuid?medya=1` nach; `?medya=1` zählt keinen Aufruf (`goruntulenme`).
- **v1.34.0 — İlanlarım: Status-Abzeichen + „Satıldı“.** Abzeichen İncelemede/Satıldı/Reddedildi/Yayında
  değil/İşlemde (Styleguide-Farben), Knopf „Satıldı“ nur bei aktiven Inseraten mit `OnayModal`.
  `PUT /ilanlar/:id/satildi` nimmt jetzt id **oder** uuid, nur `aktif`, entfernt aus Meili, audit
  `ilan.satildi`, Ereignis `ilan_satildi` („Satıldı olarak işaretledi“ in der Kundenakte). Vorher gab es
  keine Oberfläche dafür, und der Verkäufer sah nicht, dass ein Inserat in İlan Onayı wartet.
- **v1.34.1 — „Değerlendirmelerim“** zeigte die neuesten Bewertungen der ganzen Plattform
  (`/degerlendirme/son`), jetzt `/degerlendirme/kullanici/:id`.

*Ablauf heute (Stand v1.34.1), alles grün:* Login beider Kunden; Inserat über die Maske und über Hızlı İlan
(je 2 Fotos + 8-s-Video, Marke, Zustand) → KI 88/92 → aktiv, sofort in Meili; verdächtiges Inserat
(Kapora/IBAN) → KI 3 → İlan Onayı → Freigabe durch Test-Admin → sofort im Index; Video-Jobs `tamam` mit
Poster; Suche, Kategorie, Favorit, Detail, Mesaj Gönder, Chat in beide Richtungen, Pazarlık als Text,
zwei Teklifs (Ablehnen/Annehmen im Panel), riskante Nachricht → `pesin_odeme`, Warnung beim Empfänger,
Eintrag in Riskli Mesajlar und rot in der Akte; Satıldı; Zeitleisten A/B; Medya Motoru; Cookie-Banner,
Rechtsseiten, Browser-Zurück (Hash-Ebene), keine Konsolenfehler, kein Überlauf.
*Wo der Ablauf endet:* Nach „Kabul“ passiert nichts weiter — keine Benachrichtigung (es gibt im Frontend
gar keine Bildirim-Anzeige, `bildirimler` wird für Teklif/Mesaj nicht geschrieben), kein Übergang in
Treffen/Versand/Zahlung. „Hemen Al“ füllt nur den Chat vor. `islemler` (Treuhand) hat API-Routen
(satin-al/kargo/onayla/itiraz), aber **keine Oberfläche** und keine Zahlung (iyzico nicht eingetragen);
der Menüpunkt „Aldıklarım & Sattıklarım“ landet im Profil. Bewertung schreiben: nur API
(`POST /degerlendirme`, Status `beklemede`), keine Oberfläche, keine Kopplung an einen Kauf.
Teslimat-Abzeichen der Detailseite sind tot: Details liest `teslimat_elden/teslimat_kargo`, die API liefert
`elden_teslim/kargo_var` — und die Maske fragt beides nicht ab (Standard true), deshalb nicht „repariert“.

*Lehren für Agenten:* (1) `kp-suite-deploy.sh` deaktiviert den Test-Admin am Ende — vor UI-Admin-Schritten
wieder aktivieren. (2) Mehrere Suite-Läufe in 15 min sprengen die Limits `/api/auth` (20) und Admin-Login
(20): Admin-Limit setzt `pm2 reload kapbeni-admin` zurück, das API-Limit nur Warten. (3) API-Änderungen
vor dem Ausrollen testen, ohne live zu schalten: zweite API-Instanz aus dem Arbeitsbaum
`API_PORT=3911 node src/index.js` + Suite mit `TEST_API=http://127.0.0.1:3911/api`, Testbuild-Vorschau
mit Proxy auf 3911 (Kopie von `kp-vorschau.js` auf :3906); beides danach per PID beenden. (4) Tests, die
eine **bestehende** Konversation wiederverwenden, dürfen nur ihre eigenen Nachrichten löschen (siehe
Vorfall unten). (5) Tabler-Icons stehen im Accessible Name — `getByRole(...,{name, exact:true})` trifft
Knöpfe mit Icon nicht, `locator('button',{hasText})` nehmen; Karten vom Titel aus per
`ancestor::div[.//button…][1]` ansteuern, nie den ersten Knopf im Raster.

*Vorfälle:* (a) Beim Formatcheck der Zugangsdatei stand das Passwort des E2E-Kontos im Werkzeug-Protokoll
des Agenten (Maskierung griff wegen Tab nicht) — **Passwort sofort rotiert** (bcrypt, beide Dateien
aktualisiert), nirgends sonst verwendet. (b) Der erste Node-Test zu v1.33.1 löschte beim Aufräumen alle
Nachrichten von Ayşe in der Seed-Konversation 14 — darunter die Seed-Nachricht „Tablet için 2.800 olur
mu?“ samt Ereignis. Wiederhergestellt (gleicher Text, Zeit 2026-09-14 10:05 UTC, IP/Gerät aus dem
Seed-Profil; neue Zeilen-id 58), Test korrigiert. (c) Vor v1.33.3 lief `pm2 reload kapbeni-admin`
schon mit dem neuen Admin-Code (für den Gegentest), wenige Minuten vor dem Ausrollen.

#### Benachrichtigungen (v1.35.0)

Erste Lücke aus dem E2E-Test geschlossen: Nach Nachricht, Angebot oder Freigabe erfährt die Gegenseite davon.
- **Bibliothek `api/src/lib/bildirim.js`** — `gonder({userId, tip, baslik, icerik, link, kaynakTip, kaynakId})`
  wirft nie, beachtet die Ayarlar-Schalter `bildirim_mesaj` / `bildirim_teklif` / `bildirim_ilan`
  (aus = keine Meldung), schreibt nichts an gelöschte Konten (`silindi_at`). Chat: je Konversation
  höchstens **eine** ungelesene Meldung, weitere Nachrichten aktualisieren sie. `okunduYap()` markiert
  Meldungen einer Quelle als gelesen.
- **Auslöser:** `mesaj` (Empfänger; bei `tehlikeli` ohne Nachrichtentext), `teklif_yeni` (Verkäufer, Link
  `/#/panel/gelen-teklifler` = Tekliflerim mit Rolle Satıcı), `teklif_kabul` / `teklif_red` (Käufer),
  `ilan_onay` / `ilan_red` (Admin İlan Onayı → Eigentümer), `medya` (Videofehler, vorher eigenes INSERT).
- **Migration `20261108_14_bildirimler.sql`:** `bildirimler.kaynak_tip`, `kaynak_id` + zwei Indizes.
- **API:** `GET /bildirimler` (neueste zuerst, `okunmamis`, `mesaj_okunmamis`), neu `GET /bildirimler/ozet`
  (`{bildirim, mesaj}`), `PUT /:id/oku` und `DELETE /:id` mit Ziffernprüfung (400). `GET /mesajlar/konusmalar`
  liefert `okunmamis` je Konversation; Öffnen einer Konversation markiert deren Meldung gelesen.
  `PUT /teklifler/:id` nimmt nur noch `kabul|reddedildi` (vorher jeder Text).
- **Oberfläche:** `components/BildirimZili.tsx` — Desktop: Glocke rechts in der Navbar mit Zähler, Liste
  als Fenster (Portal in `<body>`, sonst verdeckt die sticky Kategorieleiste den Kopf). Handy: Punkt am
  Menü-Knopf, Zeile „Bildirimler“ mit Zähler im Menü (ein Knopf mehr im Handy-Kopf hätte das Suchfeld
  unter das Logo geschoben). Klick = gelesen + Sprung über `navAnwenden` (nicht `location.hash`),
  „Tümünü okundu işaretle“, Escape/Außenklick schließen. `lib/bildirimOzet.ts` lädt die Zähler alle 30 s
  (nur bei sichtbarem Tab), beim Zurückkehren in den Tab und auf das Ereignis `kapbeni:bildirim-yenile`
  (Messages löst es beim Lesen aus). **Das Mesajlar-Abzeichen zählt jetzt echte ungelesene Nachrichten**
  (vorher Mock-`chats`); Konversationsliste zeigt ungelesene fett mit Zahl.
- **Tests:** `api/tests/x_bildirim.test.js` (6, eigenes Testinserat von Elif, Käuferin Ayşe 71, räumt
  Meldungen/Nachrichten/Teklifs/Ereignisse weg), Aufräumen in `w_e2e_ablauf` ergänzt; Browser
  `api/tests/ui/bildirim.js` (1280/390: Zähler, Liste, Fensterkopf frei, Sprung zum Inserat, Zähler sinkt,
  Escape, Tümünü okundu, Angebots-Link → Satıcıyım aktiv, Suchfeld so breit wie vorher, keine
  Seitenfehler). Sitzung per `tokenFuer` (15 min), kein Passwort. Vor dem Ausrollen gegen API :3911 /
  Admin :3912 / Vorschau :3906 (47/47, UI grün, `zurueck.js` 66× OK), danach live 47/47.

#### Login-Effekte nach Santral (v1.36.0)

Auftrag von Burak über die Santral-Sitzung („alle mit gleichen Effekten … jeweils farblich abgestimmt“).
Vorlage: Santral `docs/LOGIN-EFFEKTE.md` (live santral.compendus.com). Farben statt Gold: Streifen
`#ffb4b0 → #e53935 → #b61722`, Kugel/Ecken/Glow `#e53935`, Rand-Verlauf `#e53935` → Grau → Navy
`#1a2e4a` (Admin) bzw. `#8a1019` (Website). Kein Dark Mode.
- **Admin** (`admin/public/index.html`, Helfer `glasAuf`, `kpStreifen`, `kpLicht`, `kpEinklappen`,
  `kpSchuetteln`; CSS-Block „Login-Effekte nach Santral“): Login-Karte als Glaskarte (20 px, Blur,
  Maus-Spotlight, vier Eck-Klammern). Ruhezustand 170×170 mit drehender Raute (`img/kapbeni-ikon.webp`,
  Preisschild aus `logo-navbar.png` geschnitten) und Kugel, die der Maus folgt; Maus/Fokus/Tippen klappt
  auf (Felder blenden gestaffelt ein), Verlassen klappt nach 500 ms zu — **außer** Feld fokussiert,
  Maus über der Karte (Turnstile-iframe) oder Fehlermeldung sichtbar; `?hata=` startet offen.
  Touch: `pointerleave` wird ignoriert (kommt direkt nach dem Tippen), zu nur über `focusout`.
  **Kein Autofokus** mehr auf E-posta, solange eingeklappt (der Fokus würde sofort aufklappen).
  Falsches Passwort schüttelt die Karte. 9 fallende Lichtstreifen in der hellen rechten Fläche, jede
  Runde neue Position/Neigung/Länge/Dauer/Deckkraft. Logo-Karte links schwebt. Şifremi unuttum /
  Yeni şifre: Glaskarte offen, ohne Einklappen. **Sperrbildschirm:** 11 Streifen (fixed) hinter der
  Sperrkarte, Sperrkarte als Glaskarte, falsches Passwort schüttelt.
- **Website** (`lib/girisEfekt.ts` — gleiche Logik als DOM-Helfer; CSS am Ende von `index.css`,
  Klassen `.kp-glas`, `.kp-streif`): AuthModal Login und Registrierung als Glaskarte mit Streifen auf
  dem abgedunkelten Hintergrund, Glanzstreifen auf dem Hauptknopf, Schütteln bei Fehler.
  **Einklappen nur beim Login und nur mit Maus** (`(hover: hover) and (pointer: fine)`): am Handy ist das
  Fenster ein Bottom-Sheet, die Registrierung ein langes Formular — beide starten offen. Die Karte
  trägt einen festen `className`, damit React die per DOM gesetzten Klassen `intro/reveal/shake` nicht
  überschreibt.
- **Google-Knopf** war schon ein eigener Knopf mit voller Breite (kein GSI-Button, Login „Yakında“) —
  gemessen genau so breit wie die Felder (Admin 352/310 px, Website 408/350 px). Wenn Google live geht
  und auf `renderButton` umgestellt wird: Breite aus `clientWidth` (200–400) + ResizeObserver wie Santral.
- `prefers-reduced-motion: reduce` schaltet Streifen, Intro und Animationen ab, die Karte bleibt offen.
- **Test** `api/tests/ui/giris-efekt.js` (1280/390 px, 56 Prüfungen; Kunden-Login ohne Anmeldung,
  Admin-Teil mit Test-Admin id=3, Passwort aus `/root/kp-admin-test.pw`, nie ausgegeben). Vorher gegen
  Admin :3912 + Vorschau :3905, danach live ALLES OK, Suite 47/47, Test-Admin wieder `aktif=false`.

---

## 4. Offene Punkte / Backlog

**Funktional**
- `DELETE /api/ilanlar/:uuid` löscht endgültig (seit v1.23 mit Archiv, `lib/ilanArsiv.js`) — es gibt **kein** „vorübergehend zurückziehen"
  mehr in der Oberfläche. Die Route `PUT /:id/yeniden` (wieder veröffentlichen) existiert
  weiterhin, wird aber von keiner Ansicht benutzt. Drei Inserate stehen noch auf `pasif`
  (ids 11, 13, 23) und sind nur noch für ihren Eigentümer sichtbar.
- ~~Neue Inserate landen nicht im Suchindex~~ — **erledigt in v1.12.0** (POST ruft
  `syncListing`, sofern das Inserat direkt aktiv ist).
- ~~Admin: Abzeichen Silme talebi/Müşteri ayrıldı, Kundennummer in den Listen, Filter Test
  verisi, Markenlisten pflegbar, Marke/Zustand in Akte und İlan Onayı~~ — **erledigt v1.25/v1.26**.
  Offen: İl/İlçe-Combobox und Telefon-/VKN-Prüfung in Admin-**Formularen** (der Admin bearbeitet
  Kundendaten bisher gar nicht, nur Geschlecht).
- Kundenakte, offen: ISP/Anbieter im IP-Protokoll braucht GeoLite2-ASN (MaxMind-Lizenzschlüssel,
  Burak) — bis dahin „—“ (Demo-Daten tragen erfundene Anbieter). Versionierte
  KVKK-Einwilligungen (Text-Version, Zeit, IP) werden nirgends gespeichert; Reiter „İzinler“ zeigt
  nur die Tercih-Felder. Unterlagen-Upload für Kurumsal-Kunden fehlt im Frontend
  (`musteri_belgeleri.dosya_url`, Ablage `uploads/belgeler` ist bereits gesperrt); „Görüntüle“
  ist deshalb deaktiviert. „Mesaj gönder“ an Kunden und zweistufiges Löschen durch den Admin
  (Cankartım) fehlen. Inserat „läuft aus“ (Cron parkt nur) erzeugt noch keinen Archiv-Snapshot.
- Kontolöschung: ~~Bilder gehen nicht ins Archiv~~ (erledigt v1.23); KVKK-/Gizlilik-Text nennt die
  Fristen (Archiv 2 Jahre, IP-Log 2 Jahre) noch nicht.
- Telefon: id 5 (`0000000000`) und id 6 (`0500000000`) bleiben unnormalisiert (Platzhalter,
  keine echte Nummer). `adresler` speichert Telefon/Name/Typ gar nicht, obwohl die Maske
  sie abfragt.
- `services/ai.service.js`: `aciklamaOner` nutzt den Claude-Pfad; ob `mesajKontrol` und
  `fiyatOner` schon umgestellt sind, ist hier nicht geprüft.
- ~~Meili-Schlüssel steht hartkodiert in `api/src/lib/meili.js`~~ — **erledigt in v1.16.0**
  (`MEILI_MASTER_KEY` in `/etc/kapbeni.env`). Der alte Wert steht aber in der Git-Historie:
  Schlüssel in Meilisearch wechseln (Neustart mit neuem Master-Key) und in .env bzw.
  Entegrasyonlar eintragen.
- **Burak trägt in Admin → Entegrasyonlar ein** (Schlüssel nie in Dateien/Chat): SMTP oder
  Resend (sonst kein Mailversand, Reset-Links nur im Log), Turnstile Site-/Secret-Key und
  Modus live (heute test), iyzico Sandbox-Schlüssel (Merchant-ID), NetGSM, R2; Google-Login
  (Admin + Kunde) **erst nach dem Prod-Start**; Claude-Modell bei Bedarf.
- Google-Login (Gerüst v1.21): `users.phone` ist NOT NULL, Google liefert keine Nummer —
  neue Google-Konten bekommen den Platzhalter `g-<hash>`. Abfrage der Telefonnummer nach dem
  ersten Login fehlt; vor dem Freischalten entscheiden.
- Admin-Rollen: Entegrasyonlar speichern/testen nur `super_admin`; ein Rechtebaum (Cankartım
  08) fehlt noch; Kundenakte/Sperren/Belege darf jeder aktive Admin. Sidebar-Einträge Yedekleme,
  Deploy Yönetimi, Test Sunucu sind „Hazırlanıyor“-Seiten (Medya Motoru seit v1.29 echt).
- ~~Admin-Seite „Kategoriler“ zeigt unter :3002 „0 ana kategori“~~ — **erledigt v1.26**
  (`/admin/api/kategoriler`).
- ~~Admin-Zurück: Reiter und Modals ohne History-Eintrag~~ — **erledigt v1.31** (Fenster und
  Handy-Schublade per MutationObserver; Reiter liefen schon über den Hash).
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
- ~~`startChat` erzeugt lokale IDs `chat_…`~~ — **erledigt v1.30** (nur noch API-Konversation).
  Offen: Der App-State `chats` (Mock-Startwert, `localStorage kapbeni_chats`) existiert weiter
  neben der API — seit v1.35 speist er auch den Ungelesen-Zähler nicht mehr, kann weg.
- Benachrichtigungen (v1.35) nur im Konto: E-Mail/SMS (`bildirim_email`, `bildirim_sms`) werden nicht
  versendet (SMTP/NetGSM fehlen). Ohne Auslöser bisher: gespeicherte Suchen (`kayitli_aramalar.bildirim_aktif`),
  Preissenkung bei Favoriten (`bildirim_tercih.fiyat_dususu`), Bewertung erhalten, Push im Browser.
  Kein Echtzeitkanal — Zähler alle 30 s.
- `api/src/routes/odeme.js:26` und `agim.js:23` verweisen hartkodiert auf die **entfernte**
  Domain `sattimgitti.transas24.com` (Zahlungs-Rückkehr-URL, Einladungslink).
- Ein aktives Inserat (Asus Notebook, id=12) hat keine `kategori_id`.
- ~~KI-Moderation antwortet nicht mehr~~ — **erledigt in v1.7.0** (Claude Haiku, siehe
  Chronik 2026-11-07).
- **Die übrigen KI-Funktionen hängen weiter am toten NVIDIA-Endpunkt**: `mesajKontrol`
  (Betrugserkennung in Chats), `aciklamaOner`, `fiyatOner` in `services/ai.service.js`. Sie
  scheitern still über `guvenli()` — `mesajKontrol` meldet dadurch jede Nachricht als `temiz`.
  Umstellung auf Claude nach demselben Muster wie `moderasyonYap`.
- ~~Freigabe über „İlan Onayı" (`/admin/api/ilanlar/:id/onayla`) ruft `meiliSync` nicht auf~~ —
  **erledigt v1.33.3** (Freigabe `syncListing`, Ablehnen `deleteListing`).
- Der Claude-Schlüssel ist mit dem Konto des Betreibers verknüpft (`sk-ant-usr-…`). Falls bei
  der Erstellung eine Laufzeit gesetzt wurde, endet die Moderation an dem Tag still — danach
  geht jedes Inserat in die Warteschlange. Ablaufdatum in der Claude Console prüfen.
- **Mock-Daten überdecken echte Inserate**: `data/mockData.ts` trägt dieselben UUIDs wie die
  DB-Inserate und dient als Anfangswert von `listings`. Bei einem Direktlink auf
  `#/ilan/<uuid>` findet `navAnwenden()` den Mock-Eintrag und zeigt dessen hartkodierte
  Werte, statt die API zu befragen; `categorySlug` fehlt dort, `category` enthält den Slug
  statt des Anzeigenamens. Saubere Lösung: bei einem Direktaufruf immer nachladen oder die
  Mock-Daten entfernen, sobald die API-Liste steht.
- ~~Destek Merkezi/Paketler ohne Route, Scrollposition, Modals ohne History~~ — **erledigt v1.30**.
  Offen (K): Fenster innerhalb von Dashboard, Settings und Discover (Filter-Panel am Handy) und
  `HizliIlanModal` (eigene Lösung aus v1.13) nutzen `useGeriKapat` noch nicht. Eine von Hand in die
  Adresszeile getippte App-Adresse (`#/ilan/…`) wird erst nach einem Reload ausgewertet — App.tsx
  reagiert nur auf eigene History-Einträge (Altbestand). ~~Ein Link mit `href` innerhalb eines offenen
  Fensters (z. B. KVKK-Link im AuthModal) lässt das Fenster über der Rechtsseite offen~~ — **erledigt
  v1.32** (Rechtslinks im AuthModal öffnen im neuen Tab).
- Rechtsseiten/Cookie (D/E), offen: Texte sind **Entwurf** — juristische Prüfung (TR-Anwalt: KVKK,
  6563, 6502) vor Prod; offene Prüfmarken siehe `kapbeni/legal-entwurf` (Original) bzw. Bericht
  08.11. Fehlend in SIRKET: VKN, Vergi Dairesi, MERSİS, KEP, Ticaret sicil, Oda, ETBİS-Kayıt;
  Yürürlük-Datum (`YURURLUK_TARIHI` in `hukukMetinleri.ts`). Zustimmungen (Cookie, KVKK, Açık
  rıza) werden nicht serverseitig versioniert gespeichert; die Registrierung hat keine eigenen
  Açık-rıza-Kästchen (İYS, KI-Auslandsübermittlung, Konum, KYC-Biometrie) — die Texte beschreiben
  sie aber. Turnstile lädt Cloudflare (Ausland) — im Text als zwingend/Sicherheit geführt, prüfen.
- Medien (I/J), offen: Bestandsvideos über 60 s bleiben in voller Länge (Inserat 14, 72 s);
  Option „automatisch auf 60 s kürzen statt ablehnen“ nicht gebaut. Geänderte Größen/Qualitäten im
  Admin gelten nur für neue Uploads (kein Neuberechnen des Bestands — das Original wird nicht
  aufbewahrt). AVIF nicht eingeführt. Off-Site-Speicher (R2) für Videos vorbereitet, aber nicht
  angebunden. Ein Video-Job, dessen Rohdatei nach 7 Tagen gelöscht wurde, kann nicht mehr
  wiederholt werden (Kunde lädt neu). ~~„Medya işleniyor…“ wird auf der Detailseite nicht von selbst
  aktualisiert~~ — **erledigt v1.33.5** (Nachfrage alle 5 s, `?medya=1`).
- **E2E-Test 08.11., offen (Abwicklung nach der Einigung):** Nach „Kabul“ eines Teklif geht es nicht
  weiter — keine Benachrichtigung an Käufer/Verkäufer (Frontend hat **keine** Bildirim-Anzeige;
  `bildirimler` wird für Mesaj/Teklif nicht geschrieben; Ungelesen-Zähler „Mesajlar“ kommt aus dem
  Mock-State `chats`), kein Gegenangebot, kein „Teklif Yap“ im Chat (nur auf der Detailseite), kein
  Treffen/Versand-Schritt. Treuhand `islemler` nur API (satin-al/kargo/onayla/itiraz), keine Oberfläche,
  keine Zahlung (iyzico fehlt); „Aldıklarım & Sattıklarım“ führt ins Profil. Bewertung schreiben nur per
  API (`beklemede`, Admin gibt frei), keine Oberfläche, nicht an einen Kauf/„Satıldı“ gekoppelt;
  „Satıldı“ (v1.34) fragt nicht, an wen verkauft wurde. Lieferart (`elden_teslim`, `kargo_var`,
  `kargo_ucreti`) fehlt in der Maske, die Detailseite liest falsche Feldnamen (`teslimat_*`).
  „İkinci El“-Abzeichen in İlanlarım ist hartkodiert (`condition: 'İkinci El'` in `Dashboard.tsx`),
  Herz auf eigenen Inseraten. Herz-Knopf der Detailseite ohne `aria-label`. Kein Melden/Blockieren
  eines Nutzers im Chat, keine Alarme für gespeicherte Suchen (`kayitli_aramalar` ohne Job).
  Feature-Vergleich mit letgo/sahibinden/dolap/Kleinanzeigen: Nachtbericht 08.11., Abschnitt
  „E2E-Test (zwei Kunden)“.

**Daten/Inhalt**
- Zwei Zeilen in `ilan_fotograflar` (ids 11 und 13) enthalten in der Spalte `url` keinen
  Pfad, sondern den Freitext „i5 Ismelnci Asus". Seit v1.27 prüft `POST /api/ilanlar` das Feld
  `foto_url` (nur `https://…` oder `/uploads/ilanlar/…`); die beiden Altzeilen sind unverändert.
- Vier der sieben WebP unter `/uploads/ilanlar` sind verwaist (keine Zeile verweist darauf).
- Die meisten Inseratsbilder liegen gar nicht bei uns, sondern sind externe Unsplash- und
  Google-Usercontent-Adressen — sie bekommen folglich auch kein Wasserzeichen.
- `hero_slider` enthält 7 gepflegte Slides, `GET /api/slider` liefert sie — **kein Bundle ruft
  sie ab**, die Startseite zeigt hartkodierte Slides. Texte tragen noch die alte Marke.
- 88 hartkodierte Unsplash-Bilder + Google-Usercontent als Platzhalter.
- ~~EAV-Merkmale ungenutzt~~ — **erledigt in v1.12.0**: Verkaufsmaske und Detailseite nutzen
  sie, Marke je Hauptkategorie. Offen: Marke → Modell abhängig (Araba/Telefon), Filter nach
  Marke in der Keşfet-Oberfläche (API kann `?marka=` schon).
- `data/categories.ts` ist verwaist und kann gelöscht werden.

**Datenschutz**
- Detailseite verlinkt auf `google.com/maps` (früher: eingebettete OSM-Karte per Nominatim).

**Betrieb**
- `kapbeni-live-ref` (:3004) und `/opt/_vergleich` sind temporär und können nach Abschluss der
  Vergleiche entfernt werden.
- `pm2` zeigt für `kapbeni-api` einen historischen Restart-Zähler aus einem behobenen
  Crashloop; `pm2 reset kapbeni-api` setzt ihn zurück.
