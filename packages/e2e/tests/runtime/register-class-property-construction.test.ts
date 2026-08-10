import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    Object as GObject,
    ParamFlags,
    paramSpecDouble,
    paramSpecEnum,
    paramSpecInt,
    paramSpecObject,
    paramSpecString,
    typeFromName,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, resolveType } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

type ErrorClass = new (...args: never[]) => Error;

const uniqueName = createTypeNameFactory("_");
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");

const probeProperties = (): Record<string, ParamSpec> => ({
    stamp: paramSpecString("stamp", null, null, "", ParamFlags.READWRITE | ParamFlags.CONSTRUCT_ONLY),
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    seeded: paramSpecInt("seeded", null, null, 0, 255, 0, ParamFlags.READWRITE | ParamFlags.CONSTRUCT),
    ratio: paramSpecDouble("ratio", null, null, 0, 1, 0, ParamFlags.READWRITE),
    frozen: paramSpecInt("frozen", null, null, 0, 255, 7, ParamFlags.READABLE),
    orientation: paramSpecEnum(
        "orientation",
        null,
        null,
        orientationType,
        Gtk.Orientation.HORIZONTAL,
        ParamFlags.READWRITE,
    ),
    child: paramSpecObject("child", null, null, typeFromName("GtkLabel"), ParamFlags.READWRITE),
});

const makeProbeClass = () => {
    class Probe extends GObject {
        declare stamp: string;

        declare red: number;

        declare seeded: number;

        declare ratio: number;

        declare frozen: number;

        declare orientation: number;

        declare child: Gtk.Widget | null;
    }

    registerClass(Probe, { typeName: uniqueName("GtkxConstructChecks"), properties: probeProperties() });

    return Probe;
};

function expectConstructRefusal(props: object, error: ErrorClass, reason: RegExp): void {
    const Probe = makeProbeClass();
    expect(() => new Probe(props)).toThrow(error);
    expect(() => new Probe(props)).toThrow(reason);
}

describe("registerClass — values handed to the constructor", () => {
    it("refuses an int the ParamSpec's range excludes", () => {
        expectConstructRefusal(
            { red: 9999 },
            RangeError,
            /'red' to 9999.+out of range for type 'gint'.+would put 255 in its place/,
        );
    });

    it("refuses a double the ParamSpec's range excludes", () => {
        expectConstructRefusal({ ratio: 5 }, RangeError, /'ratio' to 5.+out of range for type 'gdouble'/);
    });

    it("refuses an enum value the type has no member for", () => {
        expectConstructRefusal(
            { orientation: 99 },
            RangeError,
            /'orientation' to 99.+out of range for type 'GtkOrientation'/,
        );
    });

    it("refuses a value the CONSTRUCT ParamSpec's range excludes", () => {
        expectConstructRefusal({ seeded: 9999 }, RangeError, /'seeded' to 9999.+out of range for type 'gint'/);
    });

    it("refuses a property the ParamSpec marks read-only", () => {
        expectConstructRefusal({ frozen: 3 }, TypeError, /'frozen' to 3; the property is read-only/);
    });

    it("refuses an object of a type the property does not hold", () => {
        const Probe = makeProbeClass();

        expect(() => new Probe({ child: new Gtk.Button() })).toThrow(
            /'child' to Button; the property holds values of type 'GtkLabel'/,
        );
    });

    it("names the property under the key the caller wrote it as", () => {
        const Probe = makeProbeClass();
        expect(() => new Probe({ orientation: 99 })).toThrow(/Probe\.orientation: cannot set property/);
    });
});

describe("registerClass — values the constructor accepts", () => {
    it("takes every value the ParamSpecs accept", () => {
        const Probe = makeProbeClass();
        const label = new Gtk.Label();

        const probe = new Probe({
            stamp: "at-construction",
            red: 255,
            seeded: 12,
            ratio: 1,
            orientation: Gtk.Orientation.VERTICAL,
            child: label,
        });

        expect(probe.stamp).toBe("at-construction");
        expect(probe.red).toBe(255);
        expect(probe.seeded).toBe(12);
        expect(probe.ratio).toBe(1);
        expect(probe.orientation).toBe(Gtk.Orientation.VERTICAL);
        expect(probe.child).toBe(label);
    });

    it("leaves a name the type installs no property under alone", () => {
        const Probe = makeProbeClass();
        expect(new Probe({ green: 7 }).red).toBe(0);
    });

    it("still takes a CONSTRUCT property after construction", () => {
        const Probe = makeProbeClass();
        const probe = new Probe({ seeded: 3 });
        probe.seeded = 4;
        expect(probe.seeded).toBe(4);
    });
});
