# KapBeni

Türkischer Kleinanzeigen-Marktplatz — Single-Page-Anwendung mit Node-Backend,
betrieben auf einem eigenen Server unter [kapbeni.com](https://kapbeni.com).

> **Beğen, kap, senin olsun.**

---

## Dokumentation

| Datei | Inhalt |
|---|---|
| [`Kapbeni_Prod/CLAUDE.md`](Kapbeni_Prod/CLAUDE.md) | **Laufender Projektstand** — Architektur, Styleguide, Chronik jeder Änderung, Backlog. Wird bei jedem Auftrag gepflegt. |
| [`DEPLOY.md`](DEPLOY.md) | Wie ausgerollt wird, was `deploy.sh` tut, Rollback, Freeze/Restore |
| [`CHANGELOG.md`](CHANGELOG.md) | Versionen chronologisch, neueste zuerst |
| [`VERSION`](VERSION) | Aktuelle Version — einzige Quelle, wird von Frontend und Admin gelesen |

---

## Technikstapel

**Frontend** — `Kapbeni_Prod/src/`

| | |
|---|---|
| React | 18.3 mit TypeScript 5.2 |
| Build | Vite 5.3 → statisches Bundle in `dist/` |
| Styling | Tailwind CSS 3.4, Farbtoken `primary`/`secondary`/`tertiary` |
| Animation | framer-motion 11 |
| Icons | Tabler Icons (lokaler Webfont) + lucide-react |
| Routing | **kein Router** — Ansicht liegt im React-State, Browser-History über `src/navigation.ts` (Hash-URLs) |

**Backend** — `api/`, `admin/`, `kyc/`

| Dienst | Technik | Port | PM2 |
|---|---|---|---|
| API | Express 4.19 auf Node 20 | 3001 | `kapbeni-api` |
| Express-Admin | Express, eigene Identitätsebene (`admin_users`) | 3002 | `kapbeni-admin` |
| KYC | FastAPI auf Python 3.12 | 8001 | `kapbeni-kyc` |

**Daten und Infrastruktur**

| | |
|---|---|
| Datenbank | PostgreSQL 16 (`sattigitti_db`, nur localhost) |
| Cache/Sitzungen | Redis 7 (nur localhost) |
| Suche | Meilisearch (nur localhost, Port 7700) |
| Webserver | nginx 1.24, TLS über Let's Encrypt |
| Uploads | `/var/www/kapbeni/uploads`, Bilder als WebP über `sharp` |
| Firewall | ufw — Regelsatz steht im MANIFEST jedes Freeze |

---

## Aufbau des Verzeichnisses

```
/opt/kapbeni/
├── VERSION                  Versionsnummer — eine Quelle für alles
├── deploy.sh                Version erhöhen, bauen, committen, taggen, pushen
├── ecosystem.config.js      PM2-Prozesse
├── Kapbeni_Prod/
│   ├── CLAUDE.md            Projektgedächtnis (Architektur, Chronik, Backlog)
│   └── src/                 Frontend-Quelle; `dist/` entsteht beim Bauen
├── api/src/routes/          API-Endpunkte
├── admin/server.js          Express-Admin
└── kyc/main.py              KYC-Dienst
```

Nicht im Repository: `node_modules/`, `venv/`, `dist/`, Sicherungskopien — und
**keine Geheimnisse**. Alle Zugangsdaten stehen ausschließlich in
`/etc/kapbeni.env` auf dem Server; die Datei ist in `.gitignore` gesperrt.

---

## Entwickeln

```bash
cd /opt/kapbeni/Kapbeni_Prod/src
npm install
npx tsc --noEmit          # Typprüfung — muss sauber sein
npm run build             # → dist/
```

`dist/` wird von drei nginx-Vhosts ausgeliefert (kapbeni.com, :3003, :3004).
Ein Build geht deshalb **sofort live** — siehe [`DEPLOY.md`](DEPLOY.md).

## Ausrollen

```bash
cd /opt/kapbeni
./deploy.sh patch "Kurzbeschreibung der Änderung"
```

Erhöht `VERSION`, schreibt den CHANGELOG-Eintrag, prüft Typen, baut, lädt die
Dienste neu, committet, taggt und pusht. Einzelheiten in [`DEPLOY.md`](DEPLOY.md).

---

## Konventionen

- Oberflächentexte **türkisch**, Code-Kommentare **deutsch**
- Authentifizierung **ausschließlich per Bearer-Token** — die API kennt keinen
  Cookie-Pfad. Auth-pflichtige Aufrufe laufen über den Client `ve` aus
  `Kapbeni_Prod/src/src/api/index.ts`.
- Styleguide ist verbindlich: nur bestehende Schriften, Farben, Abstände und
  Komponentenformen verwenden. Die vollständige Liste steht in
  [`Kapbeni_Prod/CLAUDE.md`](Kapbeni_Prod/CLAUDE.md), Abschnitt 2.
