import assert from "node:assert/strict";
import { test } from "node:test";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import * as GObject from "@gtkx/gi/gobject";
import * as GLib from "@gtkx/gi/glib";
import * as Gio from "@gtkx/gi/gio";
import { installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

test("PropertiesObject starts with its default property values", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    assert.equal(po.someBoolean, false);
    assert.equal(po.someChar, 0);
    assert.equal(po.someUchar, 0);
    assert.equal(po.someInt, 0);
    assert.equal(po.someUint, 0);
    assert.equal(po.someLong, 0n);
    assert.equal(po.someUlong, 0n);
    assert.equal(po.someInt64, 0n);
    assert.equal(po.someUint64, 0n);
    assert.equal(po.someFloat, 0);
    assert.equal(po.someDouble, 0);
    assert.equal(po.someString, null);
    assert.deepEqual(po.someStrv, []);
    assert.equal(po.someBoxedStruct, null);
    assert.equal(po.someGvalue, null);
    assert.equal(po.someVariant, null);
    assert.equal(po.someObject, null);
    assert.equal(po.someByteArray, null);
    assert.equal(po.someFlags, GIMarshallingTests.Flags.VALUE1);
    assert.equal(po.someEnum, GIMarshallingTests.GEnum.VALUE1);
    assert.equal(po.someReadonly, 42);
    assert.equal(po.someDeprecatedInt, 0);
});

test("PropertiesObject sets every supported property at construct time", () => {
    const owned = new GObject.Object({});
    const held = new GObject.Value();
    held.init(GObject.typeFromName("gint"));
    held.setInt(11);
    const po = new GIMarshallingTests.PropertiesObject({
        someBoolean: true,
        someChar: -66,
        someUchar: 200,
        someInt: -42,
        someUint: 4000000000,
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
    assert.equal(po.someBoolean, true);
    assert.equal(po.someChar, -66);
    assert.equal(po.someUchar, 200);
    assert.equal(po.someInt, -42);
    assert.equal(po.someUint, 4000000000);
    assert.equal(po.someLong, -5n);
    assert.equal(po.someUlong, 12n);
    assert.equal(po.someInt64, -(2n ** 62n));
    assert.equal(po.someUint64, 2n ** 63n);
    assert.equal(po.someFloat, 0.5);
    assert.equal(po.someDouble, 1.25);
    assert.equal(po.someString, "ctor");
    assert.deepEqual(po.someStrv, ["x", "y"]);
    assert.equal(po.someBoxedStruct.long, 6n);
    assert.equal(po.someBoxedStruct.string, "boxed");
    assert.equal(po.someVariant.getString()[0], "hello");
    assert.equal(po.someObject === owned, true);
    assert.equal(po.someFlags, GIMarshallingTests.Flags.VALUE2);
    assert.equal(po.someEnum, GIMarshallingTests.GEnum.VALUE3);
    assert.deepEqual(po.someByteArray, new Uint8Array([1, 2, 255]));
    assert.equal(po.someGvalue.getInt(), 11);
    assert.equal(po.someDeprecatedInt, 3);
});

test("PropertiesObject scalar properties round trip at their bounds", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someBoolean = true;
    assert.equal(po.someBoolean, true);
    po.someBoolean = false;
    assert.equal(po.someBoolean, false);
    po.someChar = -128;
    assert.equal(po.someChar, -128);
    po.someChar = 127;
    assert.equal(po.someChar, 127);
    po.someUchar = 255;
    assert.equal(po.someUchar, 255);
    po.someInt = 2 ** 31 - 1;
    assert.equal(po.someInt, 2 ** 31 - 1);
    po.someInt = -(2 ** 31);
    assert.equal(po.someInt, -(2 ** 31));
    po.someUint = 2 ** 32 - 1;
    assert.equal(po.someUint, 2 ** 32 - 1);
    po.someLong = 2n ** 63n - 1n;
    assert.equal(po.someLong, 2n ** 63n - 1n);
    po.someLong = -(2n ** 63n);
    assert.equal(po.someLong, -(2n ** 63n));
    po.someUlong = 2n ** 64n - 1n;
    assert.equal(po.someUlong, 2n ** 64n - 1n);
    po.someInt64 = 2n ** 63n - 1n;
    assert.equal(po.someInt64, 2n ** 63n - 1n);
    po.someUint64 = 2n ** 64n - 1n;
    assert.equal(po.someUint64, 2n ** 64n - 1n);
    po.someFloat = 3.4028234663852886e38;
    assert.equal(po.someFloat, 3.4028234663852886e38);
    po.someDouble = Number.MAX_VALUE;
    assert.equal(po.someDouble, Number.MAX_VALUE);
    po.someDeprecatedInt = -7;
    assert.equal(po.someDeprecatedInt, -7);
});

test("64-bit properties accept plain safe-integer numbers", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someInt64 = 42;
    assert.equal(po.someInt64, 42n);
    po.someUint64 = 43;
    assert.equal(po.someUint64, 43n);
    po.someLong = -44;
    assert.equal(po.someLong, -44n);
    po.someUlong = 45;
    assert.equal(po.someUlong, 45n);
});

test("string strv boxed and byte array properties round trip", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someString = "hello";
    assert.equal(po.someString, "hello");
    po.someStrv = ["a", "b", "c"];
    assert.deepEqual(po.someStrv, ["a", "b", "c"]);
    po.someStrv = [];
    assert.deepEqual(po.someStrv, []);
    const boxed = new GIMarshallingTests.BoxedStruct({ long: 9n, string: "inner" });
    po.someBoxedStruct = boxed;
    const boxedBack = po.someBoxedStruct;
    assert.equal(boxedBack.long, 9n);
    assert.equal(boxedBack.string, "inner");
    assert.notEqual(boxedBack, boxed);
    po.someByteArray = new Uint8Array([0, 128, 255]);
    assert.deepEqual(po.someByteArray, new Uint8Array([0, 128, 255]));
});

test("variant object gvalue enum and flags properties round trip", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    po.someVariant = GLib.Variant.newInt32(31);
    assert.equal(po.someVariant.getInt32(), 31);
    const owned = new GObject.Object({});
    po.someObject = owned;
    assert.equal(po.someObject, owned);
    const held = new GObject.Value();
    held.init(GObject.typeFromName("gchararray"));
    held.setString("held");
    po.someGvalue = held;
    assert.equal(po.someGvalue.getString(), "held");
    po.someEnum = GIMarshallingTests.GEnum.VALUE2;
    assert.equal(po.someEnum, GIMarshallingTests.GEnum.VALUE2);
    po.someFlags = GIMarshallingTests.Flags.VALUE2 | GIMarshallingTests.Flags.VALUE3;
    assert.equal(po.someFlags, 6);
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
    assert.equal(po.someString, null);
    po.someStrv = null;
    assert.deepEqual(po.someStrv, []);
    po.someBoxedStruct = null;
    assert.equal(po.someBoxedStruct, null);
    po.someVariant = null;
    assert.equal(po.someVariant, null);
    po.someObject = null;
    assert.equal(po.someObject, null);
    const held = new GObject.Value();
    held.init(GObject.typeFromName("gint"));
    held.setInt(1);
    po.someGvalue = held;
    po.someGvalue = null;
    assert.equal(po.someGvalue, null);
});

test("notify fires for the changed property and disconnect stops it", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    const seen = [];
    const id = po.connect("notify::some-int", (pspec) => {
        seen.push(pspec.getName());
    });
    assert.equal(typeof id, "number");
    po.someInt = 7;
    assert.deepEqual(seen, ["some-int"]);
    po.someString = "unrelated";
    assert.deepEqual(seen, ["some-int"]);
    po.someInt = 8;
    assert.deepEqual(seen, ["some-int", "some-int"]);
    GObject.signalHandlerDisconnect(po, id);
    po.someInt = 9;
    assert.deepEqual(seen, ["some-int", "some-int"]);
    assert.equal(po.someInt, 9);
});

test("readonly property reads its value and writes throw", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    assert.equal(po.someReadonly, 42);
    assert.throws(() => {
        po.someReadonly = 5;
    });
    assert.equal(po.someReadonly, 42);
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    assert.equal(ao.someReadonly, 42);
    assert.throws(() => {
        ao.someReadonly = 5;
    });
});

test("construct-only property is set at construct and rejected afterwards", () => {
    const action = new Gio.SimpleAction({ name: "probe" });
    assert.equal(action.name, "probe");
    assert.throws(() => {
        action.name = "other";
    });
    assert.equal(action.name, "probe");
});

test("property writes reject wrong types", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    assert.throws(() => {
        po.someInt = "42";
    });
    assert.throws(() => {
        po.someInt = Symbol("nope");
    });
    assert.throws(() => {
        po.someInt = true;
    });
    assert.throws(() => {
        po.someBoxedStruct = {};
    });
    assert.throws(() => {
        po.someObject = "str";
    });
    assert.throws(() => {
        po.someVariant = {};
    });
    assert.throws(() => {
        po.someStrv = ["a", 1];
    });
    assert.equal(po.someInt, 0);
});

test("property writes reject out-of-range integers", () => {
    const po = new GIMarshallingTests.PropertiesObject({});
    assert.throws(() => {
        po.someInt = 2 ** 31;
    });
    assert.throws(() => {
        po.someUint = -1;
    });
    assert.throws(() => {
        po.someInt64 = 2n ** 63n;
    });
    assert.throws(() => {
        po.someUint64 = -1n;
    });
    assert.throws(() => {
        po.someUlong = -1n;
    });
    assert.equal(po.someInt, 0);
});

test("construct-time property values reject wrong types", () => {
    assert.throws(() => new GIMarshallingTests.PropertiesObject({ someInt: "x" }));
    assert.throws(() => new GIMarshallingTests.PropertiesObject({ someBoxedStruct: {} }));
    assert.throws(() => new GIMarshallingTests.PropertiesObject({ someObject: "o" }));
    assert.throws(() => new Regress.TestObj({ int: "x" }));
});

test("PropertiesAccessorsObject accessor methods round trip scalar properties", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    ao.setBoolean(true);
    assert.equal(ao.getBoolean(), true);
    ao.setChar(-12);
    assert.equal(ao.getChar(), -12);
    ao.setUchar(200);
    assert.equal(ao.getUchar(), 200);
    ao.setInt(-42);
    assert.equal(ao.getInt(), -42);
    ao.setUint(4000000000);
    assert.equal(ao.getUint(), 4000000000);
    ao.setLong(-5n);
    assert.equal(ao.getLong(), -5n);
    ao.setUlong(12n);
    assert.equal(ao.getUlong(), 12n);
    ao.setInt64(-(2n ** 62n));
    assert.equal(ao.getInt64(), -(2n ** 62n));
    ao.setUint64(2n ** 63n);
    assert.equal(ao.getUint64(), 2n ** 63n);
    ao.setFloat(0.5);
    assert.equal(ao.getFloat(), 0.5);
    ao.setDouble(1.25);
    assert.equal(ao.getDouble(), 1.25);
    ao.setString("via method");
    assert.equal(ao.getString(), "via method");
    ao.setStrv(["m", "n"]);
    assert.deepEqual(ao.getStrv(), ["m", "n"]);
    ao.setEnum(GIMarshallingTests.GEnum.VALUE3);
    assert.equal(ao.getEnum(), GIMarshallingTests.GEnum.VALUE3);
    ao.setFlags(GIMarshallingTests.Flags.VALUE3);
    assert.equal(ao.getFlags(), GIMarshallingTests.Flags.VALUE3);
    ao.setDeprecatedInt(4);
    assert.equal(ao.getDeprecatedInt(), 4);
    assert.equal(ao.getReadonly(), 42);
});

test("PropertiesAccessorsObject accessor methods round trip boxed container and object properties", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    ao.setByteArray(new Uint8Array([9, 8]));
    assert.deepEqual(ao.getByteArray(), new Uint8Array([9, 8]));
    ao.setHashTable(new Map([[3, "three"], [-4, "minus four"]]));
    assert.deepEqual(ao.getHashTable(), new Map([[3, "three"], [-4, "minus four"]]));
    ao.setBoxedStruct(new GIMarshallingTests.BoxedStruct({ long: 77n }));
    assert.equal(ao.getBoxedStruct().long, 77n);
    ao.setVariant(GLib.Variant.newInt32(31));
    assert.equal(ao.getVariant().getInt32(), 31);
    const owned = new GObject.Object({});
    ao.setObject(owned);
    assert.equal(ao.getObject(), owned);
    const held = new GObject.Value();
    held.init(GObject.typeFromName("gchararray"));
    held.setString("boxed value");
    ao.setGvalue(held);
    assert.equal(ao.getGvalue(), "boxed value");
    assert.equal(ao.someGvalue.getString(), "boxed value");
});

test("PropertiesAccessorsObject property accessors set values and notify", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    const seen = [];
    const id = ao.connect("notify::some-int", (pspec) => {
        seen.push(pspec.getName());
    });
    ao.someInt = 3;
    assert.equal(ao.someInt, 3);
    assert.equal(ao.getInt(), 3);
    ao.setInt(4);
    assert.equal(ao.someInt, 4);
    assert.deepEqual(seen, ["some-int", "some-int"]);
    GObject.signalHandlerDisconnect(ao, id);
});

test("PropertiesAccessorsObject accessor methods reject invalid values", () => {
    const ao = GIMarshallingTests.PropertiesAccessorsObject.new();
    assert.throws(() => ao.setInt(1.5));
    assert.throws(() => ao.setInt(2 ** 31));
    assert.throws(() => ao.setInt("5"));
    assert.throws(() => ao.setInt(Symbol("nope")));
    assert.throws(() => ao.setUint(-1));
    assert.throws(() => ao.setChar(128));
    assert.throws(() => ao.setUchar(256));
    assert.throws(() => ao.setString(5));
    assert.throws(() => ao.setEnum(999));
    assert.throws(() => ao.setFlags(0xffff));
    assert.equal(ao.getInt(), 0);
});

test("TestObj properties are set at construct time", () => {
    const bare = new GObject.Object({});
    const obj = new Regress.TestObj({
        string: "hello",
        int: 42,
        float: 3.5,
        double: 2.5,
        unichar: 0x10ffff,
        bare,
    });
    assert.equal(obj.string, "hello");
    assert.equal(obj.getString(), "hello");
    assert.equal(obj.int, 42);
    assert.equal(obj.float, 3.5);
    assert.equal(obj.double, 2.5);
    assert.equal(obj.unichar, 0x10ffff);
    assert.equal(obj.bare, bare);
});

test("TestObj object boxed and byte array properties round trip", () => {
    const obj = new Regress.TestObj({});
    const bare = new GObject.Object({});
    obj.bare = bare;
    assert.equal(obj.bare, bare);
    obj.bare = null;
    assert.equal(obj.bare, null);
    const boxed = Regress.TestBoxed.new();
    boxed.someInt8 = 42;
    obj.boxed = boxed;
    const boxedBack = obj.boxed;
    assert.equal(boxedBack.someInt8, 42);
    assert.notEqual(boxedBack, boxed);
    obj.byteArray = new Uint8Array([1, 2, 3]);
    assert.deepEqual(obj.byteArray, new Uint8Array([1, 2, 3]));
});

test("TestObj gtype and unichar properties round trip", () => {
    const obj = new Regress.TestObj({});
    assert.equal(obj.gtype, 0n);
    obj.gtype = GObject.typeFromName("GObject");
    assert.equal(GObject.typeName(obj.gtype), "GObject");
    assert.equal(obj.unichar, 0);
    obj.unichar = 0x2665;
    assert.equal(obj.unichar, 0x2665);
    obj.unichar = 0x10ffff;
    assert.equal(obj.unichar, 0x10ffff);
});

test("TestObj write-only property resets int and reads as undefined", () => {
    const obj = new Regress.TestObj({ int: 47 });
    assert.equal(obj.int, 47);
    assert.equal(obj.writeOnly, undefined);
    obj.writeOnly = true;
    assert.equal(obj.int, 0);
});

test("TestObj name-conflict construct property is readable through getProperty", () => {
    const obj = new Regress.TestObj({ nameConflict: 7 });
    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    obj.getProperty("name-conflict", value);
    assert.equal(value.getInt(), 7);
    const defaulted = new Regress.TestObj({});
    const defaultValue = new GObject.Value();
    defaultValue.init(GObject.typeFromName("gint"));
    defaulted.getProperty("name-conflict", defaultValue);
    assert.equal(defaultValue.getInt(), 42);
});

test("TestObj string property notifies and matches its accessor methods", () => {
    const obj = new Regress.TestObj({});
    const seen = [];
    const id = obj.connect("notify::string", (pspec) => {
        seen.push(pspec.getName());
    });
    obj.string = "abc";
    assert.equal(obj.string, "abc");
    assert.equal(obj.getString(), "abc");
    assert.deepEqual(seen, ["string"]);
    obj.setString("def");
    assert.equal(obj.string, "def");
    assert.deepEqual(seen, ["string", "def" === obj.string ? "string" : "missing"]);
    GObject.signalHandlerDisconnect(obj, id);
});

test("TestObj property writes reject wrong types", () => {
    const obj = new Regress.TestObj({});
    assert.throws(() => {
        obj.int = "x";
    });
    assert.throws(() => {
        obj.bare = "x";
    });
    assert.throws(() => {
        obj.float = "x";
    });
    assert.equal(obj.int, 0);
});
