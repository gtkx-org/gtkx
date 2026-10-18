import { errorCode, readProcessStatFields, resolveExecutable, sortStrings } from "@gtkx/utils";
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
    closeSync,
    constants,
    mkdirSync,
    mkdtempSync,
    openSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const STAGING_SUFFIX = ".tmp-";
const OWNER_PATTERN = /^(?<pid>\d+)(?:-(?<identity>[a-f\d]{64}|unknown))?-/u;
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 600_000;
const PROCESS_START_FIELD = 19;
const BOOT_ID_PATH = "/proc/sys/kernel/random/boot_id";
const LOCK_CHILD_FD = 3;
const LOCK_CONFLICT_EXIT_CODE = 75;
const STOPPED_PROCESS_STATES: ReadonlySet<string> = new Set(["Z", "X", "x"]);

const readBootId = (): string | null => {
    try {
        return readFileSync(BOOT_ID_PATH, "utf8").trim();
    } catch {
        return null;
    }
};

const BOOT_ID = readBootId();

const readProcessStat = (pid: number): { startTime: string; state: string } | null => {
    const fields = readProcessStatFields(pid);
    const state = fields?.[0];
    const startTime = fields?.[PROCESS_START_FIELD];

    return state === undefined || startTime === undefined ? null : { startTime, state };
};

const processIdentity = (pid: number): string | null => {
    if (BOOT_ID === null) {
        return null;
    }

    const stat = readProcessStat(pid);

    if (stat === null || STOPPED_PROCESS_STATES.has(stat.state)) {
        return null;
    }

    return `${BOOT_ID}:${stat.startTime}`;
};

const processIdentityToken = (pid: number): string | null => {
    const identity = processIdentity(pid);

    return identity === null ? null : createHash("sha256").update(identity).digest("hex");
};

const isProcessRunning = (pid: number): boolean => {
    if (!Number.isSafeInteger(pid) || pid <= 0) {
        return false;
    }

    const stat = readProcessStat(pid);

    if (stat !== null) {
        return !STOPPED_PROCESS_STATES.has(stat.state);
    }

    try {
        process.kill(pid, 0);

        return true;
    } catch (error) {
        return errorCode(error) === "EPERM";
    }
};

const isStranded = (entry: string, prefix: string): boolean => {
    if (!entry.startsWith(prefix)) {
        return false;
    }

    const owner = OWNER_PATTERN.exec(entry.slice(prefix.length))?.groups;

    if (owner?.pid === undefined || !isProcessRunning(Number(owner.pid))) {
        return true;
    }

    return (
        owner.identity !== undefined &&
        owner.identity !== "unknown" &&
        processIdentityToken(Number(owner.pid)) !== owner.identity
    );
};

const readEntries = (parentDir: string): string[] => {
    try {
        return readdirSync(parentDir);
    } catch {
        return [];
    }
};

const removeStrandedDir = (path: string): void => {
    try {
        rmSync(path, { recursive: true, force: true });
    } catch {
        return;
    }
};

const sweepStrandedDirs = (parentDir: string, prefix: string): void => {
    for (const entry of readEntries(parentDir)) {
        if (isStranded(entry, prefix)) {
            removeStrandedDir(join(parentDir, entry));
        }
    }
};

const sweepStagingDirs = (target: string): void => {
    sweepStrandedDirs(dirname(target), `${basename(target)}${STAGING_SUFFIX}`);
};

const createStagingDir = (target: string): string => {
    mkdirSync(dirname(target), { recursive: true });
    sweepStagingDirs(target);

    const identity = processIdentityToken(process.pid) ?? "unknown";

    return mkdtempSync(`${target}${STAGING_SUFFIX}${String(process.pid)}-${identity}-`);
};

const lockHolderArgs = (timeout: number): string[] => [
    "--exclusive",
    "--timeout",
    String(timeout / 1000),
    "--conflict-exit-code",
    String(LOCK_CONFLICT_EXIT_CODE),
    String(LOCK_CHILD_FD),
];

const lockTimeoutMessage = (root: string, timeout: number, elapsed: number): string =>
    `Timed out after ${String(elapsed)}ms waiting to generate stores in ${root}; another codegen process still ` +
    `holds the store lock. Wait for it to finish, or raise the ${String(timeout)}ms limit with ` +
    "`gtkx codegen --lock-timeout <milliseconds>` or the `lockTimeoutMs` codegen option.";

const lockFailureMessage = (root: string, code: number | null): string => {
    const exit = code === null ? "a signal" : `code ${String(code)}`;

    return `Cannot lock ${root} to generate stores: flock exited with ${exit}.`;
};

const waitForLockHolder = (child: ChildProcess, root: string, timeout: number): Promise<void> => {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        child.once("error", (error) => {
            reject(new Error(`Cannot lock ${root} to generate stores`, { cause: error }));
        });
        child.once("exit", (code) => {
            if (code === 0) {
                resolve();

                return;
            }

            const message =
                code === LOCK_CONFLICT_EXIT_CODE
                    ? lockTimeoutMessage(root, timeout, Date.now() - startedAt)
                    : lockFailureMessage(root, code);
            reject(new Error(message));
        });
    });
};

const acquireLock = async (root: string, timeout: number): Promise<number> => {
    const executable = resolveExecutable("flock");
    const lockFd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY);

    try {
        const child = spawn(executable, lockHolderArgs(timeout), {
            stdio: ["ignore", "ignore", "ignore", lockFd],
        });
        await waitForLockHolder(child, root, timeout);
        return lockFd;
    } catch (error) {
        closeSync(lockFd);
        throw error;
    }
};

const storeRoots = (targets: string[]): string[] => {
    const roots: Set<string> = new Set();

    for (const target of targets) {
        const root = dirname(target);
        mkdirSync(root, { recursive: true });
        roots.add(realpathSync(root));
    }

    return sortStrings([...roots]);
};

const releaseLocks = (locks: number[]): void => {
    for (const lockFd of locks.toReversed()) {
        closeSync(lockFd);
    }
};

const acquireStoreLocks = async (
    targets: string[],
    timeout: number = DEFAULT_LOCK_WAIT_TIMEOUT_MS,
): Promise<() => void> => {
    if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error("lockTimeoutMs must be a positive finite number of milliseconds");
    }

    const locks: number[] = [];

    try {
        for (const root of storeRoots(targets)) {
            locks.push(await acquireLock(root, timeout));
        }
    } catch (error) {
        releaseLocks(locks);
        throw error;
    }

    return () => {
        releaseLocks(locks);
    };
};

export { acquireStoreLocks, createStagingDir, sweepStagingDirs };
