import { bind, call } from "@gtkx/native";
import { afterEach, expect } from "vitest";

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const leakCheck = ((): (() => number) => {
    const runtime = process.env.GTKX_ASAN_RUNTIME;

    if (runtime === undefined) {
        return () => 0;
    }

    const check = bind(runtime, "__lsan_do_recoverable_leak_check", [], { kind: "int32" });

    return () => call(check, []) as number;
})();

const drainGC = async (rounds = 3): Promise<void> => {
    for (let round = 0; round < rounds; round++) {
        globalThis.gc?.();
        await settle();
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

export { drainAfterEachTest, drainGC, didSettle };
