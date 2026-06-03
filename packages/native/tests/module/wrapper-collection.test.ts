import { beforeAll, describe, expect, it } from "vitest";
import { applyWrapperRefOp, getWrapper, type NativeHandle, setObjectToggleNotify, setWrapper } from "../../index.js";
import { finalizeCount, watchObjectFinalize } from "./native-test-support.js";
import { boxAppend, boxRemove, createBox, createLabel, forceGC, getRefCount } from "./utils.js";

/**
 * Drives `forceGC` and yields to the event loop until `predicate` holds or the
 * round budget is exhausted, so a napi finalizer that runs across several GC
 * passes — and the `GLib`-thread idle it schedules — has a chance to complete.
 *
 * Each `forceGC` is preceded by an `await`, so the strong reference a prior
 * `WeakRef.deref()` leaves on the stack is unwound before collection runs;
 * otherwise conservative stack scanning would re-pin the wrapper every round.
 */
async function gcUntil(predicate: () => boolean, maxRounds = 100): Promise<boolean> {
    for (let i = 0; i < maxRounds; i++) {
        if (predicate()) return true;
        await new Promise((resolve) => setImmediate(resolve));
        forceGC();
        await new Promise((resolve) => setImmediate(resolve));
    }
    return predicate();
}

/**
 * Binds a fresh wrapper to `handle` in an isolated scope and returns only a
 * `WeakRef` to it, so the wrapper is unreachable from the caller — a strong
 * local would otherwise pin it past garbage collection in an async test body.
 */
function bindWrapper(handle: NativeHandle, tag: string): WeakRef<object> {
    const wrapper = { tag };
    setWrapper(handle, wrapper);
    return new WeakRef(wrapper);
}

beforeAll(() => {
    setObjectToggleNotify((refPtr, op) => {
        applyWrapperRefOp(refPtr, op);
    });
});

describe("wrapper identity and reference counting", () => {
    it("keeps a strongly-held wrapper alive across GC and preserves identity", async () => {
        const box = createBox();
        const label = createLabel("Held") as NativeHandle;
        let wrapper: { tag: string } | null = { tag: "held" };
        const weak = new WeakRef(wrapper);

        setWrapper(label, wrapper);
        boxAppend(box, label);

        expect(getRefCount(label)).toBe(2);

        wrapper = null;
        await gcUntil(() => false, 5);

        expect(weak.deref()).toBeDefined();
        expect(getWrapper(label)).toBe(weak.deref());
    });

    it("flips the wrapper strong and weak as the object gains and loses holders", () => {
        const box = createBox();
        const label = createLabel("Toggling") as NativeHandle;
        const wrapper = { tag: "toggling" };

        setWrapper(label, wrapper);
        expect(getRefCount(label)).toBe(1);

        boxAppend(box, label);
        expect(getRefCount(label)).toBe(2);

        boxRemove(box, label);
        expect(getRefCount(label)).toBe(1);

        expect(getWrapper(label)).toBe(wrapper);
    });
});

describe("wrapper collection and double-free", () => {
    it("collects a wrapper with no other holder once its JS reference is dropped", async () => {
        const label = createLabel("Collectable") as NativeHandle;
        const weak = bindWrapper(label, "collectable");

        expect(getRefCount(label)).toBe(1);

        const collected = await gcUntil(() => weak.deref() === undefined);

        expect(collected).toBe(true);
    });

    it("frees the underlying GObject exactly once when its wrapper is collected", async () => {
        const before = finalizeCount();
        const label = createLabel("Freed") as NativeHandle;
        watchObjectFinalize(label);

        const weak = bindWrapper(label, "freed");

        await gcUntil(() => weak.deref() === undefined);
        await gcUntil(() => finalizeCount() > before);

        expect(finalizeCount()).toBe(before + 1);
    });
});
