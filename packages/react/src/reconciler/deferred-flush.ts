export type DeferredFlushWrapper = (flush: () => void) => void;

const defaultWrapper: DeferredFlushWrapper = (flush) => {
    flush();
};

let wrapper: DeferredFlushWrapper = defaultWrapper;

export const setDeferredFlushWrapper = (next: DeferredFlushWrapper | null): void => {
    wrapper = next ?? defaultWrapper;
};

export const runDeferredFlush = (flush: () => void): void => {
    wrapper(flush);
};
