import assert from "node:assert/strict";
import { afterEach, beforeEach } from "node:test";
import { leakCheck, liveWrapperCount } from "@gtkx/native";

const settle = () => new Promise((resolve) => setImmediate(resolve));

export const drainGC = async (rounds = 3) => {
    for (let round = 0; round < rounds; round += 1) {
        globalThis.gc();
        await settle();
    }
};

export const gcUntil = async (predicate, rounds = 30) => {
    for (let round = 0; round < rounds; round += 1) {
        if (await predicate()) {
            return true;
        }

        globalThis.gc();
        await settle();
    }

    return predicate();
};

export const installMemoryGuard = () => {
    let baseline = 0;

    beforeEach(async () => {
        await drainGC();
        baseline = liveWrapperCount();
    });

    afterEach(async (context) => {
        const settled = await gcUntil(() => liveWrapperCount() <= baseline);
        const alive = liveWrapperCount() - baseline;
        assert.ok(settled, `${context.name}: ${alive} native wrappers left alive after the test`);
        assert.equal(leakCheck(), 0, `${context.name}: LeakSanitizer found leaked native memory`);
    });
};
