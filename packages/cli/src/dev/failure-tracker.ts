type FailureTracker = {
    isDown: () => boolean;
    hasReported: () => boolean;
    fail: (cause?: unknown) => void;
    report: (cause: unknown) => void;
    settleUnmount: (decide: () => void) => void;
};

type FailureState = {
    isDown: boolean;
    hasReported: boolean;
    isUnmounting: boolean;
    announced: WeakSet<object>;
    announce: (cause: unknown) => void;
    isRefreshing: () => boolean;
};

const UNMOUNT_SETTLE_MS = 0;

const wasAnnounced = (state: FailureState, cause: unknown): boolean => {
    if (typeof cause !== "object" || cause === null) {
        return false;
    }

    if (state.announced.has(cause)) {
        return true;
    }

    state.announced.add(cause);

    return false;
};

const recordCause = (state: FailureState, cause: unknown): void => {
    state.hasReported = true;

    if (!wasAnnounced(state, cause)) {
        state.announce(cause);
    }
};

const failState = (state: FailureState, cause: unknown): void => {
    state.isDown = true;

    if (cause !== undefined) {
        recordCause(state, cause);
    }
};

const reportState = (state: FailureState, cause: unknown): void => {
    if (state.isUnmounting || state.isRefreshing()) {
        state.isDown = true;
    }

    recordCause(state, cause);
};

const settleUnmountState = (state: FailureState, decide: () => void): void => {
    state.isUnmounting = true;

    setTimeout(() => {
        state.isUnmounting = false;
        decide();
    }, UNMOUNT_SETTLE_MS);
};

const createFailureTracker = (announce: (cause: unknown) => void, isRefreshing: () => boolean): FailureTracker => {
    const state: FailureState = {
        isDown: false,
        hasReported: false,
        isUnmounting: false,
        announced: new WeakSet(),
        announce,
        isRefreshing,
    };

    return {
        isDown: () => state.isDown,
        hasReported: () => state.hasReported,
        fail: (cause) => {
            failState(state, cause);
        },
        report: (cause) => {
            reportState(state, cause);
        },
        settleUnmount: (decide) => {
            settleUnmountState(state, decide);
        },
    };
};

export { createFailureTracker, type FailureTracker };
