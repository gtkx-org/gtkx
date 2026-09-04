import {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    info,
    removeCleanupDirectory,
} from "@gtkx/utils";
import { constants, lstatSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
    createBusConfig,
    createHeadlessRuntimeMarker,
    HEADLESS_RUNTIME_MARKER,
    isSwayConfig,
} from "./headless-config.ts";

type StaleHeadlessDisplay = {
    runtimeDir: string;
    cleanupDirectory: CleanupDirectoryIdentity;
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

        return stat.isDirectory() &&
            stat.uid === userId &&
            (stat.mode & 0o777) === 0o700 &&
            Date.now() - stat.mtimeMs >= MINIMUM_STALE_AGE_MS &&
            RUNTIME_DIRECTORY_PATTERN.test(basename(runtimeDir)) &&
            dirname(runtimeDir) === RUNTIME_ROOT;
    } catch {
        return false;
    }
};

const readOwnedFile = (
    path: string,
    runtimeDir: string,
    userId: number,
    requiredMode?: number,
): string | undefined => {
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
    const bus = readOwnedFile(join(runtimeDir, "session.conf"), runtimeDir, userId);

    if (bus !== createBusConfig(join(runtimeDir, "bus"))) {
        return false;
    }

    const sway = readOwnedFile(join(runtimeDir, "sway.conf"), runtimeDir, userId);
    const marker = readOwnedFile(join(runtimeDir, HEADLESS_RUNTIME_MARKER), runtimeDir, userId, 0o600);

    return marker === createHeadlessRuntimeMarker(runtimeDir) ||
        (sway !== undefined && isSwayConfig(sway)) ||
        hasOnlyBusConfig(runtimeDir);
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

const runtimeFromEnvironment = (pid: number): string | undefined => {
    try {
        const prefix = "XDG_RUNTIME_DIR=";
        const entry = readFileSync(`/proc/${String(pid)}/environ`, "utf8")
            .split("\0")
            .find((value) => value.startsWith(prefix));
        const runtimeDir = entry?.slice(prefix.length);

        return runtimeDir !== undefined &&
            RUNTIME_DIRECTORY_PATTERN.test(basename(runtimeDir)) &&
            dirname(runtimeDir) === RUNTIME_ROOT
            ? runtimeDir
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

const addProcessRuntimes = (live: Set<string>, pid: number): void => {
    const processArgs = readProcessArguments(pid);

    if (processArgs === undefined) {
        return;
    }

    addRuntimeArguments(live, processArgs);
    const runtimeDir = runtimeFromEnvironment(pid);

    if (runtimeDir !== undefined) {
        live.add(runtimeDir);
    }
};

const findLiveRuntimeDirectories = (userId: number): Set<string> => {
    const live: Set<string> = new Set();
    const processEntries = readdirSync("/proc");

    for (const entry of processEntries) {
        const pid = Number(entry);

        if (!isOwnedProcessId(pid, userId)) {
            continue;
        }

        addProcessRuntimes(live, pid);
    }

    return live;
};

const classifyRuntimeDirectory = (
    name: string,
    userId: number,
    live: ReadonlySet<string>,
): StaleHeadlessDisplay[] => {
    const runtimeDir = join(RUNTIME_ROOT, name);

    if (
        live.has(runtimeDir) ||
        !isPrivateRuntimeDirectory(runtimeDir, userId) ||
        !hasGeneratedRuntimeFiles(runtimeDir, userId)
    ) {
        return [];
    }

    const cleanupDirectory = cleanupDirectoryIdentity(runtimeDir);

    return cleanupDirectory === undefined ? [] : [{ runtimeDir, cleanupDirectory }];
};

const findStaleHeadlessDisplays = (): StaleHeadlessDisplay[] => {
    const userId = currentUserId();

    if (userId === undefined) {
        return [];
    }

    const live = findLiveRuntimeDirectories(userId);

    return readdirSync(RUNTIME_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && RUNTIME_DIRECTORY_PATTERN.test(entry.name))
        .flatMap((entry) => classifyRuntimeDirectory(entry.name, userId, live));
};

const isSameCleanupDirectory = (
    left: CleanupDirectoryIdentity | undefined,
    right: CleanupDirectoryIdentity,
): boolean =>
    left?.device === right.device &&
    left.inode === right.inode &&
    left.userId === right.userId;

const isReapable = (
    candidate: StaleHeadlessDisplay,
    userId: number,
    live: ReadonlySet<string>,
): boolean =>
    !live.has(candidate.runtimeDir) &&
    isSameCleanupDirectory(cleanupDirectoryIdentity(candidate.runtimeDir), candidate.cleanupDirectory) &&
    isPrivateRuntimeDirectory(candidate.runtimeDir, userId) &&
    hasGeneratedRuntimeFiles(candidate.runtimeDir, userId);

const didReapCandidate = (
    candidate: StaleHeadlessDisplay,
    userId: number,
    live: ReadonlySet<string>,
): boolean => {
    if (!isReapable(candidate, userId, live)) {
        return false;
    }

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

    const live = findLiveRuntimeDirectories(userId);
    const removed: string[] = [];

    for (const candidate of candidates) {
        if (didReapCandidate(candidate, userId, live)) {
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

export {
    findStaleHeadlessDisplays,
    reapStaleHeadlessDisplays,
    reapStaleHeadlessDisplaysAtStartup,
    type StaleHeadlessDisplay,
};
