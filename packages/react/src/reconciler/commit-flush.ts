const pending = new Set<() => void>();

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
