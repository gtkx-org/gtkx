#!/usr/bin/env bash
# Republish the branch to the bug-hunt registry and rebuild the template app against it, so every
# hunter installs the code on bugfix/v1.0 rather than the stale 1.0.0 on public npm.
#
#   .bughunt/refresh-template.sh
#
# Leaves a Verdaccio serving http://localhost:4873/ in the background and a warm template at
# /home/eugenio/gtkx-playground/bughunt-template. Run it after every merge, before the next hunt.

set -uo pipefail

WORKTREE=/home/eugenio/gtkx-bughunt
PLAYGROUND=/home/eugenio/gtkx-playground
TEMPLATE=$PLAYGROUND/bughunt-template
REGISTRY=http://localhost:4873/
LOG=$PLAYGROUND/bughunt-registry.log

pkill -f "bughunt/registry.ts" 2>/dev/null
sleep 2

echo "publishing the workspace to $REGISTRY (this builds the native addon, takes a few minutes)"
cd "$WORKTREE"
setsid npx tsx .bughunt/registry.ts > "$LOG" 2>&1 &

for _ in $(seq 1 180); do
    grep -q "bughunt-registry: ready" "$LOG" 2>/dev/null && break
    sleep 2
done

if ! grep -q "bughunt-registry: ready" "$LOG" 2>/dev/null; then
    echo "registry did not come up; see $LOG"
    tail -20 "$LOG"
    exit 1
fi

echo "registry up; rebuilding the template"
rm -rf "$TEMPLATE"
mkdir -p "$TEMPLATE"
cd "$TEMPLATE"

npm config set registry "$REGISTRY" --location project 2>/dev/null
npx --yes --registry "$REGISTRY" create-gtkx@latest . \
    --application-id com.gtkx.bughunt --package-manager npm --typescript --vitest --yes --overwrite \
    > "$PLAYGROUND/bughunt-template-create.log" 2>&1

if [ ! -f "$TEMPLATE/package.json" ]; then
    echo "scaffold failed; see $PLAYGROUND/bughunt-template-create.log"
    tail -20 "$PLAYGROUND/bughunt-template-create.log"
    exit 1
fi

npm install --registry "$REGISTRY" @gtkx/components@latest @gtkx/gl@latest >/dev/null 2>&1

cat > gtkx.config.ts <<'EOF'
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"],
    applicationId: "com.gtkx.bughunt",
});
EOF

npm run codegen >/dev/null 2>&1 && npm run build >/dev/null 2>&1

echo "template ready at $TEMPLATE, built from the branch"
node -e 'const p=require("./package.json");console.log("  @gtkx/react",p.dependencies["@gtkx/react"],"| @gtkx/cli",p.devDependencies["@gtkx/cli"])'
