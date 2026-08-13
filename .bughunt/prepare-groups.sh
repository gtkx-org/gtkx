#!/usr/bin/env bash
# Create one git worktree per fix group, installed and built, so group fixes can run in parallel
# without racing on a shared tree.
#
#   .bughunt/prepare-groups.sh            create or refresh every group worktree
#   .bughunt/prepare-groups.sh <name>...  only the named groups
#
# Each worktree sits at /home/eugenio/gtkx-fix-<name> on branch fixgrp/<name>, branched from the
# current bugfix/v1.0. Merging happens later with .bughunt/merge-groups.sh.

set -euo pipefail

ROOT=/home/eugenio/gtkx
BASE=bugfix/v1.0

mapfile -t ALL < <(node -e '
    const groups = require("'"$ROOT"'/.bughunt/groups.json").groups;
    for (const group of groups) console.log(group.name);
')

names=("$@")
if [ "${#names[@]}" -eq 0 ]; then
    names=("${ALL[@]}")
fi

prepare() {
    local name="$1"
    local path="/home/eugenio/gtkx-fix-$name"
    local branch="fixgrp/$name"

    if [ -d "$path" ]; then
        echo "[$name] already present, refreshing onto $BASE"
        git -C "$path" merge --ff-only "$BASE" >/dev/null 2>&1 || echo "[$name] not fast-forwardable, leaving as is"
    else
        echo "[$name] creating worktree"
        git -C "$ROOT" worktree add "$path" -b "$branch" "$BASE" >/dev/null
    fi

    (
        cd "$path"
        pnpm install >/dev/null 2>&1
        pnpm nx run-many -t build --exclude @gtkx/website >/dev/null 2>&1
    )

    echo "[$name] ready at $path"
}

for name in "${names[@]}"; do
    prepare "$name" &
done

wait
echo "all groups ready"
