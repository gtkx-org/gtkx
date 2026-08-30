import { bind, call } from "@gtkx/native";
import assert from "node:assert/strict";
import { afterEach } from "node:test";

const settle = () => new Promise((resolve) => setImmediate(resolve));

const leakCheck = (() => {
    const runtime = process.env.GTKX_ASAN_RUNTIME;

    if (runtime === undefined) {
        return () => 0;
    }

    const check = bind(runtime, "__lsan_do_recoverable_leak_check", [], { kind: "int32" });

    return () => call(check, []);
})();

const drainGC = async (rounds = 3) => {
    for (let round = 0; round < rounds; round += 1) {
        globalThis.gc();
        await settle();
    }
};

const gcUntil = async (predicate, rounds = 30) => {
    for (let round = 0; round < rounds; round += 1) {
        if (await predicate()) {
            return true;
        }

        await settle();
        globalThis.gc();
        await settle();
    }

    return predicate();
};

const drainAfterEachTest = () => {
    afterEach(async (context) => {
        await drainGC();
        assert.equal(leakCheck(), 0, `${context.name}: LeakSanitizer found leaked native memory`);
    });
};

export { drainAfterEachTest, drainGC, gcUntil };
