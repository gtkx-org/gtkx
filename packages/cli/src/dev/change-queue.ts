type ChangeQueue = {
    enqueue: (changedPath: string) => void;
};

type QueueState = {
    queued: string[];
    isDraining: boolean;
    run: (changedPath: string) => Promise<void>;
};

const drainQueue = async (state: QueueState): Promise<void> => {
    state.isDraining = true;

    try {
        await Promise.resolve();
        let changedPath = state.queued.shift();

        while (changedPath !== undefined) {
            await state.run(changedPath);
            changedPath = state.queued.shift();
        }
    } finally {
        state.isDraining = false;
    }
};

const enqueueChange = (state: QueueState, changedPath: string): void => {
    if (state.queued.includes(changedPath)) {
        return;
    }

    state.queued.push(changedPath);

    if (!state.isDraining) {
        void drainQueue(state);
    }
};

const createChangeQueue = (run: (changedPath: string) => Promise<void>): ChangeQueue => {
    const state: QueueState = { queued: [], isDraining: false, run };

    return {
        enqueue: (changedPath) => {
            enqueueChange(state, changedPath);
        },
    };
};

export { createChangeQueue };
