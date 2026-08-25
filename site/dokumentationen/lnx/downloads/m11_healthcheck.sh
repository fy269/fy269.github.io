#!/bin/bash

PROJECT_DIR="/home/student/linux_m11"
LOG_FILE="$PROJECT_DIR/logs/m11_healthcheck.log"

mkdir -p "$(dirname "$LOG_FILE")"

{
  echo "===== M11 Healthcheck ====="
  echo "Zeitpunkt: $(date)"
  echo "Host: $(hostname)"
  echo "Ausgeführt als: $(whoami)"
  echo

  echo "=== Dateisystem / ==="
  df -h /
  echo

  echo "=== Speicherstatus ==="
  free -h
  echo

  echo "=== Load Average / Uptime ==="
  uptime
  echo

  echo "=== Fehlgeschlagene systemd-Units ==="
  systemctl --failed --no-pager || true
  echo

  echo "=== Ende Healthcheck ==="
  echo
} | tee -a "$LOG_FILE"

exit 0
