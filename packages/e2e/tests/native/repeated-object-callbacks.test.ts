import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { expect, it } from "vitest";

it("searches a large native store through repeated object callbacks", () => {
    const item = Gtk.StringObject.new("same native identity");
    const needle = Gtk.StringObject.new("missing");
    const store = Gio.ListStore.new(GObject.TYPE_OBJECT);
    store.splice(
        0,
        0,
        Array.from({ length: 100_000 }, () => item),
    );
    let calls = 0;
    let isMatchingIdentity = true;
    const [found] = store.findWithEqualFunc(needle, (candidate, target) => {
        calls += 1;
        isMatchingIdentity &&= candidate === item && target === needle;

        return false;
    });
    expect(found).toBe(false);
    expect(calls).toBe(100_000);
    expect(isMatchingIdentity).toBe(true);
    expect(store.getNItems()).toBe(100_000);
    store.removeAll();
    expect(store.getNItems()).toBe(0);
});

it("finds a late match after repeated native object aliases", () => {
    const item = Gtk.StringObject.new("same native identity");
    const target = Gtk.StringObject.new("last");
    const store = Gio.ListStore.new(GObject.TYPE_OBJECT);
    store.splice(0, 0, [...Array.from({ length: 100_000 }, () => item), target]);
    const [found, position] = store.findWithEqualFunc(target, (candidate, needle) => candidate === needle);
    expect(found).toBe(true);
    expect(position).toBe(100_000);
    store.removeAll();
});

it("preserves a native store after a late callback rejection", () => {
    const item = Gtk.StringObject.new("same native identity");
    const needle = Gtk.StringObject.new("missing");
    const store = Gio.ListStore.new(GObject.TYPE_OBJECT);
    store.splice(
        0,
        0,
        Array.from({ length: 100_000 }, () => item),
    );
    let calls = 0;
    expect(() =>
        store.findWithEqualFunc(needle, () => {
            calls++;
            if (calls === 100_000) {
                throw new Error("Callback rejected");
            }

            return false;
        }),
    ).toThrow();
    expect(calls).toBe(100_000);
    expect(store.getNItems()).toBe(100_000);
    expect(store.getItem(99_999)).toBe(item);
    store.removeAll();
    expect(store.getNItems()).toBe(0);
});
