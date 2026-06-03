import { beforeAll, describe, expect, it } from "vitest";
import { applyWrapperRefOp, getWrapper, type NativeHandle, setObjectToggleNotify, setWrapper } from "../../index.js";
import {
    driveToggleFromThread,
    finalizeCount,
    pendingToggleTasks,
    watchObjectFinalize,
} from "./native-test-support.js";
import { createLabel, forceGC, getRefCount } from "./utils.js";

describe("toggle references under cross-thread churn", () => {
    beforeAll(() => {
        setObjectToggleNotify((refPtr, op) => {
            applyWrapperRefOp(refPtr, op);
        });
    });

    it("keeps wrapper identity and refcount stable while toggle notifies race GC", async () => {
        const label = createLabel("Churned") as NativeHandle;
        const wrapper = { tag: "churned" };
        setWrapper(label, wrapper);
        watchObjectFinalize(label);

        const baseRefCount = getRefCount(label);
        const finalizedBefore = finalizeCount();

        driveToggleFromThread(label, 200);

        for (let round = 0; pendingToggleTasks() > 0 && round < 4000; round++) {
            if (round % 8 === 0) forceGC();
            await new Promise((resolve) => setImmediate(resolve));
        }

        expect(pendingToggleTasks()).toBe(0);
        expect(getRefCount(label)).toBe(baseRefCount);
        expect(getWrapper(label)).toBe(wrapper);
        expect(finalizeCount()).toBe(finalizedBefore);
    });
});
