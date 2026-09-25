import { bind, call } from "@gtkx/native";
import { afterEach, expect } from "vitest";

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const RSS_BUDGET = (process.env.GTKX_ASAN_RUNTIME === undefined ? 40 : 256) * 1024 * 1024;
const THROWING_RSS_BUDGET = 256 * 1024 * 1024;

const leakCheck = ((): (() => number) => {
    const runtime = process.env.GTKX_ASAN_RUNTIME;

    if (runtime === undefined) {
        return () => 0;
    }

    const check = bind(runtime, "__lsan_do_recoverable_leak_check", [], { kind: "int32" });

    return () => call(check, []).value as number;
})();

const drainGC = async (rounds = 3): Promise<void> => {
    for (let round = 0; round < rounds; round++) {
        globalThis.gc?.();
        await settle();
    }
};

const hammer = async (iterations: number, body: () => unknown): Promise<number> => {
    for (let round = 0; round < iterations; round += 1) {
        body();
    }

    await drainGC();
    const rss = process.memoryUsage().rss;

    for (let round = 0; round < iterations; round += 1) {
        body();
    }

    await drainGC();

    return process.memoryUsage().rss - rss;
};

const wasCollected = async (ref: WeakRef<object>, rounds = 40): Promise<boolean> => {
    for (let round = 0; round < rounds; round += 1) {
        globalThis.gc?.();
        await settle();
        const isGone = ref.deref() === undefined;
        await settle();

        if (isGone) {
            return true;
        }
    }

    return false;
};

const didThrow = (call: () => void): boolean => {
    try {
        call();

        return false;
    } catch {
        return true;
    }
};

const didSettle = async (isSatisfied: () => boolean | Promise<boolean>, rounds = 30): Promise<boolean> => {
    for (let round = 0; round < rounds; round++) {
        if (await isSatisfied()) {
            return true;
        }

        await settle();
        globalThis.gc?.();
        await settle();
    }

    return isSatisfied();
};

const drainAfterEachTest = (): void => {
    afterEach(async () => {
        await drainGC();
        expect(leakCheck()).toBe(0);
    });
};

export {
    RSS_BUDGET,
    THROWING_RSS_BUDGET,
    didSettle,
    didThrow,
    drainAfterEachTest,
    drainGC,
    hammer,
    wasCollected,
};
