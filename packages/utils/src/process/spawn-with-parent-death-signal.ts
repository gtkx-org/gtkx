import { type ChildProcess, spawn, type StdioOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Socket } from "node:net";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { killMarkedProcesses, PROCESS_MARKER } from "./kill-marked-processes.ts";
import {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    removeCleanupDirectory,
} from "./kill-process-group.ts";
import { resolveExecutable } from "./resolve-executable.ts";

type ParentDeathSpawnOptions = {
    stdio?: StdioOptions;
    env?: NodeJS.ProcessEnv;
    cleanupDirectories?: string[];
};

type ParentDeathSupervisorOptions = Omit<ParentDeathSpawnOptions, "cleanupDirectories"> & {
    cleanupDirectory: string;
};

type GuardSignal = "SIGKILL" | "SIGCONT";

type ProcessIdentity = {
    pid: number;
    startTime: string;
};

type ProcessWatch = {
    owner: ProcessIdentity;
    target: ProcessIdentity;
};

type LaunchArguments = (executable: string, cleanupDirectories: CleanupDirectoryIdentity[]) => string[];

type GuardJob = {
    marker: string;
    processGroup: ProcessGroupIdentity;
    cleanupDirectories: CleanupDirectoryIdentity[];
    signal: GuardSignal;
};

type GuardState = {
    child?: ChildProcess | undefined;
    jobs: Map<string, GuardJob>;
    watch?: ProcessWatch;
};

type SpawnRollback = {
    child: ChildProcess;
    marker: string;
    processGroup?: ProcessGroupIdentity;
    cleanupDirectories?: CleanupDirectoryIdentity[];
};

const MODULE_PATH = fileURLToPath(import.meta.url);
const GUARD_PATH = join(dirname(MODULE_PATH), `process-guard${extname(MODULE_PATH)}`);
const RUN_ID = randomBytes(8).toString("hex");
const RUN_PREFIX = `${PROCESS_MARKER}=${RUN_ID}/`;
const guard: GuardState = { jobs: new Map() };
const SUPERVISOR_NAME = "gtkx-process-supervisor";
const SUPERVISOR_CLEANUP_NAME = "gtkx-process-cleanup";
const SUPERVISOR_WATCH_NAME = "gtkx-process-watch";
const SUPERVISOR_KILL_GROUP_BODY = [
    "remaining=40",
    'while [ "$remaining" -gt 0 ] && kill -KILL "-$group" 2>/dev/null; do',
    '    "$sleep_command" 0.025',
    "    remaining=$((remaining - 1))",
    "done",
];
const SUPERVISOR_REMOVE_RUNTIME_BODY = [
    "remaining=40",
    'while [ "$remaining" -gt 0 ] && ' +
    '[ "$("$stat_command" -c "%d:%i:%u" -- "$runtime" 2>/dev/null)" = "$identity" ]; do',
    '    "$rm_command" -rf -- "$runtime"',
    '    "$sleep_command" 0.025',
    "    remaining=$((remaining - 1))",
    "done",
];
const SUPERVISOR_CLEANUP_BODY = [...SUPERVISOR_KILL_GROUP_BODY, ...SUPERVISOR_REMOVE_RUNTIME_BODY];
const SUPERVISOR_CLEANUP_SCRIPT = [
    "runtime=$1",
    "identity=$2",
    "group=$3",
    "stat_command=$4",
    "rm_command=$5",
    "sleep_command=$6",
    ...SUPERVISOR_CLEANUP_BODY,
].join("\n");
const SUPERVISOR_WATCH_SCRIPT = [
    "runtime=$1",
    "identity=$2",
    "group=$3",
    "group_start=$4",
    "expected_parent=$5",
    "expected_parent_start=$6",
    "stat_command=$7",
    "rm_command=$8",
    "sleep_command=$9",
    "matches_process() {",
    "    expected_process=$1",
    "    expected_start=$2",
    "    process_stat=",
    '    IFS= read -r process_stat < "/proc/$expected_process/stat" || return 1',
    "    process_tail=${process_stat##*) }",
    "    set -- $process_tail",
    '    case "$1" in Z|X|x) return 1 ;; esac',
    '    [ "${20}" = "$expected_start" ]',
    "}",
    "matches_parent() {",
    '    matches_process "$expected_parent" "$expected_parent_start"',
    "}",
    "kill_group() {",
    ...SUPERVISOR_KILL_GROUP_BODY.map((line) => `    ${line}`),
    "}",
    "cleanup() {",
    '    trap "" TERM INT HUP',
    "    kill_group",
    ...SUPERVISOR_REMOVE_RUNTIME_BODY.map((line) => `    ${line}`),
    "    exit 0",
    "}",
    "trap cleanup TERM INT HUP",
    'while matches_process "$group" "$group_start" && matches_parent; do',
    '    "$sleep_command" 0.1',
    "done",
    "kill_group",
    "while matches_parent; do",
    '    "$sleep_command" 0.1',
    "done",
    "cleanup",
].join("\n");
const SUPERVISOR_SCRIPT = [
    "runtime=$1",
    "identity=$2",
    "expected_parent=$3",
    "expected_parent_start=$4",
    "stat_command=$5",
    "rm_command=$6",
    "shell_command=$7",
    "setsid_command=$8",
    "sleep_command=$9",
    "shift 9",
    "watch_name=$1",
    "watch_script=$2",
    "cleanup_name=$3",
    "cleanup_script=$4",
    "shift 4",
    "process_start() {",
    "    process_stat=",
    '    IFS= read -r process_stat < "/proc/$1/stat" || return 1',
    "    process_tail=${process_stat##*) }",
    "    set -- $process_tail",
    '    case "$1" in Z|X|x) return 1 ;; esac',
    '    printf "%s" "${20}"',
    "}",
    "matches_parent() {",
    "    parent_stat=",
    '    IFS= read -r parent_stat < "/proc/$expected_parent/stat" || return 1',
    "    parent_tail=${parent_stat##*) }",
    "    set -- $parent_tail",
    '    case "$1" in Z|X|x) return 1 ;; esac',
    '    [ "${20}" = "$expected_parent_start" ]',
    "}",
    "terminate() {",
    '    trap "" CONT TERM INT HUP',
    "    while :; do",
    '        "$setsid_command" "$shell_command" -c "$cleanup_script" "$cleanup_name" "$runtime" "$identity" "$$" ' +
    '"$stat_command" "$rm_command" "$sleep_command" </dev/null >/dev/null 2>&1 &',
    "        cleanup=$!",
    '        wait "$cleanup" 2>/dev/null',
    '        "$sleep_command" 0.025',
    "    done",
    "}",
    "continue_or_terminate() {",
    "    remaining=40",
    '    while matches_parent && [ "$remaining" -gt 0 ]; do',
    '        "$sleep_command" 0.025',
    "        remaining=$((remaining - 1))",
    "    done",
    "    if ! matches_parent; then terminate; fi",
    "}",
    "trap continue_or_terminate CONT",
    "trap terminate TERM INT HUP",
    "supervisor_start=$(process_start \"$$\") || terminate",
    '( unset GTKX_PROCESS_GUARD; exec "$setsid_command" "$shell_command" -c "$watch_script" "$watch_name" "$runtime" ' +
    '"$identity" "$$" "$supervisor_start" "$expected_parent" "$expected_parent_start" "$stat_command" ' +
    '"$rm_command" "$sleep_command" ) </dev/null >/dev/null 2>&1 &',
    "child=",
    "if ! matches_parent; then terminate; fi",
    '"$@" &',
    "child=$!",
    "while :; do",
    '    wait "$child"',
    "    status=$?",
    '    if kill -0 "$child" 2>/dev/null; then continue; fi',
    '    exit "$status"',
    "done",
].join("\n");

const processIdentity = (pid: number): ProcessIdentity => {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ", 20);
    const state = fields[0];
    const startTime = fields[19];

    if (startTime === undefined || state === undefined || ["Z", "X", "x"].includes(state)) {
        throw new Error(`Failed to identify process ${String(pid)}`);
    }

    return { pid, startTime };
};

const writeGuardCommand = (child: ChildProcess, operation: "+" | "-", job: GuardJob): void => {
    child.stdin?.write(`${operation}${JSON.stringify(job)}\n`);
};

const releaseGuard = (child: ChildProcess): void => {
    child.unref();
    const { stdin } = child;

    if (stdin instanceof Socket) {
        stdin.unref();
    }
};

const isSameProcessWatch = (left: ProcessWatch, right: ProcessWatch): boolean =>
    left.owner.pid === right.owner.pid &&
    left.owner.startTime === right.owner.startTime &&
    left.target.pid === right.target.pid &&
    left.target.startTime === right.target.startTime;

const configureProcessWatch = (watch?: ProcessWatch): void => {
    if (watch === undefined) {
        return;
    }

    if (guard.watch !== undefined && !isSameProcessWatch(guard.watch, watch)) {
        throw new Error("The process guard is already watching another owner");
    }

    if (guard.child !== undefined && guard.watch === undefined) {
        throw new Error("The process guard was started before its owner was registered");
    }

    guard.watch = watch;
};

const guardArguments = (): string[] =>
    guard.watch === undefined
        ? [GUARD_PATH, RUN_PREFIX]
        : [GUARD_PATH, RUN_PREFIX, JSON.stringify(guard.watch)];

const startGuard = (watch?: ProcessWatch): void => {
    configureProcessWatch(watch);

    if (guard.child) {
        return;
    }

    const child = spawn(process.execPath, guardArguments(), {
        detached: true,
        stdio: ["pipe", "ignore", "ignore"],
    });

    child.on("error", () => {
        if (guard.child === child) {
            guard.child = undefined;
        }
    });

    child.on("exit", () => {
        if (guard.child === child) {
            guard.child = undefined;
        }
    });

    child.stdin.on("error", () => {
        if (guard.child === child) {
            guard.child = undefined;
        }
    });

    guard.child = child;

    for (const job of guard.jobs.values()) {
        writeGuardCommand(child, "+", job);
    }

    releaseGuard(child);
};

const watchParentProcess = (): void => {
    const parentId = process.ppid;
    const watch = {
        owner: processIdentity(parentId),
        target: processIdentity(process.pid),
    };

    if (process.ppid !== parentId) {
        throw new Error("The parent process exited while its guard was starting");
    }

    startGuard(watch);
};

const registerJob = (job: GuardJob): void => {
    guard.jobs.set(job.marker, job);

    if (guard.child) {
        writeGuardCommand(guard.child, "+", job);
    }
};

const unregisterJob = (job: GuardJob): void => {
    guard.jobs.delete(job.marker);

    if (guard.child) {
        writeGuardCommand(guard.child, "-", job);
    }
};

const rollbackSpawn = ({ child, marker, processGroup, cleanupDirectories = [] }: SpawnRollback): void => {
    if (processGroup === undefined) {
        child.kill("SIGKILL");
    } else {
        killProcessGroup(processGroup);
    }

    killMarkedProcesses(marker);

    for (const identity of cleanupDirectories) {
        removeCleanupDirectory(identity);
    }
};

const captureCleanupDirectories = (command: string, paths: string[]): CleanupDirectoryIdentity[] => {
    const identities = paths.map((path) => cleanupDirectoryIdentity(path));

    if (identities.includes(undefined)) {
        throw new Error(`Failed to identify a cleanup directory for ${command}`);
    }

    return identities.filter((identity): identity is CleanupDirectoryIdentity => identity !== undefined);
};

const spawnGuarded = (
    command: string,
    options: ParentDeathSpawnOptions,
    signal: GuardSignal,
    launchArguments: LaunchArguments,
): ChildProcess => {
    const executable = resolveExecutable(command);
    const setpriv = resolveExecutable("setpriv");
    const jobValue = `${RUN_ID}/${randomBytes(4).toString("hex")}`;
    const marker = `${PROCESS_MARKER}=${jobValue}`;
    const cleanupDirectories = captureCleanupDirectories(command, options.cleanupDirectories ?? []);
    startGuard();

    const child = spawn(setpriv, launchArguments(executable, cleanupDirectories), {
        detached: true,
        stdio: options.stdio ?? "ignore",
        env: { ...(options.env ?? process.env), [PROCESS_MARKER]: jobValue },
    });

    const processGroupId = child.pid;
    const group = processGroupId === undefined ? undefined : processGroupIdentity(processGroupId);

    if (group === undefined) {
        rollbackSpawn({ child, marker, cleanupDirectories });
        throw new Error(`Failed to identify process group for ${command}`);
    }

    const job: GuardJob = { marker, processGroup: group, cleanupDirectories, signal };
    registerJob(job);

    child.on("exit", () => {
        killMarkedProcesses(job.marker);
        unregisterJob(job);
    });

    return child;
};

function spawnWithParentDeathSignal(
    command: string,
    args: string[],
    options: ParentDeathSpawnOptions = {},
): ChildProcess {
    return spawnGuarded(
        command,
        options,
        "SIGKILL",
        (executable) => ["--pdeathsig", "SIGKILL", executable, ...args],
    );
}

const spawnWithParentDeathSupervisor = (
    command: string,
    args: string[],
    options: ParentDeathSupervisorOptions,
): ChildProcess => {
    const shell = resolveExecutable("sh");
    const stat = resolveExecutable("stat");
    const rm = resolveExecutable("rm");
    const setsid = resolveExecutable("setsid");
    const sleep = resolveExecutable("sleep");

    return spawnGuarded(
        command,
        { ...options, cleanupDirectories: [options.cleanupDirectory] },
        "SIGCONT",
        (executable, cleanupDirectories) => {
            const identity = cleanupDirectories[0];

            if (identity === undefined) {
                throw new Error(`Failed to identify a cleanup directory for ${command}`);
            }

            return [
                "--pdeathsig",
                "SIGCONT",
                shell,
                "-c",
                SUPERVISOR_SCRIPT,
                SUPERVISOR_NAME,
                identity.path,
                `${identity.device}:${identity.inode}:${identity.userId}`,
                String(process.pid),
                processIdentity(process.pid).startTime,
                stat,
                rm,
                shell,
                setsid,
                sleep,
                SUPERVISOR_WATCH_NAME,
                SUPERVISOR_WATCH_SCRIPT,
                SUPERVISOR_CLEANUP_NAME,
                SUPERVISOR_CLEANUP_SCRIPT,
                executable,
                ...args,
            ];
        },
    );
};

export { spawnWithParentDeathSignal, spawnWithParentDeathSupervisor, watchParentProcess };
