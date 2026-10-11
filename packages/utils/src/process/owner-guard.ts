import { workerData } from "node:worker_threads";
import { OWNER_GUARD_STATE, type OwnerGuardData } from "./guard-protocol.ts";
import { type ProcessIdentity, readProcessIdentity } from "./process-status.ts";

const { owner, target, state } = workerData as OwnerGuardData;

const isCurrent = (identity: ProcessIdentity): boolean =>
    readProcessIdentity(identity.pid)?.startTime === identity.startTime;

const terminate = (): void => {
    if (
        Atomics.compareExchange(state, 0, OWNER_GUARD_STATE.ready, OWNER_GUARD_STATE.signalling) !==
        OWNER_GUARD_STATE.ready
    ) {
        process.exit(0);
    }
    try {
        if (isCurrent(target)) {
            process.kill(target.pid, "SIGTERM");
        }
    } finally {
        Atomics.store(state, 0, OWNER_GUARD_STATE.closed);
        Atomics.notify(state, 0);
    }
    process.exit(0);
};

if (!isCurrent(owner) || !isCurrent(target)) {
    Atomics.compareExchange(state, 0, OWNER_GUARD_STATE.starting, OWNER_GUARD_STATE.invalid);
    Atomics.notify(state, 0);
} else {
    const timer = setInterval(() => {
        try {
            if (Atomics.load(state, 0) === OWNER_GUARD_STATE.closed || !isCurrent(target)) {
                process.exit(0);
            }
            if (!isCurrent(owner)) {
                terminate();
            }
        } catch {
            terminate();
        }
    }, 50);
    if (
        Atomics.compareExchange(state, 0, OWNER_GUARD_STATE.starting, OWNER_GUARD_STATE.ready) !==
        OWNER_GUARD_STATE.starting
    ) {
        clearInterval(timer);
    }
    Atomics.notify(state, 0);
}
