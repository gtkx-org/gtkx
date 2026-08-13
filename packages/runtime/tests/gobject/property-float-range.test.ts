import type { ParamSpec } from "@gtkx/gi/gobject";
import { Object as GObject, ParamFlags, paramSpecDouble, paramSpecFloat } from "@gtkx/gi/gobject";
import { registerClass, TYPE_DOUBLE, TYPE_FLOAT } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { type ErrorClass, expectThrown, uniqueName, valueOfType } from "./helpers.js";

type WrittenCase = { name: string; type: string; written: unknown; described: string };
type RangeCase = WrittenCase & { substitute: string };
type NarrowedCase = { written: number; narrowed: number; described: string };
type Probe = InstanceType<ReturnType<typeof makeProbeClass>>;

const FLOAT_MAXIMUM = 3.4028234663852886e38;
const ABOVE_FLOAT_MAXIMUM = 3.4028235e38;
const HELD = 0.5;

const RANGE_REFUSED: RangeCase[] = [
    { name: "span", type: "gdouble", written: NaN, described: "NaN", substitute: "NaN" },
    { name: "reach", type: "gfloat", written: NaN, described: "NaN", substitute: "NaN" },
    { name: "ratio", type: "gdouble", written: NaN, described: "NaN", substitute: "NaN" },
    { name: "gain", type: "gfloat", written: NaN, described: "NaN", substitute: "NaN" },
    { name: "ratio", type: "gdouble", written: Infinity, described: "Infinity", substitute: "1" },
    { name: "ratio", type: "gdouble", written: -Infinity, described: "-Infinity", substitute: "0" },
    { name: "gain", type: "gfloat", written: Infinity, described: "Infinity", substitute: "1" },
    { name: "gain", type: "gfloat", written: -Infinity, described: "-Infinity", substitute: "0" },
    { name: "gain", type: "gfloat", written: 1e300, described: "1e+300", substitute: "1" },
    { name: "gain", type: "gfloat", written: -1e300, described: "-1e+300", substitute: "0" },
];

const TYPE_REFUSED: WrittenCase[] = [
    { name: "span", type: "gdouble", written: "far", described: '"far"' },
    { name: "reach", type: "gfloat", written: "far", described: '"far"' },
    { name: "span", type: "gdouble", written: null, described: "null" },
    { name: "reach", type: "gfloat", written: undefined, described: "undefined" },
];

const NARROWED: NarrowedCase[] = [
    { written: 1e300, narrowed: Infinity, described: "a magnitude no gfloat holds" },
    { written: -1e300, narrowed: -Infinity, described: "a negative magnitude no gfloat holds" },
    { written: ABOVE_FLOAT_MAXIMUM, narrowed: FLOAT_MAXIMUM, described: "a magnitude just past the widest gfloat" },
    {
        written: -ABOVE_FLOAT_MAXIMUM,
        narrowed: -FLOAT_MAXIMUM,
        described: "a negative magnitude just past the widest gfloat",
    },
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

    registerClass(Probe, { typeName: uniqueName("GtkxFloatRangeProbe"), properties: probeProperties() });

    return Probe;
};

const refusalPrefix = (entry: WrittenCase): string =>
    `Probe.${entry.name}: cannot set property '${entry.name}' to ${entry.described}; `;

const rangeMessage = (entry: RangeCase): string =>
    `${refusalPrefix(entry)}the value is invalid or out of range for type '${entry.type}', ` +
    `and GObject would put ${entry.substitute} in its place`;

const typeMessage = (entry: WrittenCase): string =>
    `${refusalPrefix(entry)}the property holds values of type '${entry.type}'`;

const probeHolding = (name: string, value: unknown): Probe => {
    const probe = new (makeProbeClass())();
    Reflect.set(probe, name, value);

    return probe;
};

const servedBy = (probe: Probe, name: string, type: bigint): number => {
    const value = valueOfType(type);
    probe.getProperty(name, value);

    return type === TYPE_FLOAT ? value.getFloat() : value.getDouble();
};

const expectRefused = (entry: WrittenCase, kind: ErrorClass, message: string): void => {
    const probe = probeHolding(entry.name, HELD);

    expectThrown(() => {
        Reflect.set(probe, entry.name, entry.written);
    }, kind, message);

    expect(Reflect.get(probe, entry.name)).toBe(HELD);
};

describe("a floating-point property whose ParamSpec range admits infinity", () => {
    it("writes the infinite default one instance serves onto another", () => {
        const Probe = makeProbeClass();
        const source = new Probe();
        const target = new Probe();
        target.span = 5;
        target.span = source.span;
        expect(source.span).toBe(Infinity);
        expect(target.span).toBe(Infinity);
    });

    it("takes the declared infinite default at construction and the opposite infinity after it", () => {
        const probe = probeHolding("span", -Infinity);
        expect(probe.span).toBe(-Infinity);
        expect(new (makeProbeClass())({ span: Infinity }).span).toBe(Infinity);
    });

    it("takes both infinities on a float property whose range admits them", () => {
        const probe = probeHolding("reach", 5);
        probe.reach = Infinity;
        expect(probe.reach).toBe(Infinity);
        expect(new (makeProbeClass())({ reach: -Infinity }).reach).toBe(-Infinity);
    });

    it("serves an infinite double through the GValue GObject reads the property into", () => {
        const probe = probeHolding("span", 5);
        probe.span = Infinity;
        expect(servedBy(probe, "span", TYPE_DOUBLE)).toBe(Infinity);
    });
});

describe("a magnitude wider than a gfloat written where the ParamSpec range admits what it narrows to", () => {
    it.each(NARROWED)("holds $described as the gfloat GObject narrows it to", (entry) => {
        const probe = probeHolding("reach", entry.written);
        expect(servedBy(probe, "reach", TYPE_FLOAT)).toBe(entry.narrowed);
        expect(new (makeProbeClass())({ reach: entry.written }).reach).toBe(entry.narrowed);
    });
});

describe("a value a floating-point ParamSpec's range rejects", () => {
    it.each(RANGE_REFUSED)("refuses $described written to $name as out of range for $type", (entry) => {
        expectRefused(entry, RangeError, rangeMessage(entry));
    });

    it.each(RANGE_REFUSED)("refuses $described handed to the constructor for $name", (entry) => {
        const Probe = makeProbeClass();
        expectThrown(() => new Probe({ [entry.name]: entry.written }), RangeError, rangeMessage(entry));
    });
});

describe("a value a floating-point property cannot hold at all", () => {
    it.each(TYPE_REFUSED)("refuses $described written to $name as a $type mismatch", (entry) => {
        expectRefused(entry, TypeError, typeMessage(entry));
    });
});
