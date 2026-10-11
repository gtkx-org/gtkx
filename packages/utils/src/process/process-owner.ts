import { Worker } from "node:worker_threads";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OWNER_GUARD_STATE } from "./guard-protocol.ts";
import { type ProcessIdentity, readProcessIdentity, readProcessStatus, type ProcessStatus } from "./process-status.ts";

type ProcessWatchOperations<T> = {
    open(pid: number): T | undefined;
    activate(watch: T): boolean;
    close(watch: T): void;
};

const MODULE_PATH = fileURLToPath(import.meta.url);
const GUARD_PATH = join(dirname(MODULE_PATH), `owner-guard${extname(MODULE_PATH)}`);

const requireStatus = (pid: number): ProcessStatus => {
    const status = readProcessStatus(pid);
    if (status === undefined || readProcessIdentity(pid)?.startTime !== status.startTime) {
        throw new Error(`Failed to identify process ${String(pid)}`);
    }
    return status;
};

const ancestorFor = (target: ProcessStatus, owner: ProcessIdentity): boolean => {
    let current = target;
    const visited = new Set<number>();
    while (current.parentId > 1 && !visited.has(current.parentId)) {
        visited.add(current.parentId);
        const parent = readProcessStatus(current.parentId);
        if (parent === undefined) {
            return false;
        }
        if (parent.pid === owner.pid) {
            return parent.startTime === owner.startTime;
        }
        current = parent;
    }
    return false;
};

const isProcessGroupOwner = (owner: ProcessIdentity, target: ProcessIdentity): boolean => {
    const ownerStatus = readProcessStatus(owner.pid);
    const targetStatus = readProcessStatus(target.pid);
    return (
        ownerStatus?.startTime === owner.startTime &&
        ownerStatus.processGroupId === owner.pid &&
        targetStatus?.startTime === target.startTime &&
        targetStatus.processGroupId === owner.pid &&
        ancestorFor(targetStatus, owner) &&
        readProcessIdentity(owner.pid)?.startTime === owner.startTime &&
        readProcessIdentity(target.pid)?.startTime === target.startTime
    );
};

const captureProcessGroupOwner = (pid: number, expectedParent: number): ProcessIdentity | undefined => {
    const target = requireStatus(pid);
    if (target.parentId !== expectedParent) {
        throw new Error("The process that launched GTKX exited during startup");
    }
    if (target.processGroupId === pid) {
        return undefined;
    }
    const owner = requireStatus(target.processGroupId);
    if (owner.processGroupId !== owner.pid) {
        throw new Error(`Failed to identify process group ${String(owner.pid)}`);
    }
    const isAncestor = ancestorFor(target, owner);
    const currentTarget = requireStatus(pid);
    if (
        requireStatus(owner.pid).startTime !== owner.startTime ||
        currentTarget.startTime !== target.startTime ||
        currentTarget.parentId !== expectedParent ||
        currentTarget.processGroupId !== owner.pid
    ) {
        throw new Error("The process group changed during startup");
    }
    return isAncestor ? { pid: owner.pid, startTime: owner.startTime } : undefined;
};

const fallbackWatch = (owner: ProcessIdentity, target: ProcessIdentity): (() => void) | undefined => {
    const state = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    const worker = new Worker(GUARD_PATH, { workerData: { owner, target, state }, execArgv: [] });
    let closed = false;
    const close = (): void => {
        closed = true;
        while (true) {
            const status = Atomics.load(state, 0);
            if (status === OWNER_GUARD_STATE.signalling) {
                Atomics.wait(state, 0, status);
            } else if (Atomics.compareExchange(state, 0, status, OWNER_GUARD_STATE.closed) === status) {
                break;
            }
        }
        void worker.terminate();
    };
    worker.on("error", () => {
        if (!closed) {
            process.kill(process.pid, "SIGTERM");
        }
    });
    worker.on("exit", () => {
        if (!closed) {
            process.kill(process.pid, "SIGTERM");
        }
    });
    worker.unref();
    const outcome = Atomics.wait(state, 0, OWNER_GUARD_STATE.starting, 5000);
    const status = Atomics.load(state, 0);
    if (outcome === "timed-out" || status !== OWNER_GUARD_STATE.ready) {
        close();
        if (status === OWNER_GUARD_STATE.invalid) {
            return undefined;
        }
        throw new Error("The process owner guard failed to start");
    }
    return close;
};

const watchProcessGroupOwner = <T>(
    owner: ProcessIdentity,
    operations: ProcessWatchOperations<T>,
): (() => void) | undefined => {
    const target = readProcessIdentity(process.pid);
    if (target === undefined || !isProcessGroupOwner(owner, target)) {
        return undefined;
    }
    const watch = operations.open(owner.pid);
    if (watch === undefined) {
        const close = fallbackWatch(owner, target);
        if (close === undefined || !isProcessGroupOwner(owner, target)) {
            close?.();
            return undefined;
        }
        return close;
    }
    try {
        if (!isProcessGroupOwner(owner, target) || !operations.activate(watch)) {
            operations.close(watch);
            return undefined;
        }
        if (!isProcessGroupOwner(owner, target)) {
            operations.close(watch);
            return undefined;
        }
    } catch (error) {
        operations.close(watch);
        throw error;
    }
    return () => {
        operations.close(watch);
    };
};

export { captureProcessGroupOwner, isProcessGroupOwner, type ProcessWatchOperations, watchProcessGroupOwner };
