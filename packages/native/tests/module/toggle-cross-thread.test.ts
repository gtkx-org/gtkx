import { describe, expect, it } from "vitest";
import { getWrapper, type Handle, setWrapper } from "../../index.js";
import { driveToggleFromThread, finalizeCount, watchObjectFinalize } from "./native-test-support.js";
import { createLabel, forceGC, getRefCount } from "./utils.js";

describe("toggle references under cross-thread churn", () => {
    it("keeps wrapper identity and refcount stable while toggle notifies race GC", async () => {
        const label = createLabel("Churned") as Handle;
        const wrapper = { tag: "churned" };
        setWrapper(label, wrapper);
        watchObjectFinalize(label);

        const baseRefCount = getRefCount(label);
        const finalizedBefore = finalizeCount();

        driveToggleFromThread(label, 200);

        forceGC();
        await new Promise((resolve) => setImmediate(resolve));

        expect(getRefCount(label)).toBe(baseRefCount);
        expect(getWrapper(label)).toBe(wrapper);
        expect(finalizeCount()).toBe(finalizedBefore);
    });
});
