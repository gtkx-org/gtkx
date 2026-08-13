import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { type ExternalObject, getWrapper, type Handle, setWrapper } from "@gtkx/native";
import { getHandle, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createApplication } from "../helpers/application.js";
import { gcUntil, getRefCount } from "../helpers/native-utils.js";

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

const refCountFor = (instance: object): number => getRefCount(getHandle(instance));

class NameObject extends GObject.Object {
    name = "";
}

class RegisteredLabel extends Gtk.Label {}
class RegisteredWindow extends Gtk.Window {}

registerClass(NameObject, { typeName: "GtkxTestModelNameObject" });
registerClass(RegisteredLabel, { typeName: "GtkxTestRegisteredLabel" });
registerClass(RegisteredWindow, { typeName: "GtkxTestRegisteredWindow" });

describe("wrapper identity", () => {
    it("resolves a wrapper back from its handle, and follows every rebind on a single toggle ref", () => {
        const label = new Gtk.Label();
        const handle = getHandle(label);
        expect(getWrapper(handle)).toBe(label);

        for (let generation = 1; generation <= 5; generation += 1) {
            const next = { generation };
            setWrapper(handle, next);
            expect(getRefCount(handle)).toBe(1);
            expect(getWrapper(handle)).toBe(next);
        }
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

describe("wrapper reference counting", () => {
    it("keeps a strongly-held wrapper alive across GC and preserves its identity", async () => {
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

    it("collects a plain and a registered wrapper once their JS references are dropped", async () => {
        const plain = detachLabel();
        expect(getRefCount(plain.handle)).toBe(1);
        await gcUntil(() => plain.weak.deref() === undefined);
        expect(plain.weak.deref()).toBeUndefined();
        const registered = detachRegisteredObject();
        expect(getRefCount(registered.handle)).toBe(1);
        await gcUntil(() => registered.weak.deref() === undefined);
        expect(registered.weak.deref()).toBeUndefined();
    });

    it("holds registered subclasses exactly as their unregistered parents are held", () => {
        expect(refCountFor(new NameObject())).toBe(refCountFor(new GObject.Object()));
        expect(refCountFor(new RegisteredWindow())).toBe(refCountFor(new Gtk.Window()));
        const label = new RegisteredLabel();
        expect(refCountFor(label)).toBe(refCountFor(new Gtk.Label()));
        const box = new Gtk.Box();
        box.append(label);
        expect(refCountFor(label)).toBe(2);
        box.remove(label);
        expect(refCountFor(label)).toBe(1);
        expect(refCountFor(createApplication())).toBe(1);
    });
});
