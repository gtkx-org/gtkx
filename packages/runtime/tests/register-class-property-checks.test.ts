import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    Object as GObject,
    ParamFlags,
    paramSpecBoolean,
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
import { watchNotify } from "./helpers/gobject.js";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");

const sortedNames = (names: string[]): string[] => names.toSorted((left, right) => left.localeCompare(right));

const probeProperties = (): Record<string, ParamSpec> => ({
    stamp: paramSpecString("stamp", null, null, "", ParamFlags.READWRITE | ParamFlags.CONSTRUCT_ONLY),
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    ratio: paramSpecDouble("ratio", null, null, 0, 1, 0, ParamFlags.READWRITE),
    frozen: paramSpecInt("frozen", null, null, 0, 255, 7, ParamFlags.READABLE),
    lax: paramSpecInt("lax", null, null, 0, 10, 0, ParamFlags.READWRITE | ParamFlags.LAX_VALIDATION),
    label: paramSpecString("label", null, null, "", ParamFlags.READWRITE),
    enabled: paramSpecBoolean("enabled", null, null, false, ParamFlags.READWRITE),
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

        declare ratio: number;

        declare frozen: number;

        declare lax: number;

        declare label: string;

        declare enabled: boolean;

        declare orientation: number;

        declare child: Gtk.Widget | null;
    }

    registerClass(Probe, { typeName: uniqueName("GtkxPropertyChecks"), properties: probeProperties() });

    return Probe;
};

describe("registerClass — accepted property values", () => {
    it("round-trips a string, int, boolean, enum and object property", () => {
        const Probe = makeProbeClass();
        const probe = new Probe({ stamp: "at-construction" });
        const label = new Gtk.Label();
        probe.label = "crimson";
        probe.red = 12;
        probe.enabled = true;
        probe.orientation = Gtk.Orientation.VERTICAL;
        probe.child = label;
        probe.lax = 99;
        expect(probe.stamp).toBe("at-construction");
        expect(probe.label).toBe("crimson");
        expect(probe.red).toBe(12);
        expect(probe.enabled).toBe(true);
        expect(probe.orientation).toBe(Gtk.Orientation.VERTICAL);
        expect(probe.child).toBe(label);
        expect(probe.lax).toBe(99);
    });
});

describe("registerClass — notifications for checked writes", () => {
    it("emits notify once per accepted write, and none for an unchanged or refused one", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        const seen = watchNotify(probe);
        probe.red = 3;
        probe.red = 3;

        expect(() => {
            probe.red = 9999;
        }).toThrow();

        probe.label = "teal";
        expect(seen).toEqual(["red", "label"]);
    });

    it("collapses repeated writes of the same nullish value into one notify", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        const seen = watchNotify(probe);
        Reflect.set(probe, "label", null);
        Reflect.set(probe, "label", null);
        Reflect.set(probe, "label", null);
        expect(seen).toEqual(["label"]);
        expect(probe.label).toBeNull();
    });

    it("batches notifications between freeze_notify and thaw_notify", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        const seen = watchNotify(probe);
        probe.freezeNotify();
        probe.red = 1;
        probe.red = 2;
        probe.label = "teal";

        expect(() => {
            probe.red = 9999;
        }).toThrow();

        expect(seen).toEqual([]);
        probe.thawNotify();
        expect(sortedNames(seen)).toEqual(["label", "red"]);
        expect(probe.red).toBe(2);
    });
});

describe("registerClass — refused writes and GLib criticals", () => {
    it("emits no GLib critical for any write GObject would have refused", () => {
        const Probe = makeProbeClass();
        const probe = new Probe({ stamp: "at-construction" });

        const refusals = [
            () => {
                probe.stamp = "later";
            },
            () => {
                probe.red = 9999;
            },
            () => {
                probe.red = -1;
            },
            () => {
                probe.red = 1.7;
            },
            () => {
                Reflect.set(probe, "red", "abc");
            },
            () => {
                probe.ratio = 5;
            },
            () => {
                probe.ratio = NaN;
            },
            () => {
                probe.frozen = 3;
            },
            () => {
                probe.child = new Gtk.Button();
            },
            () => {
                probe.orientation = 99;
            },
            () => {
                Reflect.set(probe, "label", 42);
            },
            () => {
                Reflect.set(probe, "enabled", "yes");
            },
            () => {
                Reflect.set(probe, "orientation", "vertical");
            },
        ];

        for (const refusal of refusals) {
            expect(refusal).toThrow();
        }

        expect(probe.stamp).toBe("at-construction");
        expect(probe.red).toBe(0);
        expect(probe.ratio).toBe(0);
        expect(probe.frozen).toBe(7);
        expect(probe.child).toBeNull();
        expect(probe.label).toBe("");
        expect(probe.enabled).toBe(false);
        expect(probe.orientation).toBe(Gtk.Orientation.HORIZONTAL);
    });
});
