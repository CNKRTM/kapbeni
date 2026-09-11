# Changelog

Alle Versionen, neueste zuerst. Gepflegt von `deploy.sh`.

## 1.1.1 — 2026-09-11

CLAUDE.md: GitHub-Anbindung und Versionierung dokumentiert

## 1.1.0 — 2026-09-11

Versionierung sichtbar in Fußzeile und Admin

## 1.0.0 — 2026-09-11

Erste versionierte Fassung. Der Stand war zu diesem Zeitpunkt bereits im
Betrieb; diese Version markiert den Beginn der Versionierung, nicht den Beginn
des Projekts. Die vollständige Vorgeschichte steht in
[`Kapbeni_Prod/CLAUDE.md`](Kapbeni_Prod/CLAUDE.md), Abschnitt 3.

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
