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
    TYPE_STRING,
    typeFromName,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass, resolveType, TYPE_LONG } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

type NullishCase = { name: string; type: string; written: unknown; fallback: unknown };
type RefusedCase = NullishCase & { refused: unknown; described: string };
type HoldingCase = { name: string; hold: () => unknown; fallback: unknown; constructed: unknown };
type ErrorClass = new (...args: never[]) => Error;

const buttonType = getClassType(Gtk.Button);
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");
const stateFlagsType = resolveType("libgtk-4.so.1", "gtk_state_flags_get_type");
const names = { next: 0 };
const intType = typeFromName("gint");
const strvType = typeFromName("GStrv");
const objectType = typeFromName("GtkLabel");
const NARROW: NullishCase = { name: "level", type: "gint", written: 15, fallback: 10 };
const RED: NullishCase = { name: "red", type: "gint", written: 120, fallback: 0 };
const TICKS: NullishCase = { name: "ticks", type: "glong", written: 40n, fallback: 0n };

const REFUSING: NullishCase[] = [
    { name: "bias", type: "gchar", written: -4, fallback: 0 },
    { name: "shade", type: "guchar", written: 200, fallback: 0 },
    RED,
    NARROW,
    { name: "count", type: "guint", written: 12, fallback: 0 },
    TICKS,
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

const HOLDING_NULL: HoldingCase[] = [
    { name: "label", hold: (): unknown => "teal", fallback: "", constructed: null },
    { name: "tags", hold: (): unknown => ["one", "two"], fallback: [], constructed: [] },
    { name: "child", hold: (): unknown => new Gtk.Label(), fallback: null, constructed: null },
    { name: "target", hold: (): unknown => null, fallback: null, constructed: null },
];

const SERVED_BACK = [
    {
        name: "label",
        hold: (): unknown => "teal",
        type: TYPE_STRING,
        served: (value: Value): unknown => value.getString(),
    },
    {
        name: "child",
        hold: (): unknown => new Gtk.Label(),
        type: objectType,
        served: (value: Value): unknown => value.getObject(),
    },
];

const NOT_GIVEN: { name: string; fallback: unknown }[] = [...REFUSING, ...HOLDING_NULL];

const uniqueName = (prefix: string): string => {
    names.next += 1;

    return `${prefix}_${String(process.pid)}_${String(names.next)}`;
};

const refusalFor = (entry: NullishCase, written: string): RegExp =>
    new RegExp(
        String.raw`^Probe\.${entry.name}: cannot set property '${entry.name}' to ${written}; ` +
        `the property holds values of type '${entry.type}'$`,
    );

const thrownBy = (write: () => unknown): unknown => {
    try {
        write();
    } catch (error) {
        return error;
    }

    return undefined;
};

const expectThrown = (write: () => unknown, kind: ErrorClass, message: RegExp): void => {
    const thrown = thrownBy(write);
    expect(thrown).toBeInstanceOf(kind);
    expect((thrown as Error).message).toMatch(message);
};

const valueOfType = (type: bigint): Value => {
    const value = new Value();
    value.init(type);

    return value;
};

const notifiedNames = (instance: GObject): string[] => {
    const seen: string[] = [];

    instance.on("notify", (...args: unknown[]) => {
        const [pspec] = args as [ParamSpec];
        seen.push(pspec.getName());
    });

    return seen;
};

const probeProperties = (): Record<string, ParamSpec> => ({
    bias: paramSpecChar("bias", null, null, -10, 10, 0, ParamFlags.READWRITE),
    shade: paramSpecUchar("shade", null, null, 0, 200, 0, ParamFlags.READWRITE),
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    level: paramSpecInt("level", null, null, 10, 20, 10, ParamFlags.READWRITE),
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
    child: paramSpecObject("child", null, null, objectType, ParamFlags.READWRITE),
    target: paramSpecPointer("target", null, null, ParamFlags.READWRITE),
});

const makeProbeClass = () => {
    class Probe extends GObject {}
    registerClass(Probe, { typeName: uniqueName("GtkxNullishProbe"), properties: probeProperties() });

    return Probe;
};

const newProbe = (): GObject => new (makeProbeClass())();

const probeHolding = (name: string, value: unknown): GObject => {
    const probe = newProbe();
    Reflect.set(probe, name, value);

    return probe;
};

const probeCleared = (name: string, held: unknown): GObject => {
    const probe = probeHolding(name, held);
    Reflect.set(probe, name, undefined);

    return probe;
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

describe("nullish written to a property whose GValue holds no NULL", () => {
    it.each(REFUSED)("refuses $described written to $name and leaves the $type in place", (entry) => {
        const probe = probeHolding(entry.name, entry.written);

        expectThrown(
            () => {
                Reflect.set(probe, entry.name, entry.refused);
            },
            TypeError,
            refusalFor(entry, entry.described),
        );

        expect(Reflect.get(probe, entry.name)).toBe(entry.written);
    });

    it.each(REFUSING)("refuses null handed to the constructor for $name", (entry) => {
        const Probe = makeProbeClass();
        expectThrown(() => new Probe({ [entry.name]: null }), TypeError, refusalFor(entry, "null"));
    });

    it("emits no notify for a refused write", () => {
        const probe = probeHolding(RED.name, RED.written);
        const seen = notifiedNames(probe);

        for (const nullish of NULLISH) {
            expectThrown(
                () => {
                    Reflect.set(probe, "red", nullish.refused);
                },
                TypeError,
                refusalFor(RED, nullish.described),
            );
        }

        expect(seen).toEqual([]);
    });
});

describe("nullish written to an int whose range excludes zero", () => {
    const refusals = [
        {
            described: "null",
            because: "for what the property holds",
            written: null,
            kind: TypeError,
            message: refusalFor(NARROW, "null"),
        },
        {
            described: "undefined",
            because: "for what the property holds",
            written: undefined,
            kind: TypeError,
            message: refusalFor(NARROW, "undefined"),
        },
        {
            described: "the number 5",
            because: "for the range",
            written: 5,
            kind: RangeError,
            message: /cannot set property 'level' to 5; the value is invalid or out of range for type 'gint'/,
        },
    ];

    it.each(refusals)("refuses $described $because", (entry) => {
        const probe = probeHolding(NARROW.name, NARROW.written);

        expectThrown(
            () => {
                Reflect.set(probe, NARROW.name, entry.written);
            },
            entry.kind,
            entry.message,
        );

        expect(Reflect.get(probe, NARROW.name)).toBe(NARROW.written);
    });
});

describe("nullish written to a property whose GValue holds NULL", () => {
    it.each(HOLDING_NULL)("takes null written to $name", (entry) => {
        const probe = probeHolding(entry.name, null);
        expect(Reflect.get(probe, entry.name)).toBeNull();
    });

    it.each(HOLDING_NULL)("holds the NULL it writes for undefined written to $name", (entry) => {
        const probe = probeCleared(entry.name, entry.hold());
        expect(Reflect.get(probe, entry.name)).toBeNull();
    });

    it.each(SERVED_BACK)("serves the NULL $name was cleared with rather than the undefined it took", (entry) => {
        const probe = probeCleared(entry.name, entry.hold());
        const read = valueOfType(entry.type);
        probe.getProperty(entry.name, read);
        expect(entry.served(read)).toBeNull();
        expect(Reflect.get(probe, entry.name)).toBeNull();
    });

    it("collapses null and undefined written in a row into one notify", () => {
        const probe = newProbe();
        const seen = notifiedNames(probe);
        Reflect.set(probe, "label", null);
        Reflect.set(probe, "label", undefined);
        Reflect.set(probe, "label", null);
        expect(seen).toEqual(["label"]);
        expect(Reflect.get(probe, "label")).toBeNull();
    });
});

describe("nullish handed to the constructor", () => {
    it.each(HOLDING_NULL)("takes null handed to the constructor for $name", (entry) => {
        const Probe = makeProbeClass();
        expect(Reflect.get(new Probe({ [entry.name]: null }), entry.name)).toEqual(entry.constructed);
    });

    it("takes undefined at construction as the property not being given", () => {
        const Probe = makeProbeClass();
        const probe = new Probe(Object.fromEntries(NOT_GIVEN.map((entry) => [entry.name, undefined])));

        for (const entry of NOT_GIVEN) {
            expect(Reflect.get(probe, entry.name)).toEqual(entry.fallback);
        }
    });
});

describe("what the property slots serve once a nullish write is refused", () => {
    it("serves the number an int property was written with through a binding", () => {
        const probe = probeHolding(RED.name, RED.written);

        expectThrown(
            () => {
                Reflect.set(probe, RED.name, null);
            },
            TypeError,
            refusalFor(RED, "null"),
        );

        const label = new Gtk.Label();
        probe.bindProperty(RED.name, label, "width-request", BindingFlags.SYNC_CREATE);
        expect(label.widthRequest).toBe(RED.written);
        expect(Reflect.get(probe, RED.name)).toBe(RED.written);
    });

    it("serves the bigint a long property was written with through g_object_get_property", () => {
        const probe = probeHolding(TICKS.name, TICKS.written);

        expectThrown(
            () => {
                Reflect.set(probe, TICKS.name, undefined);
            },
            TypeError,
            refusalFor(TICKS, "undefined"),
        );

        const read = valueOfType(TYPE_LONG);
        probe.getProperty(TICKS.name, read);
        expect(read.getLong()).toBe(TICKS.written);
    });

    it("refuses to serve an int property from the null a class of its own hands back", () => {
        const Serving = makeServingClass(null);
        const serving = new Serving();

        expectThrown(
            () => {
                serving.getProperty("red", valueOfType(intType));
            },
            TypeError,
            /cannot serve property 'red' from null; the property holds values of type 'gint'/,
        );
    });
});

describe("nullish written to a generated property of a wrapped type", () => {
    it("marshals null through the descriptor where an installed property refuses it", () => {
        const label = new Gtk.Label();
        label.widthRequest = 40;
        Reflect.set(label, "widthRequest", null);
        expect(label.widthRequest).toBe(0);
        expect(new Gtk.Label({ widthRequest: null }).widthRequest).toBe(0);
        const probe = probeHolding(RED.name, RED.written);

        expect(
            thrownBy(() => {
                Reflect.set(probe, RED.name, null);
            }),
        ).toBeInstanceOf(TypeError);

        expect(Reflect.get(probe, RED.name)).toBe(RED.written);
    });
});
