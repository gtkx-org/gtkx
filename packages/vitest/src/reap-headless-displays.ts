import {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    info,
    type ProcessIdentity,
    readProcessIdentity,
    removeCleanupDirectory,
} from "@gtkx/utils";
import { constants, lstatSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
    createBusConfig,
    HEADLESS_HELPER_ENV,
    HEADLESS_RUNTIME_MARKER,
    isSwayConfig,
    readHeadlessRuntimeState,
} from "./headless-config.ts";

type StaleHeadlessDisplay = {
    runtimeDir: string;
    cleanupDirectory: CleanupDirectoryIdentity;
    owner?: ProcessIdentity;
};

type RuntimeProcesses = {
    live: Set<string>;
    helpers: Map<string, ProcessIdentity[]>;
};

const RUNTIME_DIRECTORY_PATTERN = /^gtkx-xdg-[A-Za-z0-9]{6}$/;
const STOPPED_PROCESS_STATES: Set<string> = new Set(["Z", "X", "x"]);
const CONFIG_SIZE_LIMIT = 2048;
const MINIMUM_STALE_AGE_MS = 5000;
const RUNTIME_ROOT = tmpdir();

const currentUserId = (): number | undefined => {
    const getuid = process.getuid;

    return getuid === undefined ? undefined : getuid();
};

const isUserOwned = (path: string, userId: number): boolean => {
    try {
        return lstatSync(path).uid === userId;
    } catch {
        return false;
    }
};

const isPrivateRuntimeDirectory = (runtimeDir: string, userId: number): boolean => {
    try {
        const stat = lstatSync(runtimeDir);

        return (
            stat.isDirectory() &&
            stat.uid === userId &&
            (stat.mode & 0o777) === 0o700 &&
            Date.now() - stat.mtimeMs >= MINIMUM_STALE_AGE_MS &&
            RUNTIME_DIRECTORY_PATTERN.test(basename(runtimeDir)) &&
            dirname(runtimeDir) === RUNTIME_ROOT
        );
    } catch {
        return false;
    }
};

const readOwnedFile = (path: string, runtimeDir: string, userId: number, requiredMode?: number): string | undefined => {
    try {
        if (dirname(path) !== runtimeDir) {
            return undefined;
        }

        const contents = readFileSync(path, {
            encoding: "utf8",
            flag: constants.O_RDONLY | constants.O_NOFOLLOW,
        });
        const stat = lstatSync(path);

        return stat.isFile() &&
            stat.uid === userId &&
            stat.size < CONFIG_SIZE_LIMIT &&
            (requiredMode === undefined || (stat.mode & 0o777) === requiredMode)
            ? contents
            : undefined;
    } catch {
        return undefined;
    }
};

const hasOnlyBusConfig = (runtimeDir: string): boolean => {
    try {
        const entries = readdirSync(runtimeDir);

        return entries.length === 1 && entries[0] === "session.conf";
    } catch {
        return false;
    }
};

const hasGeneratedRuntimeFiles = (runtimeDir: string, userId: number): boolean => {
    const marker = readOwnedFile(join(runtimeDir, HEADLESS_RUNTIME_MARKER), runtimeDir, userId, 0o600);
    if (readHeadlessRuntimeState(runtimeDir, marker) !== undefined) return true;
    const bus = readOwnedFile(join(runtimeDir, "session.conf"), runtimeDir, userId);

    if (bus !== createBusConfig(join(runtimeDir, "bus"))) {
        return false;
    }

    const sway = readOwnedFile(join(runtimeDir, "sway.conf"), runtimeDir, userId);
    return (
        marker === ["gtkx-headless-runtime-v1", `runtime=${runtimeDir}`, ""].join("\n") ||
        (sway !== undefined && isSwayConfig(sway)) ||
        hasOnlyBusConfig(runtimeDir)
    );
};

const readProcessArguments = (pid: number): string[] | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const state = stat.slice(stat.lastIndexOf(") ") + 2).split(" ", 1)[0];

        if (state === undefined || STOPPED_PROCESS_STATES.has(state)) {
            return undefined;
        }

        return readFileSync(`/proc/${String(pid)}/cmdline`)
            .toString()
            .split("\0")
            .filter((argument) => argument.length > 0);
    } catch {
        return undefined;
    }
};

const runtimeFromArgument = (argument: string): string | undefined => {
    const path = argument.startsWith("--config-file=") ? argument.slice("--config-file=".length) : argument;
    const name = basename(path);

    if (name !== "sway.conf" && name !== "session.conf") {
        return undefined;
    }

    const runtimeDir = dirname(path);

    return RUNTIME_DIRECTORY_PATTERN.test(basename(runtimeDir)) && dirname(runtimeDir) === RUNTIME_ROOT
        ? runtimeDir
        : undefined;
};

const runtimeFromEnvironment = (pid: number): { runtimeDir: string; helper: boolean } | undefined => {
    try {
        const prefix = "XDG_RUNTIME_DIR=";
        const environment = readFileSync(`/proc/${String(pid)}/environ`, "utf8").split("\0");
        const entry = environment.find((value) => value.startsWith(prefix));
        const runtimeDir = entry?.slice(prefix.length);

        return runtimeDir !== undefined &&
            RUNTIME_DIRECTORY_PATTERN.test(basename(runtimeDir)) &&
            dirname(runtimeDir) === RUNTIME_ROOT
            ? { runtimeDir, helper: environment.includes(`${HEADLESS_HELPER_ENV}=${runtimeDir}`) }
            : undefined;
    } catch {
        return undefined;
    }
};

const isOwnedProcessId = (pid: number, userId: number): boolean =>
    Number.isSafeInteger(pid) && pid > 1 && isUserOwned(`/proc/${String(pid)}`, userId);

const addRuntimeArguments = (live: Set<string>, processArgs: string[]): void => {
    for (const argument of processArgs) {
        const runtimeDir = runtimeFromArgument(argument);

        if (runtimeDir !== undefined) {
            live.add(runtimeDir);
        }
    }
};

const addProcessRuntimes = (processes: RuntimeProcesses, pid: number): void => {
    const processArgs = readProcessArguments(pid);

    if (processArgs === undefined) {
        return;
    }

    const references = new Set<string>();
    addRuntimeArguments(references, processArgs);
    const runtime = runtimeFromEnvironment(pid);
    const identity = readProcessIdentity(pid);

    if (runtime !== undefined) {
        references.add(runtime.runtimeDir);
        if (runtime.helper && identity !== undefined) {
            const helpers = processes.helpers.get(runtime.runtimeDir) ?? [];
            helpers.push(identity);
            processes.helpers.set(runtime.runtimeDir, helpers);
        }
    }
    for (const runtimeDir of references) {
        processes.live.add(runtimeDir);
    }
};

const findRuntimeProcesses = (userId: number): RuntimeProcesses => {
    const processes: RuntimeProcesses = { live: new Set(), helpers: new Map() };
    const processEntries = readdirSync("/proc");

    for (const entry of processEntries) {
        const pid = Number(entry);

        if (!isOwnedProcessId(pid, userId)) {
            continue;
        }

        addProcessRuntimes(processes, pid);
    }

    return processes;
};

const runtimeState = (runtimeDir: string, userId: number) =>
    readHeadlessRuntimeState(
        runtimeDir,
        readOwnedFile(join(runtimeDir, HEADLESS_RUNTIME_MARKER), runtimeDir, userId, 0o600),
    );

const isCurrentOwner = (owner: ProcessIdentity): boolean =>
    readProcessIdentity(owner.pid)?.startTime === owner.startTime;

const classifyRuntimeDirectory = (name: string, userId: number, live: ReadonlySet<string>): StaleHeadlessDisplay[] => {
    const runtimeDir = join(RUNTIME_ROOT, name);
    const owner = runtimeState(runtimeDir, userId)?.owner;

    if (
        (owner === undefined ? live.has(runtimeDir) : isCurrentOwner(owner)) ||
        !isPrivateRuntimeDirectory(runtimeDir, userId) ||
        !hasGeneratedRuntimeFiles(runtimeDir, userId)
    ) {
        return [];
    }

    const cleanupDirectory = cleanupDirectoryIdentity(runtimeDir);

    return cleanupDirectory === undefined ? [] : [{ runtimeDir, cleanupDirectory, ...(owner && { owner }) }];
};

const findStaleHeadlessDisplays = (): StaleHeadlessDisplay[] => {
    const userId = currentUserId();

    if (userId === undefined) {
        return [];
    }

    const { live } = findRuntimeProcesses(userId);

    return readdirSync(RUNTIME_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && RUNTIME_DIRECTORY_PATTERN.test(entry.name))
        .flatMap((entry) => classifyRuntimeDirectory(entry.name, userId, live));
};

const isSameCleanupDirectory = (left: CleanupDirectoryIdentity | undefined, right: CleanupDirectoryIdentity): boolean =>
    left?.device === right.device && left.inode === right.inode && left.userId === right.userId;

const isReapable = (candidate: StaleHeadlessDisplay, userId: number, live: ReadonlySet<string>): boolean => {
    const owner = runtimeState(candidate.runtimeDir, userId)?.owner;
    const ownershipMatches =
        owner === undefined
            ? candidate.owner === undefined && !live.has(candidate.runtimeDir)
            : owner.pid === candidate.owner?.pid &&
              owner.startTime === candidate.owner.startTime &&
              !isCurrentOwner(owner);
    return (
        ownershipMatches &&
        isSameCleanupDirectory(cleanupDirectoryIdentity(candidate.runtimeDir), candidate.cleanupDirectory) &&
        isPrivateRuntimeDirectory(candidate.runtimeDir, userId) &&
        hasGeneratedRuntimeFiles(candidate.runtimeDir, userId)
    );
};

const signalRuntimeHelper = (
    identity: ProcessIdentity,
    runtimeDir: string,
    userId: number,
    signal: NodeJS.Signals,
): boolean => {
    const runtime = runtimeFromEnvironment(identity.pid);
    const recorded = runtimeState(runtimeDir, userId)?.helpers.some(
        (helper) => helper.pid === identity.pid && helper.startTime === identity.startTime,
    );
    if (
        !isOwnedProcessId(identity.pid, userId) ||
        (!recorded && (runtime?.runtimeDir !== runtimeDir || !runtime.helper)) ||
        !isCurrentOwner(identity)
    ) {
        return true;
    }
    try {
        process.kill(identity.pid, signal);
        return true;
    } catch {
        return !isCurrentOwner(identity);
    }
};

const runtimeHelpers = (runtimeDir: string, userId: number, processes: RuntimeProcesses): ProcessIdentity[] => {
    const helpers = new Map<number, ProcessIdentity>();
    for (const helper of [
        ...(runtimeState(runtimeDir, userId)?.helpers ?? []),
        ...(processes.helpers.get(runtimeDir) ?? []),
    ]) {
        if (isCurrentOwner(helper)) helpers.set(helper.pid, helper);
    }
    return [...helpers.values()];
};

const hasRuntimeProcesses = (runtimeDir: string, userId: number): boolean => {
    const processes = findRuntimeProcesses(userId);
    return processes.live.has(runtimeDir) || runtimeHelpers(runtimeDir, userId, processes).length > 0;
};

const didReapCandidate = (candidate: StaleHeadlessDisplay, userId: number, processes: RuntimeProcesses): boolean => {
    if (!isReapable(candidate, userId, processes.live)) {
        return false;
    }

    const helpers = runtimeHelpers(candidate.runtimeDir, userId, processes);
    if (
        candidate.owner !== undefined &&
        !helpers.every((identity) => signalRuntimeHelper(identity, candidate.runtimeDir, userId, "SIGKILL"))
    ) {
        return false;
    }

    const deadline = Date.now() + 500;
    const pause = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    while (helpers.some(isCurrentOwner) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);

    if (hasRuntimeProcesses(candidate.runtimeDir, userId)) return false;

    removeCleanupDirectory(candidate.cleanupDirectory);

    return cleanupDirectoryIdentity(candidate.runtimeDir) === undefined;
};

const reapStaleHeadlessDisplays = (
    candidates: readonly StaleHeadlessDisplay[] = findStaleHeadlessDisplays(),
): string[] => {
    const userId = currentUserId();

    if (userId === undefined) {
        return [];
    }

    const processes = findRuntimeProcesses(userId);
    const removed: string[] = [];

    for (const candidate of candidates) {
        if (didReapCandidate(candidate, userId, processes)) {
            removed.push(candidate.runtimeDir);
        }
    }

    return removed;
};

const reapStaleHeadlessDisplaysAtStartup = (): void => {
    const removed = reapStaleHeadlessDisplays();

    if (removed.length === 0) {
        return;
    }

    const noun = removed.length === 1 ? "directory" : "directories";
    info(`removed stale headless runtime ${noun}: ${removed.join(", ")}`);
};

const stopHeadlessRuntime = (runtimeDir: string): void => {
    const userId = currentUserId();
    const directory = cleanupDirectoryIdentity(runtimeDir);
    const owner = userId === undefined ? undefined : runtimeState(runtimeDir, userId)?.owner;
    if (userId === undefined || directory === undefined || owner?.pid !== process.pid || !isCurrentOwner(owner)) {
        return;
    }
    const helpers = (): ProcessIdentity[] => runtimeHelpers(runtimeDir, userId, findRuntimeProcesses(userId));
    for (const helper of helpers()) signalRuntimeHelper(helper, runtimeDir, userId, "SIGTERM");
    const removeIfStopped = (): boolean => {
        if (hasRuntimeProcesses(runtimeDir, userId)) return false;
        removeCleanupDirectory(directory);
        return true;
    };
    if (removeIfStopped()) return;
    const started = Date.now();
    const pause = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    while (Date.now() - started < 1000) {
        if (removeIfStopped()) return;
        if (Date.now() - started >= 250) {
            for (const helper of helpers()) signalRuntimeHelper(helper, runtimeDir, userId, "SIGKILL");
        }
        Atomics.wait(pause, 0, 0, 10);
    }
    removeIfStopped();
};

export {
    findStaleHeadlessDisplays,
    reapStaleHeadlessDisplays,
    reapStaleHeadlessDisplaysAtStartup,
    stopHeadlessRuntime,
    type StaleHeadlessDisplay,
};
