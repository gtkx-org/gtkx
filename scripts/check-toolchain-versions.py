import json
import pathlib
import re
import tomllib


def value(pattern, source):
    match = re.search(pattern, source, re.MULTILINE)
    if match is None:
        raise ValueError(f"Missing toolchain declaration: {pattern}")
    return match.group(1)


root = pathlib.Path(__file__).resolve().parent.parent
dockerfile = (root / ".github/docker/Dockerfile").read_text()
rust = tomllib.loads((root / "rust-toolchain.toml").read_text())["toolchain"]
manifest = json.loads((root / "package.json").read_text())
nightly = (root / "scripts/rust-nightly.ts").read_text()
minimum = (root / "scripts/check-minimum-node.sh").read_text()

versions = {
    "Rust": (rust["channel"], value(r"^ARG RUST_VERSION=(\S+)$", dockerfile)),
    "pnpm": (
        value(r"^pnpm@([^+]+)", manifest["packageManager"]),
        value(r"\bpnpm@([\d.]+)\b", dockerfile),
    ),
    "Rust nightly": (
        value(r'const RUST_NIGHTLY = "([^"]+)";', nightly),
        value(r"^ARG RUST_NIGHTLY=(\S+)$", dockerfile),
    ),
    "Minimum Node": (manifest["engines"]["node"], ">=" + value(r"^minimum_node=(\S+)$", minimum)),
}

for tool, (source_version, ci_version) in versions.items():
    if source_version != ci_version:
        raise ValueError(f"{tool} toolchain drift: {source_version} != {ci_version}")
    print(f"{tool}: {source_version}")
