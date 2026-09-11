# Ausrollen

## Der übliche Weg

```bash
cd /opt/kapbeni
./deploy.sh patch "Kurzbeschreibung der Änderung"
```

Ohne Stufe ist `patch` die Voreinstellung. `minor` für neue Funktionen,
`major` für Brüche.

Vorher ansehen, ohne etwas zu verändern:

```bash
./deploy.sh --dry-run minor "Text"
```

## Was das Skript tut, in dieser Reihenfolge

| Schritt | Inhalt |
|---|---|
| 1 | Prüft `VERSION` auf Semver, prüft, dass `origin/main` nicht voraus ist |
| 2 | Errechnet die neue Nummer und schreibt sie in `VERSION` |
| 3 | Setzt einen neuen Abschnitt oben in `CHANGELOG.md`, samt der Commits seit dem letzten Tag |
| 4 | `tsc --noEmit` — bei Fehlern Abbruch, nichts wird ausgerollt |
| 5 | `Kapbeni_Prod/build-deploy.sh`: sichert das alte `dist`, baut neu, prüft. Danach wird geprüft, ob die neue Nummer wirklich im Bundle steht |
| 6 | `pm2 reload` für API und Admin, danach HTTP-Prüfung von `:3001`, `:3002`, `:3003` — bei allem außer 200 Abbruch **vor** dem Push |
| 7 | Commit `chore(release): vX.Y.Z`, Tag `vX.Y.Z`, Push nach `origin main` |

**Bricht ein Schritt ab, wird `VERSION` auf den alten Wert zurückgesetzt und
`CHANGELOG.md` wiederhergestellt.** Es soll keine Versionsnummer geben, zu der
es keinen Build gibt.

## Die Versionsnummer

Sie steht genau einmal, in `/opt/kapbeni/VERSION`. Von dort liest sie

- `Kapbeni_Prod/src/vite.config.ts` beim Bauen → Fußzeile der Website
- `admin/server.js` beim Start → Fußzeile der Admin-Seitenleiste

Fehlt die Datei, steht an beiden Stellen `dev` statt einer erfundenen Nummer.
Die Nummer wird nie von Hand in eine Quelldatei geschrieben.

## Wichtig zu wissen

`Kapbeni_Prod/src/dist` wird von **drei** nginx-Vhosts ausgeliefert:
`kapbeni.com`, `:3003` und `:3004`. Ein Build geht deshalb **sofort live** —
es gibt keine getrennte Testumgebung, die erst freigegeben werden müsste.

## Rollback

**Nur das Frontend** (schnellster Weg, `build-deploy.sh` sichert vor jedem Build):

```bash
ls -1dt /opt/kapbeni/Kapbeni_Prod/_dist_backups/dist_*   # neueste zuerst
rm -rf /opt/kapbeni/Kapbeni_Prod/src/dist
cp -a /opt/kapbeni/Kapbeni_Prod/_dist_backups/dist_JJJJMMTT_HHMMSS \
      /opt/kapbeni/Kapbeni_Prod/src/dist
```

**Code auf eine Version zurück:**

```bash
cd /opt/kapbeni
git checkout v1.0.0 -- .        # Dateien zurückholen, Historie behalten
./deploy.sh patch "Rücknahme auf v1.0.0"
```

**Ganze Maschine** — siehe das MANIFEST im jeweiligen Freeze:

```bash
ls -1dt /opt/_archiv/kapbeni-freeze-*
cat /opt/_archiv/kapbeni-freeze-JJJJMMTT-HHMMSS/MANIFEST.txt
```

## Freeze ziehen

```bash
/usr/local/sbin/kapbeni-freeze.sh
cd /opt/_archiv/kapbeni-freeze-* && sha256sum -c SHA256SUMS.txt
```

Sichert Code, Datenbank, Uploads, Meilisearch, nginx-Konfiguration und
Zertifikate. Der ufw-Regelsatz steht im MANIFEST, weil ufw seine Regeln
außerhalb dieser Pfade hält und beim Restore sonst ersatzlos fehlte.

> Ein Freeze enthält **Klartext-Geheimnisse** (`kapbeni.env`, Meilisearch-Key,
> private Zertifikatsschlüssel). Alle Dateien liegen auf `0600/root`. Nie in
> ein Repository, nie in einen Cloud-Speicher ohne Verschlüsselung.

## Geheimnisse

Alle Zugangsdaten stehen ausschließlich in `/etc/kapbeni.env` auf dem Server.
Diese Datei ist **nicht** im Repository und durch `.gitignore` gesperrt,
zusammen mit `*.pem`, `*.key`, `id_*` und `*_deploy*`.

Der GitHub-Zugang läuft über einen Deploy-Key unter `~/.ssh/kapbeni_deploy`
(Rechte `600`), eingebunden über den Host-Alias `github-kapbeni` in
`~/.ssh/config`. Der private Schlüssel verlässt den Server nicht.
