const pending = new Set<() => void>();
let inCommit = false;

export const isInCommit = (): boolean => inCommit;

export const beginCommit = (): void => {
    inCommit = true;
};

export const endCommit = (): void => {
    inCommit = false;
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
