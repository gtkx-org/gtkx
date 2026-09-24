type RecordedCalls<Args extends unknown[] = unknown[]> = ((...args: Args) => void) & { calls: Args[] };

const recordCalls = <Args extends unknown[] = unknown[]>(): RecordedCalls<Args> => {
    const calls: Args[] = [];
    const handler = (...args: Args): void => {
        calls.push(args);
    };

    return Object.assign(handler, { calls });
};

export { recordCalls, type RecordedCalls };
