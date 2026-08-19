import type { ParamSpec } from "@gtkx/gi/gobject";
import { Object as GObject, ParamFlags, paramSpecInt, paramSpecUint } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { coerceObjectProperty, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type WholeCase = { property: string; written: number; coerced: number; described: string };
type UnchangedCase = { property: string; written: unknown; described: string };

const uniqueName = createTypeNameFactory("_");

const WHOLE: WholeCase[] = [
    { property: "margin-start", written: 12.6, coerced: 12, described: "truncates a fraction for a gint" },
    { property: "marginStart", written: 12.4, coerced: 12, described: "accepts the camelCased name" },
    { property: "margin-start", written: -5, coerced: 0, described: "clamps below the gint range" },
    { property: "margin-start", written: 1e9, coerced: 32_767, described: "clamps above the gint range" },
    { property: "halign", written: 1.6, coerced: Gtk.Align.START, described: "truncates a fraction for an enum" },
    { property: "opacity", written: 1.5, coerced: 1, described: "clamps a gdouble to its range" },
    { property: "opacity", written: 0.37, coerced: 0.37, described: "leaves a gdouble in range alone" },
    { property: "width-request", written: 40, coerced: 40, described: "leaves a whole gint alone" },
];

const UNCHANGED: UnchangedCase[] = [
    { property: "no-such-property", written: 1.5, described: "a name the object does not install" },
    { property: "label", written: "text", described: "a string" },
    { property: "visible", written: false, described: "a boolean" },
    { property: "label", written: null, described: "null" },
    { property: "margin-start", written: NaN, described: "NaN" },
    { property: "opacity", written: Infinity, described: "an infinity" },
    { property: "label", written: 12.5, described: "a number for a string property" },
];

const probeProperties = (): Record<string, ParamSpec> => ({
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    count: paramSpecUint("count", null, null, 0, 10, 0, ParamFlags.READWRITE),
});

const makeProbeClass = () => {
    class Probe extends GObject {
        declare red: number;

        declare count: number;
    }

    registerClass(Probe, { typeName: uniqueName("GtkxCoerceProbe"), properties: probeProperties() });

    return Probe;
};

describe("coerceObjectProperty", () => {
    it.each(WHOLE)("$described", ({ property, written, coerced }) => {
        expect(coerceObjectProperty(new Gtk.Label(), property, written)).toBe(coerced);
    });

    it("writes back a value the property accepts without tripping the range check", () => {
        const label = new Gtk.Label();
        label.marginStart = coerceObjectProperty(label, "marginStart", -3.2) as number;
        label.opacity = coerceObjectProperty(label, "opacity", 1.2) as number;
        expect(label.marginStart).toBe(0);
        expect(label.opacity).toBe(1);
    });

    it("fits the construct properties a wrapper declares the same way", () => {
        const label = new Gtk.Label({ marginStart: 12.6, opacity: 1.5 });
        expect(label.marginStart).toBe(12);
        expect(label.opacity).toBe(1);
    });

    it("follows the range a registered class declares", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        expect(coerceObjectProperty(probe, "red", 300.2)).toBe(255);
        expect(coerceObjectProperty(probe, "red", 127.5)).toBe(127);
        expect(coerceObjectProperty(probe, "count", -1)).toBe(0);
        expect(coerceObjectProperty(probe, "count", 10.4)).toBe(10);
    });
});

describe("coerceObjectProperty - values left alone", () => {
    it.each(UNCHANGED)("returns $described unchanged", ({ property, written }) => {
        expect(coerceObjectProperty(new Gtk.Label(), property, written)).toBe(written);
    });

    it("returns the value unchanged for a receiver that is not a GObject", () => {
        expect(coerceObjectProperty({ marginStart: 0 }, "marginStart", 1.5)).toBe(1.5);
    });
});
