import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { type AnyClass, resolveType, type TypedClass } from "@gtkx/runtime";
import { assert, expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

type ValueType = AnyClass<TypedClass> | GObject.Type;

drainAfterEachTest();

const buildValue = (type: ValueType, fill: (value: GObject.Value) => void): GObject.Value => {
    const value = new GObject.Value();
    value.init(type);
    fill(value);

    return value;
};

const named = (name: string): GObject.Type => GObject.typeFromName(name);
const genumType = (): GObject.Type => resolveType("libgimarshallingtests.so", "gi_marshalling_tests_genum_get_type");
const flagsType = (): GObject.Type => resolveType("libgimarshallingtests.so", "gi_marshalling_tests_flags_get_type");
const fixtureFloat = 314 / 100;

const intValue = (n: number): GObject.Value => buildValue(named("gint"), (value) => {
    value.setInt(n);
});

const uintValue = (n: number): GObject.Value => buildValue(named("guint"), (value) => {
    value.setUint(n);
});

const scharValue = (n: number): GObject.Value => buildValue(named("gchar"), (value) => {
    value.setSchar(n);
});

const ucharValue = (n: number): GObject.Value => buildValue(named("guchar"), (value) => {
    value.setUchar(n);
});

const int64Value = (n: bigint): GObject.Value => buildValue(named("gint64"), (value) => {
    value.setInt64(n);
});

const uint64Value = (n: bigint): GObject.Value => buildValue(named("guint64"), (value) => {
    value.setUint64(n);
});

const longValue = (n: bigint): GObject.Value => buildValue(named("glong"), (value) => {
    value.setLong(n);
});

const ulongValue = (n: bigint): GObject.Value => buildValue(named("gulong"), (value) => {
    value.setUlong(n);
});

const floatValue = (n: number): GObject.Value => buildValue(named("gfloat"), (value) => {
    value.setFloat(n);
});

const doubleValue = (n: number): GObject.Value => buildValue(named("gdouble"), (value) => {
    value.setDouble(n);
});

const booleanValue = (isSet: boolean): GObject.Value => buildValue(named("gboolean"), (value) => {
    value.setBoolean(isSet);
});

const stringValue = (s: string): GObject.Value => buildValue(named("gchararray"), (value) => {
    value.setString(s);
});

const gtypeValue = (type: ValueType): GObject.Value => buildValue(named("GType"), (value) => {
    value.setGtype(type);
});

const variantValue = (v: GLib.Variant): GObject.Value => buildValue(named("GVariant"), (value) => {
    value.setVariant(v);
});

const objectValue = (o: GObject.Object): GObject.Value => buildValue(GIMarshallingTests.Object, (value) => {
    value.setObject(o);
});

const enumValue = (v: number): GObject.Value => buildValue(genumType(), (value) => {
    value.setEnum(v);
});

const flagsValue = (v: number): GObject.Value => buildValue(flagsType(), (value) => {
    value.setFlags(v);
});

const boxedValue = (b: object): GObject.Value => buildValue(Regress.TestBoxed, (value) => {
    value.setBoxed(b);
});

test("gvalue returns and out params carry their C values", () => {
    expect(GIMarshallingTests.gvalueReturn()).toBe(42);
    expect(GIMarshallingTests.gvalueOut().getInt()).toBe(42);
    expect(GIMarshallingTests.gvalueInt64Out().getInt64()).toBe(2n ** 63n - 1n);
    expect(GIMarshallingTests.gvalueOutCallerAllocates()).toBe(42);
    expect(GIMarshallingTests.gvalueOutUninitialized()).toEqual([false, null]);
    expect(Number.isNaN(GIMarshallingTests.gvalueNoncanonicalNanFloat())).toBeTruthy();
    expect(Number.isNaN(GIMarshallingTests.gvalueNoncanonicalNanDouble())).toBeTruthy();
    expect(Regress.testValueReturn(17)).toBe(17);
});

test("each borrowed gvalue out param decodes into its own wrapper", () => {
    const first = GIMarshallingTests.gvalueOut();
    const second = GIMarshallingTests.gvalueOut();
    expect(first).toBeInstanceOf(GObject.Value);
    expect(second).toBeInstanceOf(GObject.Value);
    expect(first).not.toBe(second);
    expect(first.getInt()).toBe(second.getInt());
    expect(GIMarshallingTests.gvalueInt64Out().getInt64()).toBe(GIMarshallingTests.gvalueInt64Out().getInt64());
});

test("gvalue in params accept built values holding the expected payload", () => {
    GIMarshallingTests.gvalueIn(intValue(42));
    GIMarshallingTests.gvalueInt64In(int64Value(2n ** 63n - 1n));
    GIMarshallingTests.gvalueFloat(floatValue(fixtureFloat), doubleValue(fixtureFloat));
    expect(Regress.testIntValueArg(intValue(42))).toBe(42);
});

test("plain js values marshal into gvalue params by type inference", () => {
    expect(Regress.testIntValueArg(42)).toBe(42);
    GIMarshallingTests.gvalueFlatArray([42, "42", true]);
    GIMarshallingTests.gvalueFloat(floatValue(fixtureFloat), fixtureFloat);
});

test("gvalue round trips preserve each fundamental type", () => {
    const gint = named("gint");
    expect(GIMarshallingTests.gvalueRoundTrip(intValue(42))).toBe(42);
    expect(GIMarshallingTests.gvalueRoundTrip(booleanValue(true))).toBe(true);
    expect(GIMarshallingTests.gvalueRoundTrip(booleanValue(false))).toBe(false);
    expect(GIMarshallingTests.gvalueRoundTrip(scharValue(-128))).toBe(-128);
    expect(GIMarshallingTests.gvalueRoundTrip(ucharValue(255))).toBe(255);
    expect(GIMarshallingTests.gvalueRoundTrip(uintValue(4_294_967_295))).toBe(4_294_967_295);
    expect(GIMarshallingTests.gvalueRoundTrip(floatValue(0.5))).toBe(0.5);
    expect(GIMarshallingTests.gvalueRoundTrip(doubleValue(2.5))).toBe(2.5);
    expect(GIMarshallingTests.gvalueRoundTrip(int64Value(-(2n ** 63n)))).toBe(-(2n ** 63n));
    expect(GIMarshallingTests.gvalueRoundTrip(uint64Value(2n ** 64n - 1n))).toBe(2n ** 64n - 1n);
    expect(GIMarshallingTests.gvalueRoundTrip(longValue(-9n))).toBe(-9n);
    expect(GIMarshallingTests.gvalueRoundTrip(ulongValue(9n))).toBe(9n);
    expect(GIMarshallingTests.gvalueRoundTrip(stringValue("gtkx"))).toBe("gtkx");
    expect(GIMarshallingTests.gvalueRoundTrip(gtypeValue(gint))).toBe(gint);
});

test("gvalue round trips preserve objects enums flags variants and boxed payloads", () => {
    const object = GIMarshallingTests.Object.new(42);
    const objectBack = GIMarshallingTests.gvalueRoundTrip(objectValue(object));

    assert(objectBack instanceof GIMarshallingTests.Object);
    expect(objectBack).toBe(object);
    expect(objectBack.int).toBe(42);

    const enumBack = GIMarshallingTests.gvalueRoundTrip(enumValue(GIMarshallingTests.GEnum.VALUE3));
    expect(enumBack).toBe(42);

    const flagsBack = GIMarshallingTests.gvalueRoundTrip(flagsValue(GIMarshallingTests.Flags.VALUE3));
    expect(flagsBack).toBe(4);

    const variant = GLib.Variant.newInt32(7);
    const variantBack = GIMarshallingTests.gvalueRoundTrip(variantValue(variant));

    assert(variantBack instanceof GLib.Variant);
    expect(variantBack.getInt32()).toBe(7);

    const boxed = Regress.TestBoxed.newAlternativeConstructor1(42);
    const boxedBack = GIMarshallingTests.gvalueRoundTrip(boxedValue(boxed));

    assert(boxedBack instanceof Regress.TestBoxed);
    expect(boxedBack.someInt8).toBe(42);
    expect(boxedBack).not.toBe(boxed);
});

test("gvalue copy hands back an independent value with the same payload", () => {
    expect(GIMarshallingTests.gvalueCopy(intValue(42))).toBe(42);
    expect(GIMarshallingTests.gvalueCopy(stringValue("copy me"))).toBe("copy me");
    expect(GIMarshallingTests.gvalueCopy(doubleValue(-1.5))).toBe(-1.5);

    const source = intValue(42);
    expect(GIMarshallingTests.gvalueCopy(source)).toBe(42);
    expect(source.getInt()).toBe(42);
});

test("gvalue modification through a pointer is visible on the wrapper", () => {
    const value = intValue(42);
    GIMarshallingTests.gvalueInWithModification(value);
    expect(value.getInt()).toBe(24);
});

test("typed gvalues match their declared gtype", () => {
    GIMarshallingTests.gvalueInWithType(intValue(1), named("gint"));
    GIMarshallingTests.gvalueInWithType(stringValue("typed"), named("gchararray"));

    const object = GIMarshallingTests.Object.new(1);
    const holdsObject = objectValue(object);
    GIMarshallingTests.gvalueInWithType(holdsObject, GIMarshallingTests.Object);
    GIMarshallingTests.gvalueInWithType(holdsObject, GObject.Object);
    expect(holdsObject.getObject()).toBe(object);

    const boxed = Regress.TestBoxed.newAlternativeConstructor1(3);
    const holdsBoxed = boxedValue(boxed);
    GIMarshallingTests.gvalueInWithType(holdsBoxed, Regress.TestBoxed);
    expect(holdsBoxed.getBoxed<Regress.TestBoxed>().someInt8).toBe(3);

    const holdsEnum = enumValue(GIMarshallingTests.GEnum.VALUE3);
    GIMarshallingTests.gvalueInEnum(holdsEnum);
    expect(holdsEnum.getEnum()).toBe(GIMarshallingTests.GEnum.VALUE3);

    const holdsFlags = flagsValue(GIMarshallingTests.Flags.VALUE3);
    GIMarshallingTests.gvalueInFlags(holdsFlags);
    expect(holdsFlags.getFlags()).toBe(GIMarshallingTests.Flags.VALUE3);
});

test("flat gvalue array returns expose each element", () => {
    const fixed = GIMarshallingTests.returnGvalueFlatArray();
    expect(fixed).toHaveLength(3);
    expect(fixed[0]?.getInt()).toBe(42);
    expect(fixed[1]?.getString()).toBe("42");
    expect(fixed[2]?.getBoolean()).toBe(true);

    const zeroTerminated = GIMarshallingTests.returnGvalueZeroTerminatedArray();
    expect(zeroTerminated).toHaveLength(3);
    expect(zeroTerminated[0]?.getInt()).toBe(42);
    expect(zeroTerminated[1]?.getString()).toBe("42");
    expect(zeroTerminated[2]?.getBoolean()).toBe(true);
});

test("flat gvalue array arguments accept built values", () => {
    const values = [intValue(42), stringValue("42"), booleanValue(true)];
    GIMarshallingTests.gvalueFlatArray(values);
    expect(values[0]?.getInt()).toBe(42);
    expect(values[1]?.getString()).toBe("42");
    expect(values[2]?.getBoolean()).toBe(true);

    GIMarshallingTests.gvalueFlatArray([intValue(42), "42", true]);
});

test("regress gvalue helpers return their documented payloads", () => {
    const date = Regress.testDateInGvalue();

    assert(date instanceof GLib.Date);
    expect(date.getDay()).toBe(5);
    expect(date.getMonth()).toBe(12);
    expect(date.getYear()).toBe(1984);

    const boxed = Regress.testGvalueOutBoxed(7);

    assert(boxed instanceof Regress.TestBoxed);
    expect(boxed.someInt8).toBe(7);

    const zeroBoxed = Regress.testGvalueOutBoxed(0);

    assert(zeroBoxed instanceof Regress.TestBoxed);
    expect(zeroBoxed.someInt8).toBe(0);

    expect(Regress.testValueReturn(-1)).toBe(-1);
    expect(Regress.testIntValueArg(intValue(-1))).toBe(-1);
});

test("value accessors duplicate and steal their contents", () => {
    const string = stringValue("dup");
    expect(string.dupString()).toBe("dup");
    expect(string.getString()).toBe("dup");
    expect(string.stealString()).toBe("dup");
    expect(string.getString()).toBeNull();

    const object = GIMarshallingTests.Object.new(5);
    const holdsObject = objectValue(object);
    expect(holdsObject.getObject()).toBe(object);
    expect(holdsObject.dupObject()).toBe(object);

    const variant = GLib.Variant.newInt32(3);
    const holdsVariant = variantValue(variant);
    expect(holdsVariant.getVariant()?.getInt32()).toBe(3);
    expect(holdsVariant.dupVariant()?.getInt32()).toBe(3);

    const boxed = Regress.TestBoxed.newAlternativeConstructor1(11);
    const holdsBoxed = boxedValue(boxed);
    expect(holdsBoxed.getBoxed<Regress.TestBoxed>().someInt8).toBe(11);
});

test("values unset and re-initialize to another type", () => {
    const value = intValue(5);
    expect(value.fitsPointer()).toBe(false);
    expect(value.getInt()).toBe(5);

    value.unset();
    value.init(named("gchararray"));
    value.setString("again");
    expect(value.getString()).toBe("again");
    expect(GIMarshallingTests.gvalueRoundTrip(value)).toBe("again");

    value.unset();
    value.init(named("gboolean"));
    value.setBoolean(true);
    expect(value.getBoolean()).toBe(true);
    expect(GIMarshallingTests.gvalueRoundTrip(value)).toBe(true);
});

test("reset hands the value back without giving it a second owner", async () => {
    const value = stringValue("again");
    value.reset();
    await drainGC();
    expect(value.getString()).toBeNull();

    value.setString("twice");
    expect(value.getString()).toBe("twice");
    value.reset();
    value.setString("thrice");
    expect(value.getString()).toBe("thrice");
    expect(GIMarshallingTests.gvalueRoundTrip(value)).toBe("thrice");
});

test("reset leaves a refcounted payload reachable through the same value", async () => {
    const object = GIMarshallingTests.Object.new(42);
    const holdsObject = objectValue(object);
    holdsObject.reset();
    await drainGC();
    expect(holdsObject.getObject()).toBeNull();

    holdsObject.setObject(object);
    expect(holdsObject.getObject()).toBe(object);
    expect(GIMarshallingTests.gvalueRoundTrip(holdsObject)).toBe(object);
});

test("values copy and transform between compatible types", () => {
    const source = intValue(42);
    const destination = new GObject.Value();
    destination.init(named("gint"));
    source.copy(destination);
    expect(destination.getInt()).toBe(42);

    const asDouble = new GObject.Value();
    asDouble.init(named("gdouble"));
    expect(source.transform(asDouble)).toBe(true);
    expect(asDouble.getDouble()).toBe(42);

    const asString = new GObject.Value();
    asString.init(named("gchararray"));
    expect(source.transform(asString)).toBe(true);
    expect(asString.getString()).toBe("42");

    const asObject = new GObject.Value();
    asObject.init(named("GObject"));
    expect(stringValue("nope").transform(asObject)).toBe(false);

    expect(GObject.Value.typeCompatible(named("gint"), named("gint"))).toBe(true);
    expect(GObject.Value.typeCompatible(named("gint"), named("gchararray"))).toBe(false);
    expect(GObject.Value.typeTransformable(named("gint"), named("gchararray"))).toBe(true);
    expect(GObject.Value.typeTransformable(named("gchararray"), named("GObject"))).toBe(false);
});

test("gvalue params reject values no gtype can be inferred from", () => {
    // @ts-expect-error a symbol carries no gtype
    expect(() => Regress.testIntValueArg(Symbol("nope"))).toThrow();
    // @ts-expect-error a plain object carries no gtype
    expect(() => Regress.testIntValueArg({})).toThrow();
    // @ts-expect-error a function carries no gtype
    expect(() => Regress.testIntValueArg(() => 42)).toThrow();
    expect(() => Regress.testIntValueArg(2n ** 65n)).toThrow();
    expect(() => {
        // @ts-expect-error a symbol carries no gtype
        GIMarshallingTests.gvalueFlatArray([Symbol("nope"), "42", true]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object carries no gtype
        GIMarshallingTests.gvalueFlatArray([{}, "42", true]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a function carries no gtype
        GIMarshallingTests.gvalueFlatArray([() => 1, "42", true]);
    }).toThrow();
});

test("strict gvalue params reject plain js values", () => {
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no plain number
        GIMarshallingTests.gvalueIn(42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no plain object
        GIMarshallingTests.gvalueIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no symbol
        GIMarshallingTests.gvalueIn(Symbol("nope"));
    }).toThrow();
    // @ts-expect-error a strict gvalue param takes no plain string
    expect(() => GIMarshallingTests.gvalueRoundTrip("plain")).toThrow();
    // @ts-expect-error a strict gvalue param takes no plain number
    expect(() => GIMarshallingTests.gvalueCopy(42)).toThrow();
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no plain number
        GIMarshallingTests.gvalueInWithModification(42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no plain number
        GIMarshallingTests.gvalueInEnum(42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no plain number
        GIMarshallingTests.gvalueInFlags(4);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a strict gvalue param takes no plain bigint
        GIMarshallingTests.gvalueInt64In(2n ** 63n - 1n);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a gtype argument is not a type name
        GIMarshallingTests.gvalueInWithType(intValue(1), "gint");
    }).toThrow();
});

test("value setters reject payloads of the wrong type or range", () => {
    expect(() => {
        const value = new GObject.Value();
        // @ts-expect-error a gtype argument is not a type name
        value.init("gint");
    }).toThrow();
    expect(() => intValue(1.5)).toThrow();
    expect(() => intValue(2 ** 40)).toThrow();
    // @ts-expect-error an int payload is not a string
    expect(() => intValue("42")).toThrow();
    expect(() => ucharValue(256)).toThrow();
    // @ts-expect-error an int64 payload is not a symbol
    expect(() => int64Value(Symbol("nope"))).toThrow();
    expect(() => buildValue(named("GObject"), (value) => {
        // @ts-expect-error a gobject payload is not a plain object
        value.setObject({});
    })).toThrow();
    // @ts-expect-error an enum payload is not a symbol
    expect(() => enumValue(Symbol("nope"))).toThrow();
    // @ts-expect-error a boxed payload is not a symbol
    expect(() => boxedValue(Symbol("nope"))).toThrow();
});
