#!/bin/bash
set -e

cd "$(dirname "$0")/.."

status=0

for entry in flatpak/*.desktop; do
    if ! grep -q '^DBusActivatable[[:space:]]*=[[:space:]]*true[[:space:]]*$' "$entry"; then
        continue
    fi

    name="$(basename "$entry" .desktop)"
    service="dbus-1/services/${name//./\\.}\.service"

    for manifest in flatpak/*.yaml; do
        if grep -q "$service" "$manifest"; then
            continue
        fi

        echo "Error: $entry declares DBusActivatable=true, but $manifest installs no" >&2
        echo "       /app/share/dbus-1/services/$name.service, so 'flatpak build-export'" >&2
        echo "       refuses the app after every build command has already run." >&2
        status=1
    done
done

exit "$status"
