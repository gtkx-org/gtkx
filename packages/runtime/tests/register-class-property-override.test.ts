import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    Object as GObject,
    ParamFlags,
    paramSpecInt,
    paramSpecOverride,
    TYPE_BOOLEAN,
    TYPE_INT,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getClassType, registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { watchNotify } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const intValue = (n: number): Value => {
    const value = new Value();
    value.init(TYPE_INT);
    value.setInt(n);

    return value;
};

const readInt = (instance: GObject, name: string): number => {
    const value = new Value();
    value.init(TYPE_INT);
    instance.getProperty(name, value);

    return value.getInt();
};

const isSet = (instance: GObject, name: string): boolean => {
    const value = new Value();
    value.init(TYPE_BOOLEAN);
    instance.getProperty(name, value);

    return value.getBoolean();
};

const levelSpec = (): ParamSpec => paramSpecInt("level", null, null, 0, 100, 7, ParamFlags.READWRITE);

const makeBareMeterClass = () => {
    class Meter extends GObject {}

    registerClass(Meter, {
        typeName: uniqueName("GtkxOverrideMeter"),
        properties: { level: levelSpec() },
    });

    return Meter;
};

const makeMeterClass = () => {
    class Meter extends GObject {
        declare level: number;
    }

    registerClass(Meter, {
        typeName: uniqueName("GtkxOverrideMeter"),
        properties: { level: levelSpec() },
    });

    return Meter;
};

const overrideLevel = (source: Parameters<typeof paramSpecOverride>[1]): Record<string, ParamSpec> => ({
    level: paramSpecOverride("level", source),
});

const makeGaugedMeterClass = (writes: number[]) => {
    const Meter = makeBareMeterClass();

    class GaugedMeter extends Meter {
        #stored = 0;

        get level(): number {
            return this.#stored;
        }

        set level(value: number) {
            writes.push(value);
            this.#stored = value;
        }
    }

    registerClass(GaugedMeter, {
        typeName: uniqueName("GtkxOverrideGaugedMeter"),
        properties: overrideLevel(Meter),
    });

    return GaugedMeter;
};

describe("registerClass — property overrides, happy path", () => {
    it("gives a subclass its own storage and notify for a parent class property", () => {
        const Meter = makeMeterClass();
        class LoudMeter extends Meter {}

        registerClass(LoudMeter, {
            typeName: uniqueName("GtkxOverrideLoudMeter"),
            properties: overrideLevel(Meter),
        });

        const meter = new LoudMeter();
        expect(meter.level).toBe(7);
        const seen = watchNotify(meter);
        meter.level = 42;
        expect(meter.level).toBe(42);
        expect(readInt(meter, "level")).toBe(42);
        expect(seen).toEqual(["level"]);
        meter.setProperty("level", intValue(9));
        expect(meter.level).toBe(9);
        expect(seen).toEqual(["level", "level"]);
    });

    it("overrides Gtk.Widget's visible property with working get, set and notify", () => {
        class Blinker extends Gtk.Widget {}

        registerClass(Blinker, {
            typeName: uniqueName("GtkxOverrideBlinker"),
            properties: { visible: paramSpecOverride("visible", Gtk.Widget) },
        });

        const blinker = new Blinker();
        expect(blinker.visible).toBe(true);
        const seen = watchNotify(blinker);
        blinker.visible = false;
        expect(blinker.visible).toBe(false);
        expect(isSet(blinker, "visible")).toBe(false);
        expect(seen).toEqual(["visible"]);
    });
});

describe("registerClass — property overrides, edge cases", () => {
    it("overrides an interface property the class explicitly redeclares", () => {
        class Rail extends GObject {}

        registerClass(Rail, {
            typeName: uniqueName("GtkxOverrideRail"),
            implements: [Gtk.Orientable],
            properties: { orientation: paramSpecOverride("orientation", Gtk.Orientable) },
        });

        const rail = new Rail() as GObject & Gtk.Orientable;
        expect(rail.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        const seen = watchNotify(rail);
        rail.setOrientation(Gtk.Orientation.VERTICAL);
        expect(rail.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(rail.orientation).toBe(Gtk.Orientation.VERTICAL);
        expect(seen).toEqual(["orientation"]);
    });

    it("accepts the source as a raw GType", () => {
        const Meter = makeMeterClass();
        class TypedMeter extends Meter {}

        registerClass(TypedMeter, {
            typeName: uniqueName("GtkxOverrideTypedMeter"),
            properties: overrideLevel(getClassType(Meter)),
        });

        const meter = new TypedMeter();
        expect(meter.level).toBe(7);
        meter.level = 3;
        expect(readInt(meter, "level")).toBe(3);
    });

    it("routes an overridden property through the accessor the subclass declares", () => {
        const writes: number[] = [];
        const GaugedMeter = makeGaugedMeterClass(writes);
        const meter = new GaugedMeter();
        meter.setProperty("level", intValue(21));
        expect(writes).toEqual([21]);
        expect(readInt(meter, "level")).toBe(21);
    });
});

describe("registerClass — property overrides, error paths", () => {
    it("throws for a property name the source class does not declare", () => {
        const Meter = makeMeterClass();
        expect(() => paramSpecOverride("no-such-property", Meter)).toThrow();
    });

    it("throws for a property name the source interface does not declare", () => {
        expect(() => paramSpecOverride("no-such-property", Gtk.Orientable)).toThrow();
    });

    it("throws for a source that is not a registered class or interface", () => {
        class Plain {
            level = 0;
        }

        expect(() => paramSpecOverride("level", Plain)).toThrow();
    });
});
