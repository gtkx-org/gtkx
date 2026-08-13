#!/usr/bin/env bash
# Merge every fix-group branch back into bugfix/v1.0, one at a time, stopping on the first conflict
# so a human or agent can resolve it rather than a script guessing.
#
#   .bughunt/merge-groups.sh            merge every group that has commits
#   .bughunt/merge-groups.sh <name>...  only the named groups

set -uo pipefail

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

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    echo "refusing to merge: $ROOT has uncommitted changes"
    exit 1
fi

for name in "${names[@]}"; do
    branch="fixgrp/$name"

    if ! git -C "$ROOT" rev-parse --verify "$branch" >/dev/null 2>&1; then
        echo "[$name] no branch, skipping"
        continue
    fi

    ahead=$(git -C "$ROOT" rev-list --count "$BASE..$branch")

    if [ "$ahead" -eq 0 ]; then
        echo "[$name] no commits, skipping"
        continue
    fi

    echo "[$name] merging $ahead commit(s)"

    if git -C "$ROOT" merge --no-ff --no-edit "$branch" >/dev/null 2>&1; then
        echo "[$name] merged"
    else
        echo "[$name] CONFLICT — resolve in $ROOT, then re-run for the remaining groups:"
        git -C "$ROOT" diff --name-only --diff-filter=U
        exit 2
    fi
done

echo "all groups merged; now run the full pipeline"
