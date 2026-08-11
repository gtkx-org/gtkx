import { performance } from "node:perf_hooks";
import { clearTimeout, setTimeout } from "node:timers";

type FakeClock = { tickAsync: (ms: number) => Promise<unknown> };
type TimeoutHandle = ReturnType<typeof setTimeout>;

const now = (): number => performance.now();
const scheduleTimeout = (callback: () => void, ms: number): TimeoutHandle => setTimeout(callback, ms);

const cancelTimeout = (handle: TimeoutHandle): void => {
    clearTimeout(handle);
};

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        scheduleTimeout(() => {
            resolve();
        }, ms);
    });

const getFakeClock = (): FakeClock | null => {
    const { clock } = globalThis.setTimeout as typeof globalThis.setTimeout & { clock?: FakeClock };

    return clock ?? null;
};

const advanceFakeClock = async (ms: number): Promise<void> => {
    await getFakeClock()?.tickAsync(ms);
};

export { advanceFakeClock, cancelTimeout, delay, now, scheduleTimeout };
