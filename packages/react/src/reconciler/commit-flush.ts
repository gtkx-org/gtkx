const pending = new Set<() => void>();
let commitDepth = 0;

export const isInCommit = (): boolean => commitDepth > 0;

export const beginCommit = (): void => {
    commitDepth += 1;
};

export const endCommit = (): void => {
    if (commitDepth > 0) commitDepth -= 1;
};

export const scheduleFlush = (fn: () => void): void => {
    pending.add(fn);
};

export const runCommitFlush = (): void => {
    while (pending.size > 0) {
        const batch = [...pending];
        pending.clear();
        for (const fn of batch) fn();
    }
};

export const scheduleCommitWork = (work: () => void): void => {
    if (isInCommit()) scheduleFlush(work);
    else queueMicrotask(work);
};
