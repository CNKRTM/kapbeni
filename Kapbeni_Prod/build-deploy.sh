#!/bin/bash
# KapBeni Build & Deploy Script
# Ausfuehren auf dem Server: bash /opt/kapbeni/Kapbeni_Prod/build-deploy.sh
#
# Baut das Frontend aus Kapbeni_Prod/src nach Kapbeni_Prod/src/dist.
# Alle drei nginx-Vhosts (kapbeni.com, sattimgitti.transas24.com, :3003)
# liefern aus genau diesem dist aus.

set -euo pipefail

PROD_SRC="/opt/kapbeni/Kapbeni_Prod/src"
BACKUP_ROOT="/opt/kapbeni/Kapbeni_Prod/_dist_backups"
BACKUP_DIR="$BACKUP_ROOT/dist_$(date +%Y%m%d_%H%M%S)"
KEEP=5   # so viele Backups aufheben

echo "=== KapBeni Build & Deploy ==="
echo ""

# 1) Backup des aktuellen dist - innerhalb von Kapbeni_Prod, damit das
#    Verzeichnis eigenstaendig/migrierbar bleibt und /opt/kapbeni sauber.
mkdir -p "$BACKUP_ROOT"
if [ -d "$PROD_SRC/dist" ]; then
    echo "1) Backup: $BACKUP_DIR"
    cp -a "$PROD_SRC/dist" "$BACKUP_DIR"
    echo "   Backup OK"
else
    echo "1) Backup uebersprungen (kein vorheriges dist)"
fi

# 2) Alte Backups aufraeumen (nur die letzten $KEEP behalten)
mapfile -t OLD < <(ls -1dt "$BACKUP_ROOT"/dist_* 2>/dev/null | tail -n +$((KEEP + 1)))
if [ ${#OLD[@]} -gt 0 ]; then
    echo "   Entferne ${#OLD[@]} alte Backup(s):"
    for d in "${OLD[@]}"; do echo "     - $(basename "$d")"; rm -rf "$d"; done
fi

# 3) Build - absolute Pfade via --prefix statt cd
echo "2) Build starten..."
npm --prefix "$PROD_SRC" run build

# 4) Verifikation
echo "3) Verifikation..."
test -f "$PROD_SRC/dist/index.html" || { echo "   FEHLER: index.html fehlt!"; exit 1; }
for target in "http://localhost:3003/" "http://localhost:3001/api/health"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$target" || echo "000")
    printf '   %-40s HTTP %s\n' "$target" "$code"
done

echo ""
echo "=== Build abgeschlossen! ==="
echo "Neue dist: $PROD_SRC/dist"
echo "Live unter: https://kapbeni.com  |  http://192.168.50.100:3003"
