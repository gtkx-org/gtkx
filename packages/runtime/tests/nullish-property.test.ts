import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    Object as GObject,
    ParamFlags,
    paramSpecBoolean,
    paramSpecBoxed,
    paramSpecDouble,
    paramSpecInt,
    paramSpecLong,
    paramSpecObject,
    paramSpecPointer,
    paramSpecString,
    typeFromName,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { watchNotify } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

type NamedCase = { name: string; fallback: unknown };
type HoldingCase = NamedCase & { hold: () => unknown; constructed: unknown };
type RefusingCase = NamedCase & { written: unknown };

const uniqueName = createTypeNameFactory("_");
const strvType = typeFromName("GStrv");
const labelType = typeFromName("GtkLabel");

const REFUSING: RefusingCase[] = [
    { name: "red", written: 120, fallback: 0 },
    { name: "ticks", written: 40n, fallback: 0n },
    { name: "ratio", written: 0.25, fallback: 0 },
    { name: "enabled", written: true, fallback: false },
];

const NULLISH = [
    { refused: null, described: "null" },
    { refused: undefined, described: "undefined" },
];

const REFUSED = REFUSING.flatMap((entry) => NULLISH.map((nullish) => ({ ...entry, ...nullish })));

const HOLDING_NULL: HoldingCase[] = [
    { name: "label", hold: (): unknown => "teal", fallback: "", constructed: null },
    { name: "tags", hold: (): unknown => ["one", "two"], fallback: [], constructed: [] },
    { name: "child", hold: (): unknown => new Gtk.Label(), fallback: null, constructed: null },
    { name: "target", hold: (): unknown => null, fallback: null, constructed: null },
];

const probeProperties = (): Record<string, ParamSpec> => ({
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    ticks: paramSpecLong("ticks", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
    ratio: paramSpecDouble("ratio", null, null, 0, 1, 0, ParamFlags.READWRITE),
    enabled: paramSpecBoolean("enabled", null, null, false, ParamFlags.READWRITE),
    label: paramSpecString("label", null, null, "", ParamFlags.READWRITE),
    tags: paramSpecBoxed("tags", null, null, strvType, ParamFlags.READWRITE),
    child: paramSpecObject("child", null, null, labelType, ParamFlags.READWRITE),
    target: paramSpecPointer("target", null, null, ParamFlags.READWRITE),
});

const makeProbeClass = () => {
    class Probe extends GObject {}
    registerClass(Probe, { typeName: uniqueName("GtkxNullishProbe"), properties: probeProperties() });

    return Probe;
};

const probeHolding = (name: string, value: unknown): GObject => {
    const probe = new (makeProbeClass())();
    Reflect.set(probe, name, value);

    return probe;
};

describe("nullish written to a property whose GValue holds no NULL", () => {
    it.each(REFUSED)("refuses $described written to $name and leaves the value in place", (entry) => {
        const probe = probeHolding(entry.name, entry.written);
        expect(() => Reflect.set(probe, entry.name, entry.refused)).toThrow(TypeError);
        expect(Reflect.get(probe, entry.name)).toBe(entry.written);
    });

    it.each(REFUSING)("refuses null handed to the constructor for $name", (entry) => {
        const Probe = makeProbeClass();
        expect(() => new Probe({ [entry.name]: null })).toThrow(TypeError);
    });

    it("emits no notify for a refused write", () => {
        const probe = probeHolding("red", 120);
        const seen = watchNotify(probe);
        expect(() => Reflect.set(probe, "red", null)).toThrow(TypeError);
        expect(seen).toEqual([]);
    });
});

describe("nullish written to a property whose GValue holds NULL", () => {
    it.each(HOLDING_NULL)("holds NULL for null and for undefined written to $name", (entry) => {
        expect(Reflect.get(probeHolding(entry.name, null), entry.name)).toBeNull();
        const cleared = probeHolding(entry.name, entry.hold());
        Reflect.set(cleared, entry.name, undefined);
        expect(Reflect.get(cleared, entry.name)).toBeNull();
    });

    it("collapses null and undefined written in a row into one notify", () => {
        const probe = new (makeProbeClass())();
        const seen = watchNotify(probe);
        Reflect.set(probe, "label", null);
        Reflect.set(probe, "label", undefined);
        Reflect.set(probe, "label", null);
        expect(seen).toEqual(["label"]);
        expect(Reflect.get(probe, "label")).toBeNull();
    });
});

describe("nullish handed to the constructor", () => {
    it("takes null for a property whose GValue holds it", () => {
        const Probe = makeProbeClass();

        for (const entry of HOLDING_NULL) {
            expect(Reflect.get(new Probe({ [entry.name]: null }), entry.name)).toEqual(entry.constructed);
        }
    });

    it("takes undefined as the property not being given", () => {
        const given: NamedCase[] = [...REFUSING, ...HOLDING_NULL];
        const Probe = makeProbeClass();
        const probe = new Probe(Object.fromEntries(given.map((entry) => [entry.name, undefined])));

        for (const entry of given) {
            expect(Reflect.get(probe, entry.name)).toEqual(entry.fallback);
        }
    });
});

describe("nullish written to a generated property of a wrapped type", () => {
    it("marshals null through the descriptor where an installed property refuses it", () => {
        const label = new Gtk.Label();
        label.widthRequest = 40;
        Reflect.set(label, "widthRequest", null);
        expect(label.widthRequest).toBe(0);
        expect(new Gtk.Label({ widthRequest: null }).widthRequest).toBe(0);
    });
});
