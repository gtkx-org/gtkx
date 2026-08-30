import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type ExternalObject, getWrapper, type Handle, setWrapper } from "@gtkx/native";
import { getHandle, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

type TrackedObject = { handle: ExternalObject<Handle>; weak: WeakRef<object> };

const detachLabel = (): TrackedObject => {
    const label = new Gtk.Label();

    return { handle: getHandle(label), weak: new WeakRef(label) };
};

const detachRegisteredObject = (): TrackedObject => {
    const item = new NameObject();

    return { handle: getHandle(item), weak: new WeakRef(item) };
};

const appendDetachedLabel = (box: Gtk.Box): TrackedObject => {
    const label = new Gtk.Label();
    box.append(label);

    return { handle: getHandle(label), weak: new WeakRef(label) };
};

class NameObject extends GObject.Object {
    name = "";
}

registerClass(NameObject, { typeName: "GtkxTestModelNameObject" });

describe("wrapper lifecycle", () => {
    it("happy path", () => {
        const label = new Gtk.Label();
        const handle = getHandle(label);
        expect(getWrapper(handle)).toBe(label);

        for (let generation = 1; generation <= 5; generation += 1) {
            const next = { generation };
            setWrapper(handle, next);
            expect(getWrapper(handle)).toBe(next);
        }

        const item = new NameObject();
        item.name = "Persisted";
        const store = Gio.ListStore.new(NameObject.prototype.__type__);
        store.append(item);
        expect(store.getItem(0)).toBe(item);
        expect((store.getItem(0) as NameObject).name).toBe("Persisted");
    });

    it("edge cases", async () => {
        const box = new Gtk.Box();
        const { handle, weak } = appendDetachedLabel(box);
        await gcUntil(() => false, 5);
        expect(weak.deref()).toBeDefined();
        expect(getWrapper(handle)).toBe(weak.deref());

        const plain = detachLabel();
        await gcUntil(() => plain.weak.deref() === undefined);
        expect(plain.weak.deref()).toBeUndefined();
        const registered = detachRegisteredObject();
        await gcUntil(() => registered.weak.deref() === undefined);
        expect(registered.weak.deref()).toBeUndefined();
    });
});
