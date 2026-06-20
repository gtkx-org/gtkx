import { describe, expect, it } from "vitest";
import { getWrapper, type Handle, setWrapper } from "../../index.js";
import { finalizeCount, watchObjectFinalize } from "./native-test-support.js";
import { boxAppend, boxRemove, createBox, createLabel, forceGC, getRefCount } from "./utils.js";

async function gcUntil(predicate: () => boolean, maxRounds = 100): Promise<boolean> {
    for (let i = 0; i < maxRounds; i++) {
        if (predicate()) return true;
        await new Promise((resolve) => setImmediate(resolve));
        forceGC();
        await new Promise((resolve) => setImmediate(resolve));
    }
    return predicate();
}

function bindWrapper(handle: Handle, tag: string): WeakRef<object> {
    const wrapper = { tag };
    setWrapper(handle, wrapper);
    return new WeakRef(wrapper);
}

describe("wrapper identity and reference counting", () => {
    it("keeps a strongly-held wrapper alive across GC and preserves identity", async () => {
        const box = createBox();
        const label = createLabel("Held") as Handle;
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
        const label = createLabel("Toggling") as Handle;
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
        const label = createLabel("Collectable") as Handle;
        const weak = bindWrapper(label, "collectable");

        expect(getRefCount(label)).toBe(1);

        const collected = await gcUntil(() => weak.deref() === undefined);

        expect(collected).toBe(true);
    });

    it("frees the underlying GObject exactly once when its wrapper is collected", async () => {
        const before = finalizeCount();
        const label = createLabel("Freed") as Handle;
        watchObjectFinalize(label);

        const weak = bindWrapper(label, "freed");

        await gcUntil(() => weak.deref() === undefined);
        await gcUntil(() => finalizeCount() > before);

        expect(finalizeCount()).toBe(before + 1);
    });
});
