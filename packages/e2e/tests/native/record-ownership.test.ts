import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gsk from "@gtkx/gi/gsk";
import { alloc } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest, hammer, RSS_BUDGET } from "./helpers/memory.js";

drainAfterEachTest();

test("native strings maintain their buffer through replacement and growth", () => {
    const value = GLib.String.new("hello");
    value.append(" world");
    expect(value.str).toBe("hello world");
    expect(value.len).toBe(11);
    value.assign("x".repeat(4096));
    expect(value.str).toBe("x".repeat(4096));
    expect(value.len).toBe(4096);
    value.truncate(0);
    expect(value.str).toBe("");
    expect(value.len).toBe(0);
    expect(GLib.String.new(null).str).toBe("");
});

test("native strings release buffers after repeated reallocations", async () => {
    expect(await hammer(5000, () => {
        const value = GLib.String.new("initial");
        value.assign("x".repeat(8192));
        value.append("y".repeat(8192));
        value.truncate(3);

        return value.str;
    })).toBeLessThan(RSS_BUDGET);
});

test.each([false, true])("borrowed string fields release replaced and final storage (clear: %s)", async (clear) => {
    const field = t.field(t.string(), 0);
    const first = "a".repeat(8192);
    const second = "b".repeat(8192);

    expect(await hammer(6000, () => {
        const storage = alloc(8);
        field.write(storage, first);
        field.write(storage, second);

        if (clear) {
            field.write(storage, null);
        }

        return field.read(storage);
    })).toBeLessThan(RSS_BUDGET);
});

test("native string storage fields cannot be replaced directly", () => {
    const value = GLib.String.new("hello");
    for (const fields of [{ str: "other" }, { len: 0 }, { allocatedLen: 0 }]) {
        expect(() => Object.assign(value, fields)).toThrow();
    }
    expect(value.str).toBe("hello");
    expect(value.len).toBe(5);
    expect(() => {
        Reflect.construct(GLib.String, []);
    }).toThrow();
    expect(() => {
        Reflect.apply(GLib.String.new, GLib.String, [42]);
    }).toThrow();
});

test("simple records retain inline boxed values as views", () => {
    const stop = new Gsk.ColorStop({ offset: 0.5, color: new Gdk.RGBA({ red: 1, alpha: 1 }) });
    const color = stop.color;
    color.red = 0.25;
    expect(stop.offset).toBe(0.5);
    expect(stop.color.red).toBe(0.25);
    expect(stop.color.alpha).toBe(1);
    expect(new Gsk.ColorStop().offset).toBe(0);
});

test("zero initialized values support native initialization and replacement", () => {
    const value = new GObject.Value();
    value.init(GObject.typeFromName("gchararray"));
    value.setString("owned");
    expect(value.getString()).toBe("owned");
    value.setString(null);
    expect(value.getString()).toBeNull();
});
