#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  KapBeni — Version erhoehen, bauen, ausrollen, veroeffentlichen.
#
#    ./deploy.sh [patch|minor|major] "Kurzbeschreibung"
#    ./deploy.sh "Kurzbeschreibung"           # patch ist die Voreinstellung
#    ./deploy.sh --dry-run minor "Text"       # nur zeigen, nichts aendern
#
#  Die Versionsnummer steht genau einmal: in VERSION. Von dort liest sie
#  vite.config.ts beim Bauen (Fusszeile) und admin/server.js beim Start
#  (Seitenleiste). Auseinanderlaufen koennen sie deshalb nicht.
#
#  Reihenfolge ist Absicht: erst pruefen, dann bauen, erst danach
#  veroeffentlichen. Bricht etwas ab, wird VERSION zurueckgesetzt — es soll
#  keine Nummer geben, zu der es keinen Build gibt.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

WURZEL="/opt/kapbeni"
VERSION_DATEI="$WURZEL/VERSION"
CHANGELOG="$WURZEL/CHANGELOG.md"
FRONTEND="$WURZEL/Kapbeni_Prod/src"
BUILD_SKRIPT="$WURZEL/Kapbeni_Prod/build-deploy.sh"
BRANCH="main"

rot()  { printf '\033[0;31m%s\033[0m\n' "$*"; }
gruen(){ printf '\033[0;32m%s\033[0m\n' "$*"; }
grau() { printf '\033[0;90m%s\033[0m\n' "$*"; }

TROCKEN=0
if [ "${1:-}" = "--dry-run" ]; then TROCKEN=1; shift; fi

case "${1:-}" in
  patch|minor|major) STUFE="$1"; shift ;;
  "") rot "Kurzbeschreibung fehlt."
      echo "  ./deploy.sh [patch|minor|major] \"Was hat sich geaendert\""; exit 1 ;;
  *)  STUFE="patch" ;;
esac
TEXT="${*:-}"
[ -z "$TEXT" ] && { rot "Kurzbeschreibung fehlt."; exit 1; }

cd "$WURZEL"

# ── 1) Vorbedingungen ─────────────────────────────────────────────────────
echo "1/7  Vorbedingungen"
[ -f "$VERSION_DATEI" ] || { rot "VERSION fehlt."; exit 1; }
ALT="$(tr -d ' \n' < "$VERSION_DATEI")"
[[ "$ALT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { rot "VERSION ist kein Semver: '$ALT'"; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { rot "Kein Git-Repository."; exit 1; }

# Nicht ueber eine fremde Aenderung hinwegbauen, die noch nicht hier ist.
if git remote get-url origin >/dev/null 2>&1; then
  git fetch --quiet origin "$BRANCH" 2>/dev/null || true
  if git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
    HINTEN=$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)
    [ "$HINTEN" -gt 0 ] && { rot "origin/$BRANCH ist $HINTEN Commit(s) voraus. Erst 'git pull'."; exit 1; }
  fi
fi
grau "     aktuell v$ALT, Erhoehung: $STUFE"

# ── 2) Neue Nummer ────────────────────────────────────────────────────────
IFS='.' read -r MA MI PA <<< "$ALT"
case "$STUFE" in
  major) MA=$((MA+1)); MI=0; PA=0 ;;
  minor) MI=$((MI+1)); PA=0 ;;
  patch) PA=$((PA+1)) ;;
esac
NEU="$MA.$MI.$PA"
echo "2/7  Version: $ALT -> $NEU"

if [ "$TROCKEN" -eq 1 ]; then
  gruen "     (Probelauf — es wurde nichts veraendert)"
  echo;  echo "Waere passiert:"
  echo "  VERSION      $ALT -> $NEU"
  echo "  CHANGELOG    neuer Abschnitt '## $NEU — $(date +%Y-%m-%d)'"
  echo "  Build        $FRONTEND -> dist/"
  echo "  Commit+Tag   v$NEU"
  echo "  Push         origin $BRANCH --tags"
  exit 0
fi

# Ab hier wird veraendert: bei Abbruch alles zuruecklegen.
#
# Wichtig ist dabei das dist: der Build laeuft VOR der Dienstpruefung, ein
# Abbruch in Schritt 6 hinterliesse sonst ein live ausgeliefertes Bundle mit
# einer Nummer, die VERSION gar nicht mehr nennt. Genau das ist beim ersten
# echten Lauf passiert. build-deploy.sh legt vor jedem Build eine Sicherung
# an — die wird hier zurueckgeholt.
aufraeumen() {
  [ "${FERTIG:-0}" -eq 1 ] && return
  rot "Abgebrochen — wird zurueckgesetzt."
  echo "$ALT" > "$VERSION_DATEI"
  grau "     VERSION -> $ALT"
  [ -n "${CL_SICHERUNG:-}" ] && [ -f "$CL_SICHERUNG" ] && { mv "$CL_SICHERUNG" "$CHANGELOG"; grau "     CHANGELOG zurueckgeholt"; }
  if [ -n "${DIST_SICHERUNG:-}" ] && [ -d "$DIST_SICHERUNG" ]; then
    rm -rf "$FRONTEND/dist"
    cp -a "$DIST_SICHERUNG" "$FRONTEND/dist"
    grau "     dist zurueckgeholt aus $(basename "$DIST_SICHERUNG")"
  fi
  # Der Admin liest VERSION beim Start — ohne Neustart zeigte er die
  # zurueckgenommene Nummer weiter an.
  pm2 reload kapbeni-admin --update-env >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

echo "$NEU" > "$VERSION_DATEI"

# ── 3) CHANGELOG — neueste Version oben ───────────────────────────────────
echo "3/7  CHANGELOG"
CL_SICHERUNG="$(mktemp)"
[ -f "$CHANGELOG" ] && cp "$CHANGELOG" "$CL_SICHERUNG"
COMMITS=""
if git rev-parse --verify --quiet "v$ALT" >/dev/null; then
  COMMITS="$(git log --pretty='- %s' "v$ALT..HEAD" 2>/dev/null | grep -v '^- chore(release)' || true)"
fi
{
  head -n 4 "$CHANGELOG" 2>/dev/null || printf '# Changelog\n\nAlle Versionen, neueste zuerst. Gepflegt von `deploy.sh`.\n\n'
  echo "## $NEU — $(date +%Y-%m-%d)"
  echo
  echo "$TEXT"
  [ -n "$COMMITS" ] && { echo; echo "$COMMITS"; }
  echo
  tail -n +5 "$CHANGELOG" 2>/dev/null || true
} > "$CHANGELOG.neu"
mv "$CHANGELOG.neu" "$CHANGELOG"
grau "     Abschnitt '$NEU' eingefuegt"

# ── 4) Typpruefung ────────────────────────────────────────────────────────
echo "4/7  Typpruefung"
npx --prefix "$FRONTEND" tsc --noEmit -p "$FRONTEND/tsconfig.json" \
  || { rot "     tsc meldet Fehler — nichts ausgerollt."; exit 1; }
grau "     sauber"

# ── 5) Bauen (nutzt das vorhandene build-deploy.sh: Sicherung + Build + Test)
echo "5/7  Bauen"
SICHERUNGEN="$WURZEL/Kapbeni_Prod/_dist_backups"
VOR_BUILD="$(ls -1dt "$SICHERUNGEN"/dist_* 2>/dev/null | head -1 || true)"
bash "$BUILD_SKRIPT" >/tmp/kapbeni-build.log 2>&1 \
  || { rot "     Build fehlgeschlagen — siehe /tmp/kapbeni-build.log"; tail -15 /tmp/kapbeni-build.log; exit 1; }
NACH_BUILD="$(ls -1dt "$SICHERUNGEN"/dist_* 2>/dev/null | head -1 || true)"
[ -n "$NACH_BUILD" ] && [ "$NACH_BUILD" != "$VOR_BUILD" ] && DIST_SICHERUNG="$NACH_BUILD"
# Auf die Nummer in Anfuehrungszeichen pruefen: vite backt sie als "1.2.3" ins
# Bundle, ohne das fuehrende v aus der JSX-Zeile.
grep -q "\"$NEU\"" "$FRONTEND"/dist/assets/index-*.js 2>/dev/null \
  && grau "     v$NEU steht im Bundle" \
  || { rot "     v$NEU fehlt im Bundle — vite.config.ts liest VERSION nicht."; exit 1; }

# ── 6) Dienste neu laden ──────────────────────────────────────────────────
echo "6/7  Dienste"
for d in kapbeni-api kapbeni-admin; do
  pm2 reload "$d" --update-env >/dev/null 2>&1 && grau "     $d neu geladen" || rot "     $d liess sich nicht neu laden"
done
# Nach einem reload braucht der Dienst einen Moment, bis der Port wieder
# offen ist. Sofortiges Pruefen meldete sonst 000, obwohl alles in Ordnung war.
pruefe() {
  local ziel="$1" code=000 i
  for i in $(seq 1 15); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$ziel" 2>/dev/null || true)"
    [ -z "$code" ] && code=000
    [ "$code" = "200" ] && break
    sleep 1
  done
  printf '     %-38s HTTP %s\n' "$ziel" "$code"
  [ "$code" = "200" ]
}
for z in "http://127.0.0.1:3001/api/health" "http://127.0.0.1:3002/admin" "http://127.0.0.1:3003/"; do
  pruefe "$z" || { rot "     $z antwortet nicht mit 200 — Abbruch vor dem Push."; exit 1; }
done

# ── 7) Veroeffentlichen ───────────────────────────────────────────────────
echo "7/7  Git"
git add -A
if git diff --cached --quiet; then
  grau "     nichts zu committen"
else
  git commit -q -m "chore(release): v$NEU

$TEXT"
  grau "     committet"
fi
git tag -a "v$NEU" -m "v$NEU — $TEXT" 2>/dev/null || grau "     Tag v$NEU existierte bereits"
if git remote get-url origin >/dev/null 2>&1; then
  git push -q origin "$BRANCH" && git push -q origin "v$NEU" && grau "     gepusht"
else
  grau "     kein origin gesetzt — nur lokal"
fi

FERTIG=1
rm -f "$CL_SICHERUNG"
echo
gruen "══ v$NEU ist draussen ══"
echo "  https://kapbeni.com   (Fusszeile zeigt v$NEU)"
echo "  http://127.0.0.1:3002/admin   (Seitenleiste zeigt v$NEU)"
