import { type ChildProcess, spawn, spawnSync, type StdioOptions } from "node:child_process";
import { resolveExecutable } from "./resolve-executable.ts";

type ParentDeathSpawnOptions = {
    stdio?: StdioOptions;
    env?: NodeJS.ProcessEnv;
};

const NAMESPACE_ARGS = ["--user", "--pid", "--fork", "--map-current-user", "--kill-child", "--"];
const SUPERVISOR_ARGS = ["--fork", "--"];

const NAMESPACE_KNOBS = [
    "/proc/sys/user/max_user_namespaces",
    "kernel.unprivileged_userns_clone",
    "kernel.apparmor_restrict_unprivileged_userns",
];

const requireNamespaces = createNamespaceGuard();

const buildArgs = (unshare: string, executable: string, args: string[]): string[] => [
    "--pdeathsig",
    "SIGKILL",
    unshare,
    ...NAMESPACE_ARGS,
    unshare,
    ...SUPERVISOR_ARGS,
    executable,
    ...args,
];

const namespaceFailureMessage = (details: string): string =>
    [
        "GTKX spawns helper processes inside an unprivileged user and PID namespace so that the kernel reaps",
        "them when this process dies, and this system refused to create one.",
        `unshare reported: ${details}`,
        `Check ${NAMESPACE_KNOBS.join(", ")}, and any seccomp profile that blocks unshare(2).`,
    ].join("\n");

const probeNamespaces = (unshare: string): string | null => {
    const probe = spawnSync(unshare, [...NAMESPACE_ARGS, unshare, ...SUPERVISOR_ARGS, resolveExecutable("true")], {
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
    });

    if (probe.error) {
        return probe.error.message;
    }

    return probe.status === 0 ? null : probe.stderr.trim();
};

function createNamespaceGuard(): (unshare: string) => void {
    let isProbed = false;
    let failure: string | null = null;

    return (unshare) => {
        if (!isProbed) {
            isProbed = true;
            failure = probeNamespaces(unshare);
        }

        if (failure !== null) {
            throw new Error(namespaceFailureMessage(failure));
        }
    };
}

function spawnWithParentDeathSignal(
    command: string,
    args: string[],
    options: ParentDeathSpawnOptions = {},
): ChildProcess {
    const executable = resolveExecutable(command);
    const unshare = resolveExecutable("unshare");
    requireNamespaces(unshare);

    return spawn(resolveExecutable("setpriv"), buildArgs(unshare, executable, args), {
        detached: true,
        stdio: options.stdio ?? "ignore",
        env: options.env ?? process.env,
    });
}

export { spawnWithParentDeathSignal };
