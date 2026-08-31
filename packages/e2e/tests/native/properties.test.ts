import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const intGvalue = (contents: number): GObject.Value => {
    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    value.setInt(contents);

    return value;
};

test("PropertiesObject starts with its default property values", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    expect(po.someBoolean).toBe(false);
    expect(po.someChar).toBe(0);
    expect(po.someUchar).toBe(0);
    expect(po.someInt).toBe(0);
    expect(po.someUint).toBe(0);
    expect(po.someLong).toBe(0n);
    expect(po.someUlong).toBe(0n);
    expect(po.someInt64).toBe(0n);
    expect(po.someUint64).toBe(0n);
    expect(po.someFloat).toBe(0);
    expect(po.someDouble).toBe(0);
    expect(po.someString).toBeNull();
    expect(po.someStrv).toEqual([]);
    expect(po.someBoxedStruct).toBeNull();
    expect(po.someGvalue).toBeNull();
    expect(po.someVariant).toBeNull();
    expect(po.someObject).toBeNull();
    expect(po.someByteArray).toBeNull();
    expect(po.someFlags).toBe(GIMarshallingTests.Flags.VALUE1);
    expect(po.someEnum).toBe(GIMarshallingTests.GEnum.VALUE1);
    expect(po.someReadonly).toBe(42);
    expect(po.someDeprecatedInt).toBe(0);
});

test("PropertiesObject sets every supported property at construct time", () => {
    const owned = new GObject.Object({});
    const held = intGvalue(11);
    const po = new GIMarshallingTests.PropertiesObject({
        someBoolean: true,
        someChar: -66,
        someUchar: 200,
        someInt: -42,
        someUint: 4_000_000_000,
        someLong: -5n,
        someUlong: 12n,
        someInt64: -(2n ** 62n),
        someUint64: 2n ** 63n,
        someFloat: 0.5,
        someDouble: 1.25,
        someString: "ctor",
        someStrv: ["x", "y"],
        someBoxedStruct: new GIMarshallingTests.BoxedStruct({ long: 6n, string: "boxed" }),
        someVariant: GLib.Variant.newString("hello"),
        someObject: owned,
        someFlags: GIMarshallingTests.Flags.VALUE2,
        someEnum: GIMarshallingTests.GEnum.VALUE3,
        someByteArray: new Uint8Array([1, 2, 255]),
        someGvalue: held,
        someDeprecatedInt: 3,
    });
    expect(po.someBoolean).toBe(true);
    expect(po.someChar).toBe(-66);
    expect(po.someUchar).toBe(200);
    expect(po.someInt).toBe(-42);
    expect(po.someUint).toBe(4_000_000_000);
    expect(po.someLong).toBe(-5n);
    expect(po.someUlong).toBe(12n);
    expect(po.someInt64).toBe(-(2n ** 62n));
    expect(po.someUint64).toBe(2n ** 63n);
    expect(po.someFloat).toBe(0.5);
    expect(po.someDouble).toBe(1.25);
    expect(po.someString).toBe("ctor");
    expect(po.someStrv).toEqual(["x", "y"]);
    expect(po.someBoxedStruct?.long).toBe(6n);
    expect(po.someBoxedStruct?.string).toBe("boxed");
    expect(po.someVariant?.getString()[0]).toBe("hello");
    expect(po.someObject).toBe(owned);
    expect(po.someFlags).toBe(GIMarshallingTests.Flags.VALUE2);
    expect(po.someEnum).toBe(GIMarshallingTests.GEnum.VALUE3);
    expect(po.someByteArray).toEqual(new Uint8Array([1, 2, 255]));
    expect(po.someGvalue?.getInt()).toBe(11);
    expect(po.someDeprecatedInt).toBe(3);
});

test("PropertiesObject scalar properties round trip at their bounds", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someBoolean = true;
    expect(po.someBoolean).toBe(true);
    po.someBoolean = false;
    expect(po.someBoolean).toBe(false);
    po.someChar = -128;
    expect(po.someChar).toBe(-128);
    po.someChar = 127;
    expect(po.someChar).toBe(127);
    po.someUchar = 255;
    expect(po.someUchar).toBe(255);
    po.someInt = 2 ** 31 - 1;
    expect(po.someInt).toBe(2 ** 31 - 1);
    po.someInt = -(2 ** 31);
    expect(po.someInt).toBe(-(2 ** 31));
    po.someUint = 2 ** 32 - 1;
    expect(po.someUint).toBe(2 ** 32 - 1);
    po.someLong = 2n ** 63n - 1n;
    expect(po.someLong).toBe(2n ** 63n - 1n);
    po.someLong = -(2n ** 63n);
    expect(po.someLong).toBe(-(2n ** 63n));
    po.someUlong = 2n ** 64n - 1n;
    expect(po.someUlong).toBe(2n ** 64n - 1n);
    po.someInt64 = 2n ** 63n - 1n;
    expect(po.someInt64).toBe(2n ** 63n - 1n);
    po.someUint64 = 2n ** 64n - 1n;
    expect(po.someUint64).toBe(2n ** 64n - 1n);
    po.someFloat = 3.4028234663852886e38;
    expect(po.someFloat).toBe(3.4028234663852886e38);
    po.someDouble = Number.MAX_VALUE;
    expect(po.someDouble).toBe(Number.MAX_VALUE);
    po.someDeprecatedInt = -7;
    expect(po.someDeprecatedInt).toBe(-7);
});

test("64-bit properties accept plain safe-integer numbers", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    // @ts-expect-error the property is declared bigint, and the binding widens it to a plain number
    po.someInt64 = 42;
    expect(po.someInt64).toBe(42n);
    // @ts-expect-error the property is declared bigint, and the binding widens it to a plain number
    po.someUint64 = 43;
    expect(po.someUint64).toBe(43n);
    // @ts-expect-error the property is declared bigint, and the binding widens it to a plain number
    po.someLong = -44;
    expect(po.someLong).toBe(-44n);
    // @ts-expect-error the property is declared bigint, and the binding widens it to a plain number
    po.someUlong = 45;
    expect(po.someUlong).toBe(45n);
});

test("string strv boxed and byte array properties round trip", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someString = "hello";
    expect(po.someString).toBe("hello");
    po.someStrv = ["a", "b", "c"];
    expect(po.someStrv).toEqual(["a", "b", "c"]);
    po.someStrv = [];
    expect(po.someStrv).toEqual([]);
    const boxed = new GIMarshallingTests.BoxedStruct({ long: 9n, string: "inner" });
    po.someBoxedStruct = boxed;
    const boxedBack = po.someBoxedStruct;
    expect(boxedBack.long).toBe(9n);
    expect(boxedBack.string).toBe("inner");
    expect(boxedBack).not.toBe(boxed);
    po.someByteArray = new Uint8Array([0, 128, 255]);
    expect(po.someByteArray).toEqual(new Uint8Array([0, 128, 255]));
});

test("variant object gvalue enum and flags properties round trip", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someVariant = GLib.Variant.newInt32(31);
    expect(po.someVariant.getInt32()).toBe(31);
    const owned = new GObject.Object({});
    po.someObject = owned;
    expect(po.someObject).toBe(owned);
    const held = new GObject.Value();
    held.init(GObject.typeFromName("gchararray"));
    held.setString("held");
    po.someGvalue = held;
    expect(po.someGvalue.getString()).toBe("held");
    po.someEnum = GIMarshallingTests.GEnum.VALUE2;
    expect(po.someEnum).toBe(GIMarshallingTests.GEnum.VALUE2);
    po.someFlags = GIMarshallingTests.Flags.VALUE2 | GIMarshallingTests.Flags.VALUE3;
    expect(po.someFlags).toBe(6);
});

test("nullable properties accept null and clear their value", () => {
    const po = new GIMarshallingTests.PropertiesObject({
        someString: "s",
        someStrv: ["a"],
        someBoxedStruct: new GIMarshallingTests.BoxedStruct({ long: 1n }),
        someVariant: GLib.Variant.newString("v"),
        someObject: new GObject.Object({}),
    });
    po.someString = null;
    expect(po.someString).toBeNull();
    po.someStrv = null;
    expect(po.someStrv).toEqual([]);
    po.someBoxedStruct = null;
    expect(po.someBoxedStruct).toBeNull();
    po.someVariant = null;
    expect(po.someVariant).toBeNull();
    po.someObject = null;
    expect(po.someObject).toBeNull();
    const held = intGvalue(1);
    po.someGvalue = held;
    expect(po.someGvalue.getInt()).toBe(1);
    po.someGvalue = null;
    expect(po.someGvalue).toBeNull();
});

test("notify fires for the changed property and disconnect stops it", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    const seen: string[] = [];
    const id = po.connect("notify::some-int", (pspec) => {
        seen.push(pspec.getName());
    });
    expect(typeof id).toBe("number");
    po.someInt = 7;
    expect(seen).toEqual(["some-int"]);
    po.someString = "unrelated";
    expect(seen).toEqual(["some-int"]);
    po.someInt = 8;
    expect(seen).toEqual(["some-int", "some-int"]);
    // @ts-expect-error connect hands back a number and the disconnect parameter is declared bigint
    GObject.signalHandlerDisconnect(po, id);
    po.someInt = 9;
    expect(seen).toEqual(["some-int", "some-int"]);
    expect(po.someInt).toBe(9);
});

test("readonly property reads its value and writes throw", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    expect(po.someReadonly).toBe(42);
    expect(() => {
        // @ts-expect-error someReadonly is read-only
        po.someReadonly = 5;
    }).toThrow();
    expect(po.someReadonly).toBe(42);
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    expect(ao.someReadonly).toBe(42);
    expect(() => {
        // @ts-expect-error someReadonly is read-only
        ao.someReadonly = 5;
    }).toThrow();
});

test("construct-only property is set at construct and rejected afterwards", () => {
    const action = new Gio.SimpleAction({ name: "probe" });
    expect(action.name).toBe("probe");
    expect(() => {
        // @ts-expect-error name is construct-only
        action.name = "other";
    }).toThrow();
    expect(action.name).toBe("probe");
});

test("property writes reject wrong types", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    expect(() => {
        // @ts-expect-error a string is not an int property value
        po.someInt = "42";
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not an int property value
        po.someInt = Symbol("nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a boolean is not an int property value
        po.someInt = true;
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a BoxedStruct
        po.someBoxedStruct = {};
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an object property value
        po.someObject = "str";
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a Variant
        po.someVariant = {};
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a strv element
        po.someStrv = ["a", 1];
    }).toThrow();
    expect(po.someInt).toBe(0);
});

test("property writes reject out-of-range integers", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    expect(() => {
        po.someInt = 2 ** 31;
    }).toThrow();
    expect(() => {
        po.someUint = -1;
    }).toThrow();
    expect(() => {
        po.someInt64 = 2n ** 63n;
    }).toThrow();
    expect(() => {
        po.someUint64 = -1n;
    }).toThrow();
    expect(() => {
        po.someUlong = -1n;
    }).toThrow();
    expect(po.someInt).toBe(0);
});

test("construct-time property values reject wrong types", () => {
    // @ts-expect-error a string is not an int property value
    expect(() => new GIMarshallingTests.PropertiesObject({ someInt: "x" })).toThrow();
    // @ts-expect-error a plain object is not a BoxedStruct
    expect(() => new GIMarshallingTests.PropertiesObject({ someBoxedStruct: {} })).toThrow();
    // @ts-expect-error a string is not an object property value
    expect(() => new GIMarshallingTests.PropertiesObject({ someObject: "o" })).toThrow();
    // @ts-expect-error a string is not an int property value
    expect(() => new Regress.TestObj({ int: "x" })).toThrow();
});

test("PropertiesAccessorsObject accessor methods round trip scalar properties", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    ao.setBoolean(true);
    expect(ao.getBoolean()).toBe(true);
    ao.setChar(-12);
    expect(ao.getChar()).toBe(-12);
    ao.setUchar(200);
    expect(ao.getUchar()).toBe(200);
    ao.setInt(-42);
    expect(ao.getInt()).toBe(-42);
    ao.setUint(4_000_000_000);
    expect(ao.getUint()).toBe(4_000_000_000);
    ao.setLong(-5n);
    expect(ao.getLong()).toBe(-5n);
    ao.setUlong(12n);
    expect(ao.getUlong()).toBe(12n);
    ao.setInt64(-(2n ** 62n));
    expect(ao.getInt64()).toBe(-(2n ** 62n));
    ao.setUint64(2n ** 63n);
    expect(ao.getUint64()).toBe(2n ** 63n);
    ao.setFloat(0.5);
    expect(ao.getFloat()).toBe(0.5);
    ao.setDouble(1.25);
    expect(ao.getDouble()).toBe(1.25);
    ao.setString("via method");
    expect(ao.getString()).toBe("via method");
    ao.setStrv(["m", "n"]);
    expect(ao.getStrv()).toEqual(["m", "n"]);
    ao.setEnum(GIMarshallingTests.GEnum.VALUE3);
    expect(ao.getEnum()).toBe(GIMarshallingTests.GEnum.VALUE3);
    ao.setFlags(GIMarshallingTests.Flags.VALUE3);
    expect(ao.getFlags()).toBe(GIMarshallingTests.Flags.VALUE3);
    ao.setDeprecatedInt(4);
    expect(ao.getDeprecatedInt()).toBe(4);
    expect(ao.getReadonly()).toBe(42);
});

test("PropertiesAccessorsObject accessor methods round trip boxed container and object properties", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    ao.setByteArray(new Uint8Array([9, 8]));
    expect(ao.getByteArray()).toEqual(new Uint8Array([9, 8]));
    ao.setHashTable(new Map([[3, "three"], [-4, "minus four"]]));
    expect(ao.getHashTable()).toEqual(new Map([[3, "three"], [-4, "minus four"]]));
    ao.setBoxedStruct(new GIMarshallingTests.BoxedStruct({ long: 77n }));
    expect(ao.getBoxedStruct().long).toBe(77n);
    ao.setVariant(GLib.Variant.newInt32(31));
    expect(ao.getVariant().getInt32()).toBe(31);
    const owned = new GObject.Object({});
    ao.setObject(owned);
    expect(ao.getObject()).toBe(owned);
    const held = new GObject.Value();
    held.init(GObject.typeFromName("gchararray"));
    held.setString("boxed value");
    ao.setGvalue(held);
    expect(ao.getGvalue()).toBe("boxed value");
    expect(ao.someGvalue?.getString()).toBe("boxed value");
});

test("PropertiesAccessorsObject property accessors set values and notify", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    const seen: string[] = [];
    const id = ao.connect("notify::some-int", (pspec) => {
        seen.push(pspec.getName());
    });
    ao.someInt = 3;
    expect(ao.someInt).toBe(3);
    expect(ao.getInt()).toBe(3);
    ao.setInt(4);
    expect(ao.someInt).toBe(4);
    expect(seen).toEqual(["some-int", "some-int"]);
    // @ts-expect-error connect hands back a number and the disconnect parameter is declared bigint
    GObject.signalHandlerDisconnect(ao, id);
});

test("PropertiesAccessorsObject accessor methods reject invalid values", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    expect(() => {
        ao.setInt(1.5);
    }).toThrow();
    expect(() => {
        ao.setInt(2 ** 31);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an int
        ao.setInt("5");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not an int
        ao.setInt(Symbol("nope"));
    }).toThrow();
    expect(() => {
        ao.setUint(-1);
    }).toThrow();
    expect(() => {
        ao.setChar(128);
    }).toThrow();
    expect(() => {
        ao.setUchar(256);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a string
        ao.setString(5);
    }).toThrow();
    expect(() => {
        // @ts-expect-error 999 is not a GEnum member
        ao.setEnum(999);
    }).toThrow();
    expect(() => {
        // @ts-expect-error 65535 is not a Flags member
        ao.setFlags(0xFF_FF);
    }).toThrow();
    expect(ao.getInt()).toBe(0);
});

test("TestObj properties are set at construct time", () => {
    const bare = new GObject.Object({});
    const obj = new Regress.TestObj({
        string: "hello",
        int: 42,
        float: 3.5,
        double: 2.5,
        unichar: 0x10_FF_FF,
        bare,
    });
    expect(obj.string).toBe("hello");
    expect(obj.getString()).toBe("hello");
    expect(obj.int).toBe(42);
    expect(obj.float).toBe(3.5);
    expect(obj.double).toBe(2.5);
    expect(obj.unichar).toBe(0x10_FF_FF);
    expect(obj.bare).toBe(bare);
});

test("TestObj object boxed and byte array properties round trip", () => {
    const obj = new Regress.TestObj({});
    const bare = new GObject.Object({});
    obj.bare = bare;
    expect(obj.bare).toBe(bare);
    obj.bare = null;
    expect(obj.bare).toBeNull();
    const boxed = Regress.TestBoxed.new();
    boxed.someInt8 = 42;
    obj.boxed = boxed;
    const boxedBack = obj.boxed;
    expect(boxedBack.someInt8).toBe(42);
    expect(boxedBack).not.toBe(boxed);
    obj.byteArray = new Uint8Array([1, 2, 3]);
    expect(obj.byteArray).toEqual(new Uint8Array([1, 2, 3]));
});

test("TestObj gtype and unichar properties round trip", () => {
    const obj = new Regress.TestObj({});
    expect(obj.gtype).toBe(0n);
    obj.gtype = GObject.typeFromName("GObject");
    expect(GObject.typeName(obj.gtype)).toBe("GObject");
    expect(obj.unichar).toBe(0);
    obj.unichar = 0x26_65;
    expect(obj.unichar).toBe(0x26_65);
    obj.unichar = 0x10_FF_FF;
    expect(obj.unichar).toBe(0x10_FF_FF);
});

test("TestObj write-only property resets int and reads as undefined", () => {
    const obj = new Regress.TestObj({ int: 47 });
    expect(obj.int).toBe(47);
    expect(obj.writeOnly).toBeUndefined();
    obj.writeOnly = true;
    expect(obj.int).toBe(0);
});

test("TestObj name-conflict construct property is readable through getProperty", () => {
    const obj = new Regress.TestObj({ nameConflict: 7 });
    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    obj.getProperty("name-conflict", value);
    expect(value.getInt()).toBe(7);
    const defaulted = new Regress.TestObj({});
    const defaultValue = new GObject.Value();
    defaultValue.init(GObject.typeFromName("gint"));
    defaulted.getProperty("name-conflict", defaultValue);
    expect(defaultValue.getInt()).toBe(42);
});

test("TestObj string property notifies and matches its accessor methods", () => {
    const obj = new Regress.TestObj({});
    const seen: string[] = [];
    const id = obj.connect("notify::string", (pspec) => {
        seen.push(pspec.getName());
    });
    obj.string = "abc";
    expect(obj.string).toBe("abc");
    expect(obj.getString()).toBe("abc");
    expect(seen).toEqual(["string"]);
    obj.setString("def");
    expect(obj.string).toBe("def");
    expect(seen).toEqual(["string", "def" === obj.string ? "string" : "missing"]);
    // @ts-expect-error connect hands back a number and the disconnect parameter is declared bigint
    GObject.signalHandlerDisconnect(obj, id);
});

test("TestObj property writes reject wrong types", () => {
    const obj = new Regress.TestObj({});
    expect(() => {
        // @ts-expect-error a string is not an int property value
        obj.int = "x";
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an object property value
        obj.bare = "x";
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a float property value
        obj.float = "x";
    }).toThrow();
    expect(obj.int).toBe(0);
});
