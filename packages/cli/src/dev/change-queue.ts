import type { DevServerWatchEvent } from "./vite-dev-server.js";

type WatchedChange = {
    event: DevServerWatchEvent;
    path: string;
};

type ChangeQueue = {
    enqueue: (change: WatchedChange) => void;
};

type QueueState = {
    queued: WatchedChange[];
    isDraining: boolean;
    run: (change: WatchedChange) => Promise<void>;
};

const isSameChange = (left: WatchedChange, right: WatchedChange): boolean =>
    left.event === right.event && left.path === right.path;

const drainQueue = async (state: QueueState): Promise<void> => {
    state.isDraining = true;

    try {
        await Promise.resolve();
        let change = state.queued.shift();

        while (change !== undefined) {
            await state.run(change);
            change = state.queued.shift();
        }
    } finally {
        state.isDraining = false;
    }
};

const enqueueChange = (state: QueueState, change: WatchedChange): void => {
    if (state.queued.some((queued) => isSameChange(queued, change))) {
        return;
    }

    state.queued.push(change);

    if (!state.isDraining) {
        void drainQueue(state);
    }
};

const createChangeQueue = (run: (change: WatchedChange) => Promise<void>): ChangeQueue => {
    const state: QueueState = { queued: [], isDraining: false, run };

    return {
        enqueue: (change) => {
            enqueueChange(state, change);
        },
    };
};

export { createChangeQueue, type WatchedChange };
