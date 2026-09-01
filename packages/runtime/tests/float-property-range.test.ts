import type { ParamSpec } from "@gtkx/gi/gobject";
import { Object as GObject, ParamFlags, paramSpecDouble, paramSpecFloat } from "@gtkx/gi/gobject";
import { registerClass, TYPE_DOUBLE, TYPE_FLOAT } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { valueOfType, watchNotify } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type NarrowedCase = { written: number; narrowed: number; described: string };
type RefusedCase = { name: string; written: unknown; described: string };

const uniqueName = createTypeNameFactory("_");
const FLOAT_MAXIMUM = 3.4028234663852886e38;
const ABOVE_FLOAT_MAXIMUM = 3.4028235e38;
const NARROWED_TENTH = 0.10000000149011612;

const NARROWED: NarrowedCase[] = [
    { written: 0.1, narrowed: NARROWED_TENTH, described: "a double no gfloat spells exactly" },
    { written: -0.1, narrowed: -NARROWED_TENTH, described: "a negative double no gfloat spells exactly" },
    { written: 1e300, narrowed: Infinity, described: "a magnitude no gfloat holds" },
    { written: ABOVE_FLOAT_MAXIMUM, narrowed: FLOAT_MAXIMUM, described: "a magnitude just past the widest gfloat" },
];

const REFUSED: RefusedCase[] = [
    { name: "span", written: NaN, described: "NaN written to an unbounded gdouble" },
    { name: "reach", written: NaN, described: "NaN written to an unbounded gfloat" },
    { name: "ratio", written: Infinity, described: "an infinity the gdouble range excludes" },
    { name: "ratio", written: -Infinity, described: "a negative infinity the gdouble range excludes" },
    { name: "gain", written: 1e300, described: "a magnitude the gfloat range excludes" },
    { name: "gain", written: -1e300, described: "a negative magnitude the gfloat range excludes" },
    { name: "span", written: "far", described: "a string written to a gdouble" },
    { name: "reach", written: null, described: "null written to a gfloat" },
];

const probeProperties = (): Record<string, ParamSpec> => ({
    span: paramSpecDouble("span", null, null, -Infinity, Infinity, Infinity, ParamFlags.READWRITE),
    ratio: paramSpecDouble("ratio", null, null, 0, 1, 0, ParamFlags.READWRITE),
    reach: paramSpecFloat("reach", null, null, -Infinity, Infinity, Infinity, ParamFlags.READWRITE),
    gain: paramSpecFloat("gain", null, null, 0, 1, 0, ParamFlags.READWRITE),
});

const makeProbeClass = () => {
    class Probe extends GObject {
        declare span: number;

        declare ratio: number;

        declare reach: number;

        declare gain: number;
    }

    registerClass(Probe, { typeName: uniqueName("GtkxFloatRange"), properties: probeProperties() });

    return Probe;
};

const servedBy = (instance: GObject, name: string, gtype: bigint): number => {
    const value = valueOfType(gtype);
    instance.getProperty(name, value);

    return gtype === TYPE_FLOAT ? value.getFloat() : value.getDouble();
};

describe("a floating-point property whose ParamSpec range admits infinity", () => {
    it("takes both infinities on a gdouble and a gfloat, and serves them back", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        expect(probe.span).toBe(Infinity);
        probe.span = -Infinity;
        probe.reach = Infinity;
        expect(probe.span).toBe(-Infinity);
        expect(probe.reach).toBe(Infinity);
        expect(new Probe({ span: Infinity, reach: -Infinity }).reach).toBe(-Infinity);
        expect(servedBy(probe, "span", TYPE_DOUBLE)).toBe(-Infinity);
        expect(servedBy(probe, "reach", TYPE_FLOAT)).toBe(Infinity);
    });
});

describe("a double written to a gfloat property whose range admits what it narrows to", () => {
    it.each(NARROWED)("holds and serves $described as the gfloat it narrows to", (entry) => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        probe.reach = entry.written;
        expect(probe.reach).toBe(entry.narrowed);
        expect(servedBy(probe, "reach", TYPE_FLOAT)).toBe(entry.narrowed);
        expect(new Probe({ reach: entry.written }).reach).toBe(entry.narrowed);
    });

    it("notifies once for a double it narrows and not again for the same double", () => {
        const probe = new (makeProbeClass())();
        probe.reach = 0.5;
        const seen = watchNotify(probe);

        for (const written of [0.1, 0.1]) {
            probe.reach = written;
        }

        expect(seen).toEqual(["reach"]);
    });
});

describe("a value a floating-point property cannot hold", () => {
    it.each(REFUSED)("refuses $described and leaves the property as it was", (entry) => {
        const probe = new (makeProbeClass())();
        Reflect.set(probe, entry.name, 0.5);
        expect(() => Reflect.set(probe, entry.name, entry.written)).toThrow();
        expect(Reflect.get(probe, entry.name)).toBe(0.5);
    });

    it.each(REFUSED)("refuses $described handed to the constructor", (entry) => {
        const Probe = makeProbeClass();
        expect(() => new Probe({ [entry.name]: entry.written })).toThrow();
    });
});
