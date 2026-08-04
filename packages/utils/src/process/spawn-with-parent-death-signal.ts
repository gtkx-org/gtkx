import { type ChildProcess, spawn, type StdioOptions } from "node:child_process";
import { resolveExecutable } from "./resolve-executable.ts";

type ParentDeathSpawnOptions = {
    stdio?: StdioOptions;
    env?: NodeJS.ProcessEnv;
};

const PARENT_DEATH_SCRIPT = "trap 'kill -9 -$$ 2>/dev/null' TERM INT HUP; \"$@\" & child=$!; wait \"$child\"";

function spawnWithParentDeathSignal(
    command: string,
    args: string[],
    options: ParentDeathSpawnOptions = {},
): ChildProcess {
    return spawn(
        resolveExecutable("setpriv"),
        ["--pdeathsig", "SIGTERM", "sh", "-c", PARENT_DEATH_SCRIPT, "sh", resolveExecutable(command), ...args],
        { detached: true, stdio: options.stdio ?? "ignore", env: options.env ?? process.env },
    );
}

export { spawnWithParentDeathSignal };
