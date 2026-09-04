import { errorCode, resolveExecutable, sortStrings } from "@gtkx/utils";
import { type ChildProcess, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
    closeSync,
    constants,
    fstatSync,
    fsyncSync,
    ftruncateSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    unlinkSync,
    writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const STAGING_SUFFIX = ".tmp-";
const OWNER_PATTERN = /^(?<pid>\d+)(?:-(?<identity>[a-f\d]{64}|unknown))?-/u;
const LOCK_FILENAME = ".codegen.lock";
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 600_000;
const LOCK_WAIT_TIMEOUT_ENV = "GTKX_CODEGEN_LOCK_TIMEOUT_MS";
const PROCESS_START_FIELD = 19;
const BOOT_ID_PATH = "/proc/sys/kernel/random/boot_id";
const LOCK_CHILD_FD = 3;
const STOPPED_PROCESS_STATES: ReadonlySet<string> = new Set(["Z", "X", "x"]);

type LockOwner = { createdAt: number; identity: string | null; pid: number; token: string };
type StoreLock = LockOwner & { lockFd: number; ownerFd: number; path: string };

const readBootId = (): string | null => {
    try {
        return readFileSync(BOOT_ID_PATH, "utf8").trim();
    } catch {
        return null;
    }
};

const BOOT_ID = readBootId();

const readProcessStat = (pid: number): { startTime: string; state: string } | null => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const commandEnd = stat.lastIndexOf(")");

        if (commandEnd === -1) {
            return null;
        }

        const fields = stat.slice(commandEnd + 2).trim().split(/\s+/u);
        const state = fields[0];
        const startTime = fields[PROCESS_START_FIELD];

        return state === undefined || startTime === undefined ? null : { startTime, state };
    } catch {
        return null;
    }
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

    return owner.identity !== undefined &&
        owner.identity !== "unknown" &&
        processIdentityToken(Number(owner.pid)) !== owner.identity;
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

const lockOwner = (): LockOwner => ({
    createdAt: Date.now(),
    identity: processIdentity(process.pid),
    pid: process.pid,
    token: randomUUID(),
});

const lockWaitTimeout = (): number => {
    const source = process.env[LOCK_WAIT_TIMEOUT_ENV];

    if (source === undefined) {
        return DEFAULT_LOCK_WAIT_TIMEOUT_MS;
    }

    const requested = Number(source);

    return Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LOCK_WAIT_TIMEOUT_MS;
};

const lockHolderArgs = (): string[] => [
    "--exclusive",
    "--timeout",
    String(lockWaitTimeout() / 1000),
    "--conflict-exit-code",
    "75",
    String(LOCK_CHILD_FD),
];

const waitForLockHolder = (child: ChildProcess, root: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const fail = (): void => {
            reject(new Error(`Timed out waiting to generate stores in ${root}`));
        };
        child.once("error", fail);
        child.once("exit", (code) => {
            if (code === 0) {
                resolve();

                return;
            }

            fail();
        });
    });
};

const openLockFile = (path: string): number => {
    let fd: number;

    try {
        fd = openSync(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    } catch {
        throw new Error(`Cannot use ${path} as a generated-store lock`);
    }

    const stat = fstatSync(fd);

    if (stat.isFile() && stat.nlink === 1) {
        return fd;
    }

    closeSync(fd);
    throw new Error(`Cannot use ${path} as a generated-store lock`);
};

const writeLockOwner = (fd: number, owner: LockOwner): void => {
    ftruncateSync(fd, 0);
    writeSync(fd, JSON.stringify(owner), 0, "utf8");
    fsyncSync(fd);
};

const acquireLock = async (root: string): Promise<StoreLock> => {
    const path = join(root, LOCK_FILENAME);
    const executable = resolveExecutable("flock");
    const lockFd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY);
    let ownerFd: number | undefined;

    try {
        const child = spawn(executable, lockHolderArgs(), {
            stdio: ["ignore", "ignore", "ignore", lockFd],
        });
        await waitForLockHolder(child, root);
        ownerFd = openLockFile(path);
        const owner = lockOwner();
        writeLockOwner(ownerFd, owner);

        return { ...owner, lockFd, ownerFd, path };
    } catch (error) {
        if (ownerFd !== undefined) {
            closeSync(ownerFd);
        }

        closeSync(lockFd);
        throw error;
    }
};

const removeOwnedLockFile = (lock: StoreLock): void => {
    try {
        const owner = fstatSync(lock.ownerFd);
        const path = lstatSync(lock.path, { throwIfNoEntry: false });

        if (path?.isFile() === true && path.dev === owner.dev && path.ino === owner.ino) {
            unlinkSync(lock.path);
        }
    } catch {
        return;
    }
};

const releaseLock = (lock: StoreLock): void => {
    removeOwnedLockFile(lock);
    closeSync(lock.ownerFd);
    closeSync(lock.lockFd);
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

const releaseLocks = (locks: StoreLock[]): void => {
    for (const lock of locks.toReversed()) {
        releaseLock(lock);
    }
};

const acquireStoreLocks = async (targets: string[]): Promise<() => void> => {
    const locks: StoreLock[] = [];

    try {
        for (const root of storeRoots(targets)) {
            locks.push(await acquireLock(root));
        }
    } catch (error) {
        releaseLocks(locks);
        throw error;
    }

    return () => {
        releaseLocks(locks);
    };
};

export { acquireStoreLocks, createStagingDir, isProcessRunning, processIdentityToken, sweepStagingDirs };
