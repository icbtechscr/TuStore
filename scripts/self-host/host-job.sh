#!/usr/bin/env bash
set -euo pipefail
umask 077
job=${1:?cpi, cpi-full, reminder, or reminder-test}
app=e3qib0s0vmfx7ex10uzea2dh
case "$job" in
  cpi|cpi-full)
    exec 9>/run/lock/icb-cpi.lock
    flock -n 9 || { echo 'ICB: another CPI sync is running'; exit 0; }
    days=3
    [[ "$job" == cpi-full ]] && days=31
    exec docker run --rm --name icb-cpi-job --network coolify \
      --memory=768m --cpus=1 --cap-drop=ALL --security-opt=no-new-privileges \
      --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
      --env-file /etc/icb/runtime.env -e "ICB_SYNC_LOOKBACK_DAYS=$days" \
      icb-cpi:local
    ;;
  reminder|reminder-test)
    exec 9>/run/lock/icb-reminder.lock
    flock -n 9 || exit 0
    mapfile -t containers < <(docker ps --filter "name=^${app}-" --format '{{.Names}}')
    [[ ${#containers[@]} -eq 1 ]] || { echo 'Expected one active ICB web container'; exit 1; }
    args=()
    [[ "$job" == reminder-test ]] && args+=(--dry-run)
    exec docker exec "${containers[0]}" node scripts/self-host/run-reminder.mjs "${args[@]}"
    ;;
  *) echo 'Unknown ICB job'; exit 1 ;;
esac
