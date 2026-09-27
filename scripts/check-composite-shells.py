import pathlib
import re
import subprocess

import yaml


for path in sorted(pathlib.Path(".github/actions").glob("*/action.y*ml")):
    action = yaml.safe_load(path.read_text())
    for index, step in enumerate(action.get("runs", {}).get("steps", [])):
        source = step.get("run")
        if source is None:
            continue
        shell = step.get("shell", "bash").split()[0]
        if shell not in {"bash", "sh"}:
            continue
        print(f"Checking {path}, step {index + 1}", flush=True)
        subprocess.run(
            ["shellcheck", f"--shell={shell}", "-"],
            input=re.sub(r"\$\{\{.*?\}\}", "GTKX_EXPRESSION", source, flags=re.DOTALL),
            text=True,
            check=True,
        )
