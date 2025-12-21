type Callback = () => void;

const pendingCallbacks: Callback[] = [];

export const scheduleAfterCommit = (callback: Callback): void => {
    pendingCallbacks.push(callback);
};

export const flushAfterCommit = (): void => {
    const callbacks = pendingCallbacks.splice(0);
    for (const callback of callbacks) {
        callback();
    }
};
