import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    BindingFlags,
    Object as GObject,
    ParamFlags,
    paramSpecBoolean,
    paramSpecDouble,
    paramSpecEnum,
    paramSpecFloat,
    paramSpecInt,
    paramSpecObject,
    paramSpecString,
    typeFromName,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, resolveType } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";
import { watchNotify } from "./helpers.js";

type Probe = InstanceType<ReturnType<typeof makeProbeClass>>;
type ErrorClass = new (...args: never[]) => Error;

const uniqueName = createTypeNameFactory("_");
const orientationType = resolveType("libgtk-4.so.1", "gtk_orientation_get_type");

const sortedNames = (names: string[]): string[] => names.toSorted((left, right) => left.localeCompare(right));

const probeProperties = (): Record<string, ParamSpec> => ({
    stamp: paramSpecString("stamp", null, null, "", ParamFlags.READWRITE | ParamFlags.CONSTRUCT_ONLY),
    red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
    ratio: paramSpecDouble("ratio", null, null, 0, 1, 0, ParamFlags.READWRITE),
    span: paramSpecDouble("span", null, null, -Infinity, Infinity, Infinity, ParamFlags.READWRITE),
    reach: paramSpecFloat("reach", null, null, -Infinity, Infinity, Infinity, ParamFlags.READWRITE),
    gain: paramSpecFloat("gain", null, null, 0, 1, 0, ParamFlags.READWRITE),
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

        declare span: number;

        declare reach: number;

        declare gain: number;

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

function expectRefusal(write: (probe: Probe) => void, error: ErrorClass, reason: RegExp): Probe {
    const Probe = makeProbeClass();
    const probe = new Probe();

    expect(() => {
        write(probe);
    }).toThrow(error);

    expect(() => {
        write(probe);
    }).toThrow(reason);

    return probe;
}

describe("registerClass — construct-only properties", () => {
    it("takes a construct-only property at construction", () => {
        const Probe = makeProbeClass();
        expect(new Probe({ stamp: "at-construction" }).stamp).toBe("at-construction");
    });

    it("refuses a construct-only property after construction", () => {
        const Probe = makeProbeClass();
        const probe = new Probe({ stamp: "at-construction" });

        expect(() => {
            probe.stamp = "later";
        }).toThrow(/can only be set when the object is constructed/);

        expect(probe.stamp).toBe("at-construction");
    });
});

describe("registerClass — property ranges", () => {
    it("refuses an int above the ParamSpec's range", () => {
        const probe = expectRefusal(
            (target) => {
                target.red = 9999;
            },
            RangeError,
            /'red' to 9999.+out of range for type 'gint'.+would put 255 in its place/,
        );

        expect(probe.red).toBe(0);
    });

    it("refuses an int below the ParamSpec's range", () => {
        const probe = expectRefusal(
            (target) => {
                target.red = -1;
            },
            RangeError,
            /would put 0 in its place/,
        );

        expect(probe.red).toBe(0);
    });

    it("refuses a double outside the ParamSpec's range", () => {
        const probe = expectRefusal(
            (target) => {
                target.ratio = 5;
            },
            RangeError,
            /'ratio' to 5.+out of range for type 'gdouble'.+would put 1 in its place/,
        );

        expect(probe.ratio).toBe(0);
    });

    it("refuses a value the enum the ParamSpec names has no member for", () => {
        const probe = expectRefusal(
            (target) => {
                target.orientation = 99;
            },
            RangeError,
            /'orientation' to 99.+invalid or out of range for type 'GtkOrientation'/,
        );

        expect(probe.orientation).toBe(Gtk.Orientation.HORIZONTAL);
    });

    it("takes the value a laxly validated ParamSpec corrects rather than refusing it", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        probe.lax = 99;
        expect(probe.lax).toBe(99);
    });
});

describe("registerClass — properties whose ParamSpec range admits infinity", () => {
    it("writes the infinite default one instance serves onto another", () => {
        const Probe = makeProbeClass();
        const source = new Probe();
        const target = new Probe();
        target.span = 5;
        target.span = source.span;
        expect(source.span).toBe(Infinity);
        expect(target.span).toBe(Infinity);
    });

    it("takes the declared infinite default at construction and both infinities after it", () => {
        const Probe = makeProbeClass();
        expect(new Probe({ span: Infinity }).span).toBe(Infinity);
        const probe = new Probe();
        probe.span = -Infinity;
        expect(probe.span).toBe(-Infinity);
    });

    it("takes an infinite value on a float property whose range admits it", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        probe.reach = 5;
        probe.reach = Infinity;
        expect(probe.reach).toBe(Infinity);
        expect(new Probe({ reach: -Infinity }).reach).toBe(-Infinity);
    });

    it("refuses NaN even where the range admits every finite number", () => {
        const probe = expectRefusal(
            (target) => {
                target.span = NaN;
            },
            RangeError,
            /'span' to NaN.+invalid or out of range for type 'gdouble'/,
        );

        expect(probe.span).toBe(Infinity);
    });
});

describe("registerClass — floating-point property ranges", () => {
    it("refuses an infinity a bounded double's range excludes as out of range", () => {
        const probe = expectRefusal(
            (target) => {
                target.ratio = Infinity;
            },
            RangeError,
            /'ratio' to Infinity.+out of range for type 'gdouble'.+would put 1 in its place/,
        );

        expect(probe.ratio).toBe(0);
    });

    it("refuses a float a bounded ParamSpec's range excludes as out of range", () => {
        const probe = expectRefusal(
            (target) => {
                target.gain = 5;
            },
            RangeError,
            /'gain' to 5.+out of range for type 'gfloat'.+would put 1 in its place/,
        );

        expect(probe.gain).toBe(0);
    });

    it("refuses a finite magnitude no gfloat holds as a type mismatch", () => {
        const probe = expectRefusal(
            (target) => {
                target.gain = 1e300;
            },
            TypeError,
            /'gain' to 1e\+300; the property holds values of type 'gfloat'/,
        );

        expect(probe.gain).toBe(0);
    });
});

describe("registerClass — read-only properties", () => {
    it("refuses a write to a property the ParamSpec marks read-only", () => {
        const probe = expectRefusal(
            (target) => {
                target.frozen = 3;
            },
            TypeError,
            /the property is read-only/,
        );

        expect(probe.frozen).toBe(7);
    });
});

describe("registerClass — property types", () => {
    it("refuses an object of a type the property does not hold", () => {
        const probe = expectRefusal(
            (target) => {
                target.child = new Gtk.Button();
            },
            TypeError,
            /the property holds values of type 'GtkLabel'/,
        );

        expect(probe.child).toBeNull();
    });

    it("names the class and the property when a scalar is of the wrong type", () => {
        const probe = expectRefusal(
            (target) => {
                Reflect.set(target, "label", 42);
            },
            TypeError,
            /^Probe\.label: cannot set property 'label' to 42; the property holds values of type 'gchararray'$/,
        );

        expect(probe.label).toBe("");
    });

    it("refuses a fraction, a string and a NaN where the ParamSpec wants a number", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();

        expect(() => {
            probe.red = 1.7;
        }).toThrow(/'red' to 1.7; the property holds values of type 'gint'/);

        expect(() => {
            Reflect.set(probe, "red", "abc");
        }).toThrow(TypeError);

        expect(() => {
            probe.ratio = NaN;
        }).toThrow(/'ratio' to NaN.+invalid or out of range for type 'gdouble'.+would put NaN in its place/);

        expect(probe.red).toBe(0);
        expect(probe.ratio).toBe(0);
    });

    it("refuses a string where the ParamSpec wants a boolean or an enum", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();

        expect(() => {
            Reflect.set(probe, "enabled", "yes");
        }).toThrow(/'enabled' to "yes"; the property holds values of type 'gboolean'/);

        expect(() => {
            Reflect.set(probe, "orientation", "vertical");
        }).toThrow(/'orientation' to "vertical"; the property holds values of type 'GtkOrientation'/);

        expect(probe.enabled).toBe(false);
        expect(probe.orientation).toBe(Gtk.Orientation.HORIZONTAL);
    });
});

describe("registerClass — nullish property values", () => {
    it("refuses null and undefined where the ParamSpec wants a number", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        probe.red = 12;
        probe.ratio = 0.5;

        expect(() => {
            Reflect.set(probe, "red", null);
        }).toThrow(/'red' to null; the property holds values of type 'gint'/);

        expect(() => {
            Reflect.set(probe, "red", undefined);
        }).toThrow(/'red' to undefined; the property holds values of type 'gint'/);

        expect(() => {
            Reflect.set(probe, "ratio", null);
        }).toThrow(/'ratio' to null; the property holds values of type 'gdouble'/);

        expect(() => {
            Reflect.set(probe, "orientation", null);
        }).toThrow(/'orientation' to null; the property holds values of type 'GtkOrientation'/);

        expect(probe.red).toBe(12);
        expect(probe.ratio).toBe(0.5);
    });

    it("refuses null at construction as it refuses it after construction", () => {
        const Probe = makeProbeClass();

        expect(() => new Probe({ red: null })).toThrow(
            /Probe\.red: cannot set property 'red' to null; the property holds values of type 'gint'/,
        );
    });

    it("takes null where the ParamSpec's own type holds it", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        Reflect.set(probe, "label", null);
        probe.child = null;
        expect(probe.label).toBeNull();
        expect(probe.child).toBeNull();
    });
});

describe("registerClass — the value the property slots serve", () => {
    it("serves an int property the number it was written with rather than a refused nullish", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        const label = new Gtk.Label();
        probe.red = 120;

        expect(() => {
            Reflect.set(probe, "red", null);
        }).toThrow(TypeError);

        probe.bindProperty("red", label, "width-request", BindingFlags.SYNC_CREATE);
        expect(label.widthRequest).toBe(120);
        expect(probe.red).toBe(120);
    });
});

describe("registerClass — accepted property values", () => {
    it("round-trips a string, int, boolean, enum and object property", () => {
        const Probe = makeProbeClass();
        const probe = new Probe();
        const label = new Gtk.Label();
        probe.label = "crimson";
        probe.red = 12;
        probe.enabled = true;
        probe.orientation = Gtk.Orientation.VERTICAL;
        probe.child = label;
        expect(probe.label).toBe("crimson");
        expect(probe.red).toBe(12);
        expect(probe.enabled).toBe(true);
        expect(probe.orientation).toBe(Gtk.Orientation.VERTICAL);
        expect(probe.child).toBe(label);
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
        }).toThrow(RangeError);

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
        }).toThrow(RangeError);

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
                probe.ratio = 5;
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
        ];

        for (const refusal of refusals) {
            expect(refusal).toThrow(Error);
        }

        expect(probe.stamp).toBe("at-construction");
        expect(probe.red).toBe(0);
        expect(probe.ratio).toBe(0);
        expect(probe.frozen).toBe(7);
        expect(probe.child).toBeNull();
        expect(probe.orientation).toBe(Gtk.Orientation.HORIZONTAL);
    });
});
