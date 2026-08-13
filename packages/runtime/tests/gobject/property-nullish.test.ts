import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    BindingFlags,
    Object as GObject,
    ParamFlags,
    paramSpecBoolean,
    paramSpecBoxed,
    paramSpecChar,
    paramSpecDouble,
    paramSpecEnum,
    paramSpecFlags,
    paramSpecFloat,
    paramSpecGtype,
    paramSpecInt,
    paramSpecInt64,
    paramSpecLong,
    paramSpecObject,
    paramSpecPointer,
    paramSpecString,
    paramSpecUchar,
    paramSpecUint,
    paramSpecUint64,
    paramSpecUlong,
    TYPE_OBJECT,
    typeFromName,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass, resolveType, TYPE_LONG } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

type NullishCase = { name: string; type: string; written: unknown; fallback: unknown };
type RefusedCase = NullishCase & { refused: unknown; described: string };

const buttonType = getClassType(Gtk.Button);
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");
const stateFlagsType = resolveType("libgtk-4.so.1", "gtk_state_flags_get_type");
const names = { next: 0 };
const intType = typeFromName("gint");
const strvType = typeFromName("GStrv");

const REFUSING: NullishCase[] = [
    { name: "bias", type: "gchar", written: -4, fallback: 0 },
    { name: "shade", type: "guchar", written: 200, fallback: 0 },
    { name: "red", type: "gint", written: 120, fallback: 0 },
    { name: "count", type: "guint", written: 12, fallback: 0 },
    { name: "ticks", type: "glong", written: 40n, fallback: 0n },
    { name: "span", type: "gulong", written: 41n, fallback: 0n },
    { name: "depth", type: "gint64", written: 42n, fallback: 0n },
    { name: "width", type: "guint64", written: 43n, fallback: 0n },
    { name: "gain", type: "gfloat", written: 0.5, fallback: 0 },
    { name: "ratio", type: "gdouble", written: 0.25, fallback: 0 },
    {
        name: "orientation",
        type: "GtkOrientation",
        written: Gtk.Orientation.VERTICAL,
        fallback: Gtk.Orientation.HORIZONTAL,
    },
    { name: "state", type: "GtkStateFlags", written: Gtk.StateFlags.ACTIVE, fallback: Gtk.StateFlags.NORMAL },
    { name: "kind", type: "GType", written: buttonType, fallback: TYPE_OBJECT },
    { name: "enabled", type: "gboolean", written: true, fallback: false },
];

const NULLISH = [
    { refused: null, described: "null" },
    { refused: undefined, described: "undefined" },
];

const REFUSED: RefusedCase[] = REFUSING.flatMap((entry) => NULLISH.map((nullish) => ({ ...entry, ...nullish })));
const HOLDING_NULL = ["label", "tags", "child", "target"];
const SERVING_NULL_BACK = ["label", "child", "target"];

const uniqueName = (prefix: string): string => {
    names.next += 1;

    return `${prefix}_${String(process.pid)}_${String(names.next)}`;
};

const refusalFor = (entry: NullishCase, written: string): RegExp =>
    new RegExp(
        String.raw`^Probe\.${entry.name}: cannot set property '${entry.name}' to ${written}; ` +
        `the property holds values of type '${entry.type}'$`,
    );

const valueOfType = (type: bigint): Value => {
    const value = new Value();
    value.init(type);

    return value;
};

const probeProperties = (): Record<string, ParamSpec> => ({
    bias: paramSpecChar("bias", null, null, -10, 10, 0, ParamFlags.READWRITE),
    shade: paramSpecUchar("shade", null, null, 0, 200, 0, ParamFlags.READWRITE),
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    count: paramSpecUint("count", null, null, 0, 255, 0, ParamFlags.READWRITE),
    ticks: paramSpecLong("ticks", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
    span: paramSpecUlong("span", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
    depth: paramSpecInt64("depth", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
    width: paramSpecUint64("width", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
    gain: paramSpecFloat("gain", null, null, 0, 1, 0, ParamFlags.READWRITE),
    ratio: paramSpecDouble("ratio", null, null, 0, 1, 0, ParamFlags.READWRITE),
    orientation: paramSpecEnum(
        "orientation",
        null,
        null,
        orientationType,
        Gtk.Orientation.HORIZONTAL,
        ParamFlags.READWRITE,
    ),
    state: paramSpecFlags("state", null, null, stateFlagsType, Gtk.StateFlags.NORMAL, ParamFlags.READWRITE),
    kind: paramSpecGtype("kind", null, null, TYPE_OBJECT, ParamFlags.READWRITE),
    enabled: paramSpecBoolean("enabled", null, null, false, ParamFlags.READWRITE),
    label: paramSpecString("label", null, null, "", ParamFlags.READWRITE),
    tags: paramSpecBoxed("tags", null, null, strvType, ParamFlags.READWRITE),
    child: paramSpecObject("child", null, null, typeFromName("GtkLabel"), ParamFlags.READWRITE),
    target: paramSpecPointer("target", null, null, ParamFlags.READWRITE),
});

const makeProbeClass = () => {
    class Probe extends GObject {}
    registerClass(Probe, { typeName: uniqueName("GtkxNullishProbe"), properties: probeProperties() });

    return Probe;
};

const makeServingClass = (served: unknown) => {
    class Serving extends GObject {
        get red(): number {
            return served as number;
        }

        set red(_value: number) {
            return;
        }
    }

    registerClass(Serving, {
        typeName: uniqueName("GtkxNullishServing"),
        properties: { red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE) },
    });

    return Serving;
};

describe("registerClass — nullish written to a property whose GValue holds no NULL", () => {
    it.each(REFUSED)("refuses $described written to $name and leaves the $type in place", (entry) => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        Reflect.set(probe, entry.name, entry.written);

        expect(() => {
            Reflect.set(probe, entry.name, entry.refused);
        }).toThrow(refusalFor(entry, entry.described));

        expect(Reflect.get(probe, entry.name)).toBe(entry.written);
    });

    it.each(REFUSING)("refuses null handed to the constructor for $name", (entry) => {
        const Probe = makeProbeClass();
        expect(() => new Probe({ [entry.name]: null })).toThrow(refusalFor(entry, "null"));
    });

    it("takes undefined at construction as the property not being given", () => {
        const Probe = makeProbeClass();
        const probe = new Probe(Object.fromEntries(REFUSING.map((entry) => [entry.name, undefined])));

        for (const entry of REFUSING) {
            expect(Reflect.get(probe, entry.name)).toBe(entry.fallback);
        }
    });
});

describe("registerClass — nullish written to a property whose GValue holds NULL", () => {
    it.each(HOLDING_NULL)("takes null written to %s", (name) => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        Reflect.set(probe, name, null);
        expect(Reflect.get(probe, name)).toBeNull();
    });

    it.each(SERVING_NULL_BACK)("takes null handed to the constructor for %s", (name) => {
        const Probe = makeProbeClass();
        expect(Reflect.get(new Probe({ [name]: null }), name)).toBeNull();
    });

    it("takes null handed to the constructor for a string array, which GObject serves back empty", () => {
        const Probe = makeProbeClass();
        expect(Reflect.get(new Probe({ tags: null }), "tags")).toEqual([]);
    });
});

describe("registerClass — what the property slots serve once a nullish write is refused", () => {
    it("serves the number an int property was written with through a binding", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        Reflect.set(probe, "red", 120);

        expect(() => {
            Reflect.set(probe, "red", null);
        }).toThrow(TypeError);

        const label = new Gtk.Label();
        probe.bindProperty("red", label, "width-request", BindingFlags.SYNC_CREATE);
        expect(label.widthRequest).toBe(120);
        expect(Reflect.get(probe, "red")).toBe(120);
    });

    it("serves the bigint a long property was written with through g_object_get_property", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        Reflect.set(probe, "ticks", 40n);

        expect(() => {
            Reflect.set(probe, "ticks", undefined);
        }).toThrow(TypeError);

        const read = valueOfType(TYPE_LONG);
        probe.getProperty("ticks", read);
        expect(read.getLong()).toBe(40n);
    });

    it("refuses to serve an int property from the null a class of its own hands back", () => {
        const Serving = makeServingClass(null);
        const serving = new Serving();

        expect(() => {
            serving.getProperty("red", valueOfType(intType));
        }).toThrow(/cannot serve property 'red' from null; the property holds values of type 'gint'/);
    });
});
