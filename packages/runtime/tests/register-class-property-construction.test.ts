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
import { createTypeNameFactory } from "./helpers/unique-name.js";

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

describe("registerClass — values handed to the constructor", () => {
    it("refuses every value its ParamSpec rejects", () => {
        const Probe = makeProbeClass();
        const refusals = [
            { red: 9999 },
            { ratio: 5 },
            { orientation: 99 },
            { seeded: 9999 },
            { frozen: 3 },
            { child: new Gtk.Button() },
        ];

        for (const props of refusals) {
            expect(() => new Probe(props)).toThrow();
        }
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
