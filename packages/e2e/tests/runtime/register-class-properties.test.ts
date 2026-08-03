import type { ParamSpec } from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import {
    Object as GObject,
    ParamFlags,
    paramSpecInt,
    paramSpecString,
    TYPE_INT,
    TYPE_OBJECT,
    TYPE_STRING,
    Value,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "../helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

const intValue = (n: number): Value => {
    const value = new Value();
    value.init(TYPE_INT);
    value.setInt(n);

    return value;
};

const stringValue = (text: string): Value => {
    const value = new Value();
    value.init(TYPE_STRING);
    value.setString(text);

    return value;
};

const intSpec = (name: string): ParamSpec => paramSpecInt(name, null, null, 0, 255, 0, ParamFlags.READWRITE);

const watchNotify = (instance: GObject): string[] => {
    const seen: string[] = [];

    instance.on("notify", (...args: unknown[]) => {
        const [pspec] = args as [ParamSpec];
        seen.push(pspec.getName());
    });

    return seen;
};

const makeTintClass = () => {
    class Tint extends GObject {
        declare tintLevel: number;
    }

    registerClass(Tint, {
        typeName: uniqueName("GtkxRenamedProp"),
        properties: { tintLevel: intSpec("tint-level") },
    });

    return Tint;
};

const makeSwatchClass = () => {
    class Swatch extends GObject {
        declare red: number;
        declare label: string;
    }

    registerClass(Swatch, {
        typeName: uniqueName("GtkxPropSwatch"),
        properties: {
            red: paramSpecInt("red", null, null, 0, 255, 0, ParamFlags.READWRITE),
            label: paramSpecString("label", null, null, "", ParamFlags.READWRITE),
        },
    });

    return Swatch;
};

describe("registerClass — properties", () => {
    it("installs the properties on the new type", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        expect(swatch.red).toBe(0);
        expect(swatch.label).toBe("");
    });

    it("round-trips a value through g_object_get_property and g_object_set_property", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        swatch.red = 200;
        swatch.label = "crimson";
        const readRed = new Value();
        readRed.init(TYPE_INT);
        swatch.getProperty("red", readRed);
        expect(readRed.getInt()).toBe(200);
        const readLabel = new Value();
        readLabel.init(TYPE_STRING);
        swatch.getProperty("label", readLabel);
        expect(readLabel.getString()).toBe("crimson");
        swatch.setProperty("red", intValue(12));
        expect(swatch.red).toBe(12);
    });

    it("emits notify when a generated accessor changes the value", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        const seen = watchNotify(swatch);
        swatch.red = 3;
        const afterFirstWrite = [...seen];
        swatch.red = 3;
        expect(seen).toEqual(afterFirstWrite);
        swatch.label = "teal";
        expect(seen).toEqual(["red", "label"]);
    });
});

describe("registerClass — property notifications", () => {
    it("emits notify exactly once when the property is set through g_object_set_property", () => {
        const Swatch = makeSwatchClass();
        const swatch = new Swatch();
        const seen = watchNotify(swatch);
        swatch.setProperty("red", intValue(99));
        expect(seen).toEqual(["red"]);
        expect(swatch.red).toBe(99);
    });
});

describe("registerClass — property names", () => {
    it("emits notify under the pspec's own name when the map key differs", () => {
        const Tint = makeTintClass();
        const tint = new Tint();
        const seen: string[] = [];

        tint.connect("notify::tint-level", (pspec: ParamSpec) => {
            seen.push(pspec.getName());
        });

        tint.tintLevel = 7;
        expect(seen).toEqual(["tint-level"]);
    });

    it("keeps the map key as the JavaScript accessor for the property", () => {
        const Tint = makeTintClass();
        const tint = new Tint();
        tint.setProperty("tint-level", intValue(9));
        expect(tint.tintLevel).toBe(9);
        const read = new Value();
        read.init(TYPE_INT);
        tint.getProperty("tint-level", read);
        expect(read.getInt()).toBe(9);
    });
});

describe("registerClass — properties and native sorting", () => {
    it("lets a native sorter compare the property without calling back into JavaScript", () => {
        const Swatch = makeSwatchClass();
        const store = Gio.ListStore.new(Swatch.prototype.__type__);

        for (const red of [7, 3, 9, 1]) {
            const swatch = new Swatch();
            swatch.red = red;
            store.append(swatch);
        }

        const expression = Gtk.PropertyExpression.new(Swatch.prototype.__type__, null, "red");
        const sorter = Gtk.NumericSorter.new(expression);
        const sorted = Gtk.SortListModel.new(store, sorter);

        const reds = Array.from({ length: sorted.getNItems() }, (_, index) => {
            const item = sorted.getItem(index);

            return item === null ? -1 : (Reflect.get(item, "red") as number);
        });

        expect(reds).toEqual([1, 3, 7, 9]);
    });

    it("keeps a plain GObject subclass unaffected", () => {
        class Plain extends GObject {}
        registerClass(Plain, { typeName: uniqueName("GtkxPlainNoProps") });
        const store = new Gio.ListStore({ itemType: TYPE_OBJECT });
        store.append(new Plain());
        expect(store.getNItems()).toBe(1);
    });
});

describe("registerClass — property vtable slots", () => {
    it("backs the setter with the class's own `vfuncSetProperty`", () => {
        class Doubling extends GObject {
            declare red: number;

            vfuncSetProperty(_propertyId: number, value: Value): void {
                this.red = value.getInt() * 2;
            }
        }

        registerClass(Doubling, { typeName: uniqueName("GtkxOwnSetProperty"), properties: { red: intSpec("red") } });
        const instance = new Doubling();
        instance.setProperty("red", intValue(10));
        expect(instance.red).toBe(20);
    });

    it("backs the getter with the class's own `vfuncGetProperty` and keeps what it writes", () => {
        class Offset extends GObject {
            declare red: number;

            vfuncGetProperty(_propertyId: number, value: Value): void {
                value.setInt(this.red + 1);
            }
        }

        registerClass(Offset, { typeName: uniqueName("GtkxOwnGetProperty"), properties: { red: intSpec("red") } });
        const instance = new Offset();
        instance.red = 5;
        const read = new Value();
        read.init(TYPE_INT);
        instance.getProperty("red", read);
        expect(read.getInt()).toBe(6);
    });
});

describe("registerClass — property vtable slot arguments", () => {
    it("decides the two directions independently", () => {
        class SetOnly extends GObject {
            declare red: number;

            vfuncSetProperty(_propertyId: number, value: Value): void {
                this.red = value.getInt() + 1;
            }
        }

        registerClass(SetOnly, { typeName: uniqueName("GtkxOwnSetOnly"), properties: { red: intSpec("red") } });
        const instance = new SetOnly();
        instance.setProperty("red", intValue(4));
        const read = new Value();
        read.init(TYPE_INT);
        instance.getProperty("red", read);
        expect(read.getInt()).toBe(5);
    });

    it("passes the id and pspec of the property the slot was installed for", () => {
        const seen: [number, string][] = [];

        class Recorder extends GObject {
            vfuncSetProperty(propertyId: number, _value: Value, pspec: ParamSpec): void {
                seen.push([propertyId, pspec.getName()]);
            }
        }

        registerClass(Recorder, {
            typeName: uniqueName("GtkxRecordingSetProperty"),
            properties: {
                red: intSpec("red"),
                label: paramSpecString("label", null, null, "", ParamFlags.READWRITE),
            },
        });

        const instance = new Recorder();
        instance.setProperty("label", stringValue("teal"));
        instance.setProperty("red", intValue(2));

        expect(seen).toEqual([
            [2, "label"],
            [1, "red"],
        ]);
    });
});

describe("registerClass — property vtable slot scope", () => {
    it("installs an override on a class that declares no properties, where GObject never reaches it", () => {
        let calls = 0;

        class QuietLabel extends Gtk.Label {
            vfuncSetProperty(): void {
                calls++;
            }
        }

        expect(() => registerClass(QuietLabel, { typeName: uniqueName("GtkxQuietLabel") })).not.toThrow();
        const label = new QuietLabel();
        label.setProperty("label", stringValue("hi"));
        expect(label.getLabel()).toBe("hi");
        expect(calls).toBe(0);
    });

    it("keeps an inherited override off the ids a subclass declares for itself", () => {
        const seen: number[] = [];

        class Base extends GObject {
            declare a: number;

            vfuncSetProperty(propertyId: number, value: Value): void {
                seen.push(propertyId);
                this.a = value.getInt() * 10;
            }
        }

        registerClass(Base, { typeName: uniqueName("GtkxOverridingBase"), properties: { a: intSpec("a") } });

        class Derived extends Base {
            declare b: number;
        }

        registerClass(Derived, { typeName: uniqueName("GtkxDerivedOwnProps"), properties: { b: intSpec("b") } });
        const instance = new Derived();
        instance.setProperty("b", intValue(3));
        expect(instance.b).toBe(3);
        expect(seen).toEqual([]);
        instance.setProperty("a", intValue(2));
        expect(instance.a).toBe(20);
        expect(seen).toEqual([1]);
    });
});
