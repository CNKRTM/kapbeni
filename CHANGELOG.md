# Changelog

Alle Versionen, neueste zuerst. Gepflegt von `deploy.sh`.

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
