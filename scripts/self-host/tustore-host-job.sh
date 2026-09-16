#!/usr/bin/env bash
set -euo pipefail
umask 077

job=${1:?cpi or cpi-full}
case "$job" in
  cpi|cpi-full)
    exec 9>/run/lock/tustore-cpi.lock
    flock -n 9 || { echo 'TuStore: ya hay otra sincronización CPI en curso'; exit 0; }
    days=3
    [[ "$job" == cpi-full ]] && days=31
    exec docker run --rm --name tustore-cpi-job --network coolify \
      --memory=768m --cpus=1 --cap-drop=ALL --security-opt=no-new-privileges \
      --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
      --env-file /etc/tustore/runtime.env -e "TUSTORE_SYNC_LOOKBACK_DAYS=$days" \
      tustore-cpi:local
    ;;
  *) echo 'Trabajo de TuStore desconocido'; exit 1 ;;
esac
