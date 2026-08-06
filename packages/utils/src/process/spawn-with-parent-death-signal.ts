import { type ChildProcess, spawn, type StdioOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Socket } from "node:net";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { killMarkedProcesses, PROCESS_MARKER } from "./kill-marked-processes.ts";
import { resolveExecutable } from "./resolve-executable.ts";

type ParentDeathSpawnOptions = {
    stdio?: StdioOptions;
    env?: NodeJS.ProcessEnv;
};

type GuardState = {
    child?: ChildProcess;
};

const MODULE_PATH = fileURLToPath(import.meta.url);
const GUARD_PATH = join(dirname(MODULE_PATH), `process-guard${extname(MODULE_PATH)}`);
const RUN_ID = randomBytes(8).toString("hex");
const RUN_PREFIX = `${PROCESS_MARKER}=${RUN_ID}/`;
const guard: GuardState = {};

const releaseGuard = (child: ChildProcess): void => {
    child.unref();
    const { stdin } = child;

    if (stdin instanceof Socket) {
        stdin.unref();
    }
};

const startGuard = (): void => {
    if (guard.child) {
        return;
    }

    guard.child = spawn(process.execPath, [GUARD_PATH, RUN_PREFIX], {
        detached: true,
        stdio: ["pipe", "ignore", "ignore"],
    });

    releaseGuard(guard.child);
};

function spawnWithParentDeathSignal(
    command: string,
    args: string[],
    options: ParentDeathSpawnOptions = {},
): ChildProcess {
    const executable = resolveExecutable(command);
    const setpriv = resolveExecutable("setpriv");
    const jobValue = `${RUN_ID}/${randomBytes(4).toString("hex")}`;
    startGuard();

    const child = spawn(setpriv, ["--pdeathsig", "SIGKILL", executable, ...args], {
        detached: true,
        stdio: options.stdio ?? "ignore",
        env: { ...(options.env ?? process.env), [PROCESS_MARKER]: jobValue },
    });

    child.on("exit", () => {
        killMarkedProcesses(`${PROCESS_MARKER}=${jobValue}`);
    });

    return child;
}

export { spawnWithParentDeathSignal };
