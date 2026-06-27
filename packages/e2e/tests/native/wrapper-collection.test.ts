import { getHandle } from "@gtkx/ffi";
import * as Gtk from "@gtkx/gi/gtk";
import { getWrapper, type Handle } from "@gtkx/native";
import { finalizeCount, watchObjectFinalize } from "@gtkx/native/test-support";
import { describe, expect, it } from "vitest";
import { forceGC, getRefCount } from "../helpers/native-utils.js";

async function gcUntil(predicate: () => boolean, maxRounds = 100): Promise<boolean> {
    for (let i = 0; i < maxRounds; i++) {
        if (predicate()) return true;
        await new Promise((resolve) => setImmediate(resolve));
        forceGC();
        await new Promise((resolve) => setImmediate(resolve));
    }
    return predicate();
}

function detachLabel(watch: boolean): { handle: Handle; weak: WeakRef<object> } {
    const label = new Gtk.Label();
    const handle = getHandle(label);
    if (watch) watchObjectFinalize(handle);
    return { handle, weak: new WeakRef(label) };
}

function appendDetachedLabel(box: Gtk.Box): { handle: Handle; weak: WeakRef<object> } {
    const label = new Gtk.Label();
    box.append(label);
    return { handle: getHandle(label), weak: new WeakRef(label) };
}

describe("wrapper identity and reference counting", () => {
    it("keeps a strongly-held wrapper alive across GC and preserves identity", async () => {
        const box = new Gtk.Box();
        const { handle, weak } = appendDetachedLabel(box);

        expect(getRefCount(handle)).toBe(2);

        await gcUntil(() => false, 5);

        expect(weak.deref()).toBeDefined();
        expect(getWrapper(handle)).toBe(weak.deref());
    });

    it("flips the wrapper strong and weak as the object gains and loses holders", () => {
        const box = new Gtk.Box();
        const label = new Gtk.Label();
        const handle = getHandle(label);

        expect(getRefCount(handle)).toBe(1);

        box.append(label);
        expect(getRefCount(handle)).toBe(2);

        box.remove(label);
        expect(getRefCount(handle)).toBe(1);

        expect(getWrapper(handle)).toBe(label);
    });
});

describe("wrapper collection and double-free", () => {
    it("collects a wrapper with no other holder once its JS reference is dropped", async () => {
        const { handle, weak } = detachLabel(false);

        expect(getRefCount(handle)).toBe(1);

        const collected = await gcUntil(() => weak.deref() === undefined);

        expect(collected).toBe(true);
    });

    it("frees the underlying GObject exactly once when its wrapper is collected", async () => {
        const before = finalizeCount();
        const { weak } = detachLabel(true);

        await gcUntil(() => weak.deref() === undefined);
        await gcUntil(() => finalizeCount() > before);

        expect(finalizeCount()).toBe(before + 1);
    });
});
