import {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    info,
    type ProcessIdentity,
    readProcessIdentity,
    readProcessStatFields,
    removeCleanupDirectory,
} from "@gtkx/utils";
import { randomUUID } from "node:crypto";
import {
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    openSync,
    readdirSync,
    readFileSync,
    readSync,
    renameSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
    createBusConfig,
    createHeadlessRuntimeMarker,
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

type HeadlessRuntime = {
    cleanupDirectory: CleanupDirectoryIdentity;
    owner: ProcessIdentity;
    helpers: ProcessIdentity[];
};

type RuntimeProcesses = {
    live: Set<string>;
    helpers: Map<string, ProcessIdentity[]>;
    users: Map<string, ProcessIdentity[]>;
    members: ProcessSnapshot[];
};

type ProcessSnapshot = ProcessIdentity & { processGroupId: number; sessionId: number };

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
    if (dirname(path) !== runtimeDir) return undefined;
    let descriptor: number | undefined;
    try {
        // CodeQL requires a private creation mode even for read-only opens.
        descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW, 0o600);
        const stat = fstatSync(descriptor);
        if (
            !stat.isFile() ||
            stat.uid !== userId ||
            stat.size >= CONFIG_SIZE_LIMIT ||
            (requiredMode !== undefined && (stat.mode & 0o777) !== requiredMode)
        ) {
            return undefined;
        }
        const buffer = Buffer.alloc(CONFIG_SIZE_LIMIT);
        const length = readSync(descriptor, buffer, 0, buffer.length, null);
        return length < CONFIG_SIZE_LIMIT ? buffer.toString("utf8", 0, length) : undefined;
    } catch {
        return undefined;
    } finally {
        if (descriptor !== undefined) closeSync(descriptor);
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
        return readFileSync(`/proc/${String(pid)}/cmdline`)
            .toString()
            .split("\0")
            .filter((argument) => argument.length > 0);
    } catch {
        return undefined;
    }
};

const readProcessSnapshot = (pid: number): ProcessSnapshot | undefined => {
    const fields = readProcessStatFields(pid);
    const state = fields?.[0];
    const startTime = fields?.[19];
    const processGroupId = Number(fields?.[2]);
    const sessionId = Number(fields?.[3]);
    return state !== undefined &&
        !STOPPED_PROCESS_STATES.has(state) &&
        startTime !== undefined &&
        Number.isSafeInteger(processGroupId) &&
        processGroupId > 0 &&
        Number.isSafeInteger(sessionId) &&
        sessionId > 0
        ? { pid, startTime, processGroupId, sessionId }
        : undefined;
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

const addRuntimeProcess = (
    processes: Map<string, ProcessIdentity[]>,
    runtimeDir: string,
    identity: ProcessIdentity,
): void => {
    const existing = processes.get(runtimeDir) ?? [];
    existing.push(identity);
    processes.set(runtimeDir, existing);
};

const addProcessRuntimes = (processes: RuntimeProcesses, identity: ProcessIdentity): void => {
    const processArgs = readProcessArguments(identity.pid);

    if (processArgs === undefined) {
        return;
    }

    const references = new Set<string>();
    addRuntimeArguments(references, processArgs);
    const runtime = runtimeFromEnvironment(identity.pid);

    if (runtime !== undefined) {
        references.add(runtime.runtimeDir);
        addRuntimeProcess(processes.users, runtime.runtimeDir, identity);
        if (runtime.helper) {
            addRuntimeProcess(processes.helpers, runtime.runtimeDir, identity);
        }
    }
    for (const runtimeDir of references) {
        processes.live.add(runtimeDir);
    }
};

const findRuntimeProcesses = (userId: number): RuntimeProcesses => {
    const processes: RuntimeProcesses = { live: new Set(), helpers: new Map(), users: new Map(), members: [] };
    const processEntries = readdirSync("/proc");

    for (const entry of processEntries) {
        const pid = Number(entry);

        if (!isOwnedProcessId(pid, userId)) {
            continue;
        }

        const snapshot = readProcessSnapshot(pid);
        if (snapshot === undefined) continue;
        processes.members.push(snapshot);
        addProcessRuntimes(processes, snapshot);
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
    if (!isPrivateRuntimeDirectory(runtimeDir, userId)) return [];
    const cleanupDirectory = cleanupDirectoryIdentity(runtimeDir);
    if (cleanupDirectory === undefined) return [];
    const owner = runtimeState(runtimeDir, userId)?.owner;

    if (
        (owner === undefined ? live.has(runtimeDir) : isCurrentOwner(owner)) ||
        !hasGeneratedRuntimeFiles(runtimeDir, userId)
    ) {
        return [];
    }

    return [{ runtimeDir, cleanupDirectory, ...(owner && { owner }) }];
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
    if (
        !isSameCleanupDirectory(cleanupDirectoryIdentity(candidate.runtimeDir), candidate.cleanupDirectory) ||
        !isPrivateRuntimeDirectory(candidate.runtimeDir, userId)
    ) {
        return false;
    }
    const owner = runtimeState(candidate.runtimeDir, userId)?.owner;
    const ownershipMatches =
        owner === undefined
            ? candidate.owner === undefined && !live.has(candidate.runtimeDir)
            : owner.pid === candidate.owner?.pid &&
              owner.startTime === candidate.owner.startTime &&
              !isCurrentOwner(owner);
    return ownershipMatches && hasGeneratedRuntimeFiles(candidate.runtimeDir, userId);
};

const signalRuntimeHelper = (identity: ProcessIdentity, userId: number, signal: NodeJS.Signals): boolean => {
    if (!isOwnedProcessId(identity.pid, userId) || !isCurrentOwner(identity)) {
        return true;
    }
    try {
        process.kill(identity.pid, signal);
        return true;
    } catch {
        return !isCurrentOwner(identity);
    }
};

const runtimeHelpers = (
    recorded: readonly ProcessIdentity[],
    processes: RuntimeProcesses,
    runtimeDir?: string,
): ProcessIdentity[] => {
    const helpers = new Map<number, ProcessIdentity>();
    const marked = runtimeDir === undefined ? [] : (processes.helpers.get(runtimeDir) ?? []);
    for (const helper of [...recorded, ...marked]) {
        if (isCurrentOwner(helper)) helpers.set(helper.pid, helper);
    }
    for (const leader of recorded) {
        const matchesLeader = (member: ProcessSnapshot): boolean =>
            member.pid === leader.pid &&
            member.startTime === leader.startTime &&
            member.processGroupId === leader.pid &&
            member.sessionId === leader.pid;
        if (!processes.members.some(matchesLeader)) continue;
        const current = readProcessSnapshot(leader.pid);
        if (current === undefined || !matchesLeader(current)) continue;
        for (const member of processes.members) {
            if (member.processGroupId === leader.pid || member.sessionId === leader.pid) {
                helpers.set(member.pid, member);
            }
        }
    }
    return [...helpers.values()];
};

const hasRuntimeProcesses = (runtimeDir: string, userId: number, recorded: readonly ProcessIdentity[]): boolean => {
    const processes = findRuntimeProcesses(userId);
    return (
        processes.live.has(runtimeDir) ||
        runtimeHelpers(recorded, processes, runtimeDir).length > 0 ||
        recorded.some((leader) =>
            processes.members.some((member) => member.processGroupId === leader.pid || member.sessionId === leader.pid),
        )
    );
};

const didReapCandidate = (candidate: StaleHeadlessDisplay, userId: number, processes: RuntimeProcesses): boolean => {
    if (!isReapable(candidate, userId, processes.live)) {
        return false;
    }

    const recorded = runtimeState(candidate.runtimeDir, userId)?.helpers ?? [];
    const helpers = runtimeHelpers(recorded, processes, candidate.runtimeDir);
    if (
        candidate.owner !== undefined &&
        !helpers.every((identity) => signalRuntimeHelper(identity, userId, "SIGKILL"))
    ) {
        return false;
    }

    const deadline = Date.now() + 500;
    const pause = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    while (helpers.some(isCurrentOwner) && Date.now() < deadline) Atomics.wait(pause, 0, 0, 10);

    if (hasRuntimeProcesses(candidate.runtimeDir, userId, recorded)) return false;

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

const stopHeadlessRuntime = ({ cleanupDirectory, owner, helpers: recorded }: HeadlessRuntime): void => {
    const userId = currentUserId();
    if (userId === undefined || owner.pid !== process.pid || !isCurrentOwner(owner)) {
        return;
    }
    const runtimeDir = cleanupDirectory.path;
    const isOriginalDirectory = (): boolean =>
        isSameCleanupDirectory(cleanupDirectoryIdentity(runtimeDir), cleanupDirectory);
    const captured = new Map<number, ProcessIdentity>();
    const helpers = (): ProcessIdentity[] => {
        const processes = findRuntimeProcesses(userId);
        const current = isOriginalDirectory() ? runtimeDir : undefined;
        const users = current === undefined ? [] : (processes.users.get(current) ?? []);
        for (const helper of [...runtimeHelpers(recorded, processes, current), ...users]) {
            if (helper.pid !== process.pid) captured.set(helper.pid, helper);
        }
        return [...captured.values()].filter(isCurrentOwner);
    };
    for (const helper of helpers()) signalRuntimeHelper(helper, userId, "SIGTERM");
    const removeIfStopped = (): boolean => {
        if ([...captured.values()].some(isCurrentOwner)) return false;
        if (!isOriginalDirectory()) return true;
        if (hasRuntimeProcesses(runtimeDir, userId, recorded)) return false;
        removeCleanupDirectory(cleanupDirectory);
        return true;
    };
    if (removeIfStopped()) return;
    const started = Date.now();
    const pause = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    while (Date.now() - started < 1000) {
        if (removeIfStopped()) return;
        if (Date.now() - started >= 250) {
            for (const helper of helpers()) signalRuntimeHelper(helper, userId, "SIGKILL");
        }
        Atomics.wait(pause, 0, 0, 10);
    }
    if (removeIfStopped() || !isOriginalDirectory()) return;
    try {
        const pending = join(runtimeDir, `${HEADLESS_RUNTIME_MARKER}.${randomUUID()}`);
        writeFileSync(pending, createHeadlessRuntimeMarker(runtimeDir, owner, recorded), { flag: "wx", mode: 0o600 });
        renameSync(pending, join(runtimeDir, HEADLESS_RUNTIME_MARKER));
    } catch {
        return;
    }
};

export {
    findStaleHeadlessDisplays,
    reapStaleHeadlessDisplays,
    reapStaleHeadlessDisplaysAtStartup,
    stopHeadlessRuntime,
    type HeadlessRuntime,
    type StaleHeadlessDisplay,
};
