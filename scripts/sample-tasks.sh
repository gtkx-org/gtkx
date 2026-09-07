#!/usr/bin/env bash
set -uo pipefail

INTERVAL="${1:-15}"

count_state() {
    awk -F':[[:space:]]*' '/^State:/ { print substr($2, 1, 1); exit }' "$1/status" 2>/dev/null
}

parent_of() {
    awk -F':[[:space:]]*' '/^PPid:/ { print $2; exit }' "$1/status" 2>/dev/null
}

report_zombie_parents() {
    local dir state ppid
    local -A owners=()

    for dir in /proc/[0-9]*; do
        state=$(count_state "$dir")

        if [ "$state" = "Z" ]; then
            ppid=$(parent_of "$dir")
            owners["${ppid:-0}"]=$(( ${owners["${ppid:-0}"]:-0} + 1 ))
        fi
    done

    for ppid in "${!owners[@]}"; do
        printf '%s %s %s\n' "${owners[$ppid]}" "$ppid" "$(cat "/proc/$ppid/comm" 2>/dev/null || echo gone)"
    done | sort -rn | head -5 | while read -r count pid comm; do
        printf 'ZOMBIEPARENT ppid=%s comm=%s state=%s children=%s\n' \
            "$pid" "$comm" "$(count_state "/proc/$pid" || echo gone)" "$count"
    done
}

sample() {
    local guard=0 sway=0 dbus=0 swaybg=0 shells=0 sleepers=0 node=0 vitest=0 zombie=0 tasks=0 procs=0
    local dir comm state count cmdline

    for dir in /proc/[0-9]*; do
        comm=$(cat "$dir/comm" 2>/dev/null) || continue
        procs=$((procs + 1))
        count=$(ls "$dir/task" 2>/dev/null | wc -l)
        tasks=$((tasks + count))
        state=$(count_state "$dir")

        if [ "$state" = "Z" ]; then
            zombie=$((zombie + 1))
        fi

        case "$comm" in
            sway) sway=$((sway + 1)) ;;
            swaybg) swaybg=$((swaybg + 1)) ;;
            dbus-daemon) dbus=$((dbus + 1)) ;;
            sh) shells=$((shells + 1)) ;;
            sleep) sleepers=$((sleepers + 1)) ;;
            node)
                node=$((node + 1))
                cmdline=$(tr '\0' ' ' <"$dir/cmdline" 2>/dev/null) || cmdline=""
                case "$cmdline" in
                    *process-guard*) guard=$((guard + 1)) ;;
                    *vitest*) vitest=$((vitest + 1)) ;;
                esac
                ;;
        esac
    done

    printf 'TASKSAMPLE t=%s pids=%s/%s procs=%s tasks=%s node=%s guard=%s vitest=%s sway=%s swaybg=%s dbus=%s sh=%s sleep=%s zombie=%s\n' \
        "$(date +%s)" \
        "$(cat /sys/fs/cgroup/pids.current 2>/dev/null || echo -1)" \
        "$(cat /sys/fs/cgroup/pids.max 2>/dev/null || echo -1)" \
        "$procs" "$tasks" "$node" "$guard" "$vitest" "$sway" "$swaybg" "$dbus" "$shells" "$sleepers" "$zombie"
}

while true; do
    sample
    report_zombie_parents
    sleep "$INTERVAL"
done
