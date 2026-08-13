import type { ParamSpec } from "@gtkx/gi/gobject";
import {
    Object as GObject,
    ParamFlags,
    paramSpecBoxed,
    paramSpecChar,
    paramSpecInt,
    paramSpecLong,
    paramSpecObject,
    paramSpecUchar,
    paramSpecUlong,
    TYPE_INT,
    typeFromName,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
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

const ownedProperties = (): Record<string, ParamSpec> =>
    Object.fromEntries([["dew-point", paramSpecInt("dew-point", null, null, 0, 255, 0, ParamFlags.READWRITE)]]);

const makeOwningClass = (writes: number[]) => {
    class Owner extends GObject {
        #level = 0;

        get dewPoint(): number {
            return this.#level;
        }

        set dewPoint(value: number) {
            writes.push(value);
            this.#level = value;
        }
    }

    registerClass(Owner, {
        typeName: uniqueName("GtkxOwnedProp"),
        properties: ownedProperties(),
    });

    return Owner;
};

const makeFieldedClass = () => {
    class Fielded extends GObject {
        red = 5;
    }

    registerClass(Fielded, {
        typeName: uniqueName("GtkxFieldedProp"),
        properties: { red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE) },
    });

    return Fielded;
};

const makeMismatchedClass = () => {
    class Mismatched extends GObject {
        get childWidget(): Gtk.Widget {
            return new Gtk.Button();
        }

        set childWidget(_value: Gtk.Widget) {
            return;
        }
    }

    registerClass(Mismatched, {
        typeName: uniqueName("GtkxMismatchedProp"),
        properties: {
            "child-widget": paramSpecObject("child-widget", null, null, typeFromName("GtkLabel"), ParamFlags.READWRITE),
        },
    });

    return Mismatched;
};

const widthProperties = (): Record<string, ParamSpec> => ({
    bias: paramSpecChar("bias", null, null, -10, 10, 0, ParamFlags.READWRITE),
    shade: paramSpecUchar("shade", null, null, 0, 200, 0, ParamFlags.READWRITE),
    ticks: paramSpecLong("ticks", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
    span: paramSpecUlong("span", null, null, 0n, 100n, 0n, ParamFlags.READWRITE),
});

const makeWidthsClass = () => {
    class Widths extends GObject {
        declare bias: number;

        declare shade: number;

        declare ticks: bigint;

        declare span: bigint;
    }

    registerClass(Widths, { typeName: uniqueName("GtkxWidthProps"), properties: widthProperties() });

    return Widths;
};

const makeTagsClass = () => {
    class Tags extends GObject {
        declare tags: string[] | null;
    }

    registerClass(Tags, {
        typeName: uniqueName("GtkxIdentityStrv"),
        properties: { tags: paramSpecBoxed("tags", null, null, typeFromName("GStrv"), ParamFlags.READWRITE) },
    });

    return Tags;
};

describe("registerClass — a class that owns the member itself", () => {
    it("forwards every other spelling to the member rather than to storage of its own", () => {
        const writes: number[] = [];
        const Owner = makeOwningClass(writes);
        const owner = new Owner();
        Reflect.set(owner, "dew_point", 5);
        expect(Reflect.get(owner, "dew_point")).toBe(5);
        Reflect.set(owner, "dew_point", 0);
        expect(owner.dewPoint).toBe(0);
        expect(writes).toEqual([5, 0]);
    });

    it("reads and writes the member from the type's property slots", () => {
        const writes: number[] = [];
        const Owner = makeOwningClass(writes);
        const owner = new Owner();
        owner.setProperty("dew-point", intValue(9));
        expect(owner.dewPoint).toBe(9);
        expect(readInt(owner, "dew-point")).toBe(9);
        expect(writes).toEqual([9]);
    });
});

describe("registerClass — a class field of the property's name", () => {
    it("serves and takes the field the instance carries rather than the generated storage", () => {
        const Fielded = makeFieldedClass();
        const fielded = new Fielded();
        expect(readInt(fielded, "red")).toBe(5);
        fielded.setProperty("red", intValue(3));
        expect(Reflect.get(fielded, "red")).toBe(3);
        expect(readInt(fielded, "red")).toBe(3);
    });
});

describe("registerClass — a member of a type the ParamSpec does not hold", () => {
    it("refuses to serve the property instead of letting GObject reject the value", () => {
        const Mismatched = makeMismatchedClass();
        const instance = new Mismatched();
        const value = new Value();
        value.init(typeFromName("GtkLabel"));

        expect(() => {
            instance.getProperty("child-widget", value);
        }).toThrow(/cannot serve property 'child-widget' from Button; the property holds values of type 'GtkLabel'/);
    });
});

describe("registerClass — properties the narrower integer types back", () => {
    it("round-trips a char, uchar, long and ulong property", () => {
        const Widths = makeWidthsClass();
        const widths = new Widths();
        widths.bias = -4;
        widths.shade = 200;
        widths.ticks = 42n;
        widths.span = 7n;
        expect(widths.bias).toBe(-4);
        expect(widths.shade).toBe(200);
        expect(widths.ticks).toBe(42n);
        expect(widths.span).toBe(7n);
    });

    it("serves each of them their ParamSpec default", () => {
        const Widths = makeWidthsClass();
        const widths = new Widths();
        expect(widths.bias).toBe(0);
        expect(widths.shade).toBe(0);
        expect(widths.ticks).toBe(0n);
        expect(widths.span).toBe(0n);
    });

    it("refuses a value outside each of their ranges", () => {
        const Widths = makeWidthsClass();
        const widths = new Widths();

        expect(() => {
            widths.bias = 99;
        }).toThrow(RangeError);

        expect(() => {
            widths.shade = 250;
        }).toThrow(RangeError);

        expect(() => {
            widths.ticks = 900n;
        }).toThrow(RangeError);

        expect(() => {
            widths.span = 900n;
        }).toThrow(RangeError);

        expect(widths.bias).toBe(0);
        expect(widths.span).toBe(0n);
    });
});

describe("registerClass — the value a property serves back", () => {
    it("serves the very value that was written to a boxed property", () => {
        const Tags = makeTagsClass();
        const tags = new Tags();
        const written = ["alpha", "beta"];
        tags.tags = written;
        expect(tags.tags).toBe(written);
        expect(tags.tags).toBe(tags.tags);
    });

    it("serves the object a property was written with, not a wrapper of its own", () => {
        const Tags = makeTagsClass();
        const first = new Tags();
        const seen = watchNotify(first);
        first.tags = ["alpha"];
        first.tags = ["alpha"];
        expect(seen).toEqual(["tags", "tags"]);
    });
});
