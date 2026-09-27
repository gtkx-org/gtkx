import * as GObject from "@gtkx/gi/gobject";
import { getClassType } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

test("a generated boxed class resolves to a registered GType", () => {
    expect(getClassType(GObject.Closure)).toBeGreaterThan(0n);
    expect(GObject.typeName(GObject.Closure)).toBe("GClosure");
});

test("a generated class and its native name resolve to the same GType repeatedly", () => {
    const type = getClassType(GObject.Closure);
    expect(GObject.typeFromName("GClosure")).toBe(type);
    expect(GObject.typeFromName("GClosure")).toBe(type);
});

test("distinct generated boxed classes resolve to distinct GTypes", () => {
    expect(getClassType(GObject.Closure)).not.toBe(getClassType(GObject.Value));
    expect(GObject.typeName(GObject.Value)).toBe("GValue");
});

test("an unknown registered name resolves to the invalid GType", () => {
    expect(GObject.typeFromName("GtkxMissingGeneratedCallType")).toBe(0n);
});

test("generated type queries reject invalid arguments", () => {
    expect(() => {
        Reflect.apply(GObject.typeName, undefined, [{}]);
    }).toThrow();
});
