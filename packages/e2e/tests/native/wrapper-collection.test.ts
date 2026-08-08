import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type ExternalObject, getWrapper, type Handle } from "@gtkx/native";
import { getHandle, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { forceGC, getRefCount } from "../helpers/native-utils.js";

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the wait succeeded */
async function gcUntil(isSatisfied: () => boolean, maxRounds = 100): Promise<boolean> {
    for (let i = 0; i < maxRounds; i++) {
        if (isSatisfied()) {
            return true;
        }

        await new Promise((resolve) => setImmediate(resolve));
        forceGC();
        await new Promise((resolve) => setImmediate(resolve));
    }

    return isSatisfied();
}

function detachLabel(): { handle: ExternalObject<Handle>; weak: WeakRef<object> } {
    const label = new Gtk.Label();
    const handle = getHandle(label);

    return { handle, weak: new WeakRef(label) };
}

function appendDetachedLabel(box: Gtk.Box): { handle: ExternalObject<Handle>; weak: WeakRef<object> } {
    const label = new Gtk.Label();
    box.append(label);

    return { handle: getHandle(label), weak: new WeakRef(label) };
}

class NameObject extends GObject.Object {
    name = "";
}

registerClass(NameObject, { typeName: "GtkxTestModelNameObject" });

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

    it("returns the same wrapper instance for a subclassed item held by a list store", () => {
        const item = new NameObject();
        item.name = "Persisted";
        const store = Gio.ListStore.new(NameObject.prototype.__type__);
        store.append(item);
        expect(store.getItem(0)).toBe(item);
        expect((store.getItem(0) as NameObject).name).toBe("Persisted");
    });
});

describe("wrapper collection", () => {
    it("collects a wrapper with no other holder once its JS reference is dropped", async () => {
        const { handle, weak } = detachLabel();
        expect(getRefCount(handle)).toBe(1);
        const isCollected = await gcUntil(() => weak.deref() === undefined);
        expect(isCollected).toBe(true);
    });
});
