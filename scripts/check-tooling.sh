set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
command -v shellcheck > /dev/null
go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 -pyflakes=
python3 scripts/check-composite-shells.py
python3 scripts/check-toolchain-versions.py

while IFS= read -r -d '' script; do
  shellcheck --shell=bash "$script"
done < <(git ls-files -z -- '*.sh')
