# Changelog

Alle Versionen, neueste zuerst. Gepflegt von `deploy.sh`.

## 1.6.1 — 2026-09-12

Wasserzeichen nutzt das Navbar-Logo

Als Quelle für das Wasserzeichen dient jetzt logo-navbar.png — dieselbe Grafik,
die unter https://kapbeni.com/logo-navbar.png ausgeliefert wird. Die lokale
Datei ist damit byte-identisch, deshalb bleibt es beim Dateipfad statt eines
Netzabrufs bei jedem Upload.
Der Alphakanal des PNG wird beim Einbetten erhalten: die Drehung bekommt einen
vollständig durchsichtigen Hintergrund und die Deckkraft wird über den
Alphakanal geregelt, nicht über eine Hintergrundfläche — es entsteht also kein
Kasten um das Logo. An drei frisch hochgeladenen Bildern geprüft.
Position, Deckkraft und Drehung unverändert: 22 Prozent, minus 30 Grad,
65 Prozent der Bildbreite, mittig. Bestehende Bilder bleiben unverändert.

## 1.6.0 — 2026-09-12

Bilder-Modal auf der Detailseite, Wasserzeichen auf hochgeladenen Bildern

- Ein Klick auf das Produktbild öffnet jetzt ein Modal mit allen Bildern des
  Inserats: durchblätterbar mit Pfeilen, Pfeiltasten, Wischen und
  Vorschaukacheln, schließbar per X, Klick daneben und Escape; der
  Hintergrund scrollt dabei nicht mit. Es ist dieselbe Bildliste wie in der
  Galerie auf der Seite, keine zweite Datenquelle.
  Dabei behoben: die Pfeile rechneten mit einem ungeklammerten Index und
  konnten von einer unsichtbaren Position aus weiterspringen, wenn ein Bild
  entfernt wurde.
- Jedes hochgeladene Inseratsbild bekommt automatisch ein KapBeni-Wasserzeichen:
  diagonal über das Bild, halbtransparent, aus dem vorhandenen Logo erzeugt.
  Das passiert serverseitig beim Verarbeiten, ist also nicht per Rechtsklick zu
  umgehen. Die Deckkraft wurde an echten Produktfotos gewählt, sodass die Ware
  klar erkennbar bleibt. Der Aufschlag liegt bei rund 50 Millisekunden je Bild.
  Bestehende Bilder bleiben unverändert; Profilbilder und KYC-Aufnahmen
  bekommen bewusst kein Zeichen.
  Dabei behoben: die Bildverarbeitung verwarf die EXIF-Ausrichtung — hochkant
  aufgenommene Handyfotos blieben dauerhaft quer.

## 1.5.0 — 2026-09-12

Video wird verkleinert statt abgelehnt, Konumu Kullan, kein Wechsel zur Startseite nach dem Anlegen

- Zu große Videos werden nicht mehr abgewiesen: der Server nimmt bis 100MB an
  und rechnet alles über 20MB auf 720p herunter. Gemessen: 65MB/1080p/40s
  werden in rund 18 Sekunden zu 11MB. Höchstens zwei Umrechnungen laufen
  gleichzeitig, mit harter Zeitgrenze; das Video landet dabei auf der Platte
  statt im Arbeitsspeicher. iPhone-Videos (MOV) werden jetzt ebenfalls
  umgerechnet, statt nur die Dateiendung zu ändern.
  Dabei behoben: eine beliebige Datei mit Video-Kennung wurde ungeprüft
  übernommen und das Inserat trotzdem als veröffentlicht gemeldet — der
  Inhalt wird jetzt vor dem Anlegen geprüft.
- Neuer Knopf "Konumu Kullan" in der Erstellmaske: füllt Şehir und İlçe aus
  der Geräteposition vor. Die Umrechnung von Koordinaten in Namen macht der
  eigene Server, nicht der Browser — die Position geht damit nicht direkt an
  einen Dritten. Das Ergebnis wird gegen die Orts-Tabellen geprüft, statt es
  zu übernehmen. Ohne Standortfreigabe funktioniert die Auswahl von Hand
  unverändert weiter.
- Nach dem Anlegen eines Inserats wechselt die Seite nicht mehr zur
  Startseite. Wer aus "İlanlarım" heraus ein Inserat einstellt, bleibt dort
  und die Liste baut sich mit dem neuen Inserat neu auf.

## 1.4.0 — 2026-09-12

Löschen wechselt nicht mehr zur Startseite; Sitzung überlebt Rate-Limit

- Nach dem Löschen aus "İlanlarım" bleibt man dort und die Liste baut sich
  ohne das gelöschte Inserat neu auf. Der erste Anlauf merkte sich die
  Herkunft in einem Ref — der ist nach jedem Neuladen der Seite weg, dann
  landete man doch wieder auf der Startseite. Jetzt wird nur noch navigiert,
  wenn die Detailansicht des gelöschten Inserats offen ist; dafür führt die
  Browser-Historie zurück an den Ort, von dem der Nutzer kam (Panel,
  Kategorie, Suche oder Profil). Ohne eigenen Verlauf geht es ins Panel.
- Eigentliche Ursache des Symptoms behoben: ein Fehlschlag von
  GET /api/auth/ben hat den Nutzer aus seiner Sitzung geworfen. Auf /api/auth
  lag ein Limit von 20 Anfragen je 15 Minuten, und /auth/ben läuft bei jedem
  Seitenaufruf mit — nach rund zwanzig Aufrufen kam 429, der Token wurde
  gelöscht und man stand abgemeldet auf der Startseite. Das enge Limit gilt
  jetzt nur noch für Anmelden und Registrieren; /auth/ben bekommt 60 je
  Minute. Und nur eine echte Ablehnung (401) beendet die Sitzung — ein 429,
  ein Serverfehler oder ein Netzaussetzer nicht mehr.

## 1.3.0 — 2026-09-12

Lösch-Bestätigung im Seitendesign, Navigation nach dem Löschen, Fehlergrenze

- Die Lösch-Bestätigung ist kein natives Browser-confirm() mehr, sondern ein
  eigenes Modal im bestehenden Design (weiße Karte, zwei gleich breite Knöpfe,
  grau abbrechen / rot bestätigen). Gleicher Warntext wie zuvor. Umgestellt an
  allen vier Stellen: Bearbeiten-Maske, Detailseite, Profilseite und
  Admin-Tabelle. Escape und Klick daneben schließen.
- Nach dem Löschen wechselt die Seite nicht mehr auf die Startseite. Wer aus
  "İlanlarım" heraus löscht, bleibt dort und die Liste baut sich ohne das
  gelöschte Inserat neu auf; von der Detailseite aus geht es in die Kategorie
  zurück, aus der das Inserat geöffnet wurde, und erst als letztes zur
  Startseite.
- Neue Fehlergrenze um die Dashboard-Reiter: ein Fehler beim Rendern nimmt
  nicht mehr die ganze Seite mit, sondern zeigt an Ort und Stelle eine Meldung
  mit "Tekrar Dene"; Seitenleiste, Navigation und Fußzeile bleiben stehen.

## 1.2.1 — 2026-09-12

Favorilerim-Weißseite behoben

Der Dashboard-Reiter "Favorilerim" riss beim Öffnen die gesamte Seite weiß.
GET /api/favoriler antwortet mit { ilanlar: [...] }, der Client erwartete ein
Array und rief .map() auf dem Objekt auf — der Fehler beim Rendern nahm den
ganzen React-Baum mit, also auch Navigation und Fußzeile.
favorilerApi.getAll() packt jetzt aus und bildet die Rohzeilen auf Listings ab
(sonst hätten die Karten leere Titel und 0 ₺ gezeigt); zusätzlich eine
Array-Prüfung beim Setzen und beim Rendern. Alle übrigen Dashboard-Endpunkte
wurden gegengeprüft — Favorilerim war die einzige Fehlstelle.

## 1.2.0 — 2026-09-12

Inserate bearbeiten, Mobil-Upload abgesichert, echtes Löschen

- Bearbeiten-Funktion für eigene Inserate: neuer Endpunkt PUT /api/ilanlar/:uuid
  (Titel, Beschreibung, Preis, Kategorie, Zustand, Ort sowie Fotos und Video).
  Erreichbar über "Düzenle" auf der Detailseite — nur für den Ersteller, für alle
  anderen wird der Knopf nicht gerendert — und über jede Karte in "İlanlarım".
  Die bestehende "Sat"-Maske dient beiden Zwecken; Fotos werden als vollständige
  Wunschreihenfolge übergeben, ein neues Bild kann also auch Titelbild werden.
  Weiterhin höchstens 8 Fotos und 1 Video, mit denselben Prüfungen wie beim Anlegen.
- Foto-Upload auf Handy und Tablet: die Dateiauswahl funktionierte bereits mit Kamera
  und Galerie. Behoben wurden stattdessen die zwei echten Mängel — die fehlende
  Bild-MIME-Prüfung auf dem Server (ein HEIC ließ die Bildverarbeitung abbrechen und
  hinterließ ein Inserat ohne Fotos) und die 20px-Bedienelemente auf den
  Vorschaukacheln, jetzt 28px.
- Löschen wirkt jetzt wirklich: DELETE setzte bisher nur ilan_durum='pasif', meldete
  aber "gelöscht"; Zeile, Fotos und Dateien blieben liegen und der Direktlink war
  weiter für jeden offen. Jetzt endgültiges Löschen in einer Transaktion —
  Zahlungen, Bewertungen und Beschwerden behalten ihre Zeile und verlieren nur den
  Verweis, ein laufendes Geschäft sperrt das Löschen mit 409.
  Der Papierkorb im Admin rief eine Route, die es nie gab (404, stillschweigend
  verschluckt) — Route ergänzt, Fehler wird angezeigt.
- Fehlermeldungen kommen an: die API antwortet mit dem Feld 'hata', der Client las
  nur 'message' und zeigte immer den gleichen nichtssagenden Text.

## 1.1.2 — 2026-09-11

CLAUDE.md an die Repo-Wurzel verschoben, Verweise nachgezogen

## 1.1.1 — 2026-09-11

CLAUDE.md: GitHub-Anbindung und Versionierung dokumentiert

## 1.1.0 — 2026-09-11

Versionierung sichtbar in Fußzeile und Admin

## 1.0.0 — 2026-09-11

Erste versionierte Fassung. Der Stand war zu diesem Zeitpunkt bereits im
Betrieb; diese Version markiert den Beginn der Versionierung, nicht den Beginn
des Projekts. Die vollständige Vorgeschichte steht in
[`CLAUDE.md`](CLAUDE.md), Abschnitt 3.

Enthalten ist unter anderem der Stand vom 10./11. September 2026:

- Browser-History für die SPA (`src/navigation.ts`) — Zurück verließ vorher die Seite
- Kategoriebaum mit Live-Stückzahlen an allen vier Stellen (`data/kategoriAgac.ts`)
- „Teklif Yap" samt Verlauf der eigenen Gebote
- „Hemen Al" als Kontakt-Abkürzung in den Chat, ohne Zahlungsfluss
- „Benzer İlanlar" mit serverseitiger Auswahl (`GET /api/ilanlar/:uuid/benzer`)
- Bildergalerie mit bis zu 8 Fotos und 1 Video je Inserat
- Teilen-Menü mit WhatsApp, Telegram, X, Facebook, E-Posta und Kopierfunktion
- Behoben: fehlendes `USAGE` auf `ilan_numarasi_seq` — Inserate ließen sich
  überhaupt nicht anlegen
- Behoben: Spaltenname `kyc_durum` statt `kyc_durumu` in vier Admin-Abfragen
