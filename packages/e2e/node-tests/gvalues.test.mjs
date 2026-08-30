import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { resolveType } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest } from "./helpers/memory.mjs";

drainAfterEachTest();

const buildValue = (type, fill) => {
    const value = new GObject.Value();
    value.init(type);
    fill(value);

    return value;
};

const named = (name) => GObject.typeFromName(name);
const genumType = () => resolveType("libgimarshallingtests.so", "gi_marshalling_tests_genum_get_type");
const flagsType = () => resolveType("libgimarshallingtests.so", "gi_marshalling_tests_flags_get_type");
const fixtureFloat = 314 / 100;

const intValue = (n) => buildValue(named("gint"), (value) => value.setInt(n));
const uintValue = (n) => buildValue(named("guint"), (value) => value.setUint(n));
const scharValue = (n) => buildValue(named("gchar"), (value) => value.setSchar(n));
const ucharValue = (n) => buildValue(named("guchar"), (value) => value.setUchar(n));
const int64Value = (n) => buildValue(named("gint64"), (value) => value.setInt64(n));
const uint64Value = (n) => buildValue(named("guint64"), (value) => value.setUint64(n));
const longValue = (n) => buildValue(named("glong"), (value) => value.setLong(n));
const ulongValue = (n) => buildValue(named("gulong"), (value) => value.setUlong(n));
const floatValue = (n) => buildValue(named("gfloat"), (value) => value.setFloat(n));
const doubleValue = (n) => buildValue(named("gdouble"), (value) => value.setDouble(n));
const booleanValue = (b) => buildValue(named("gboolean"), (value) => value.setBoolean(b));
const stringValue = (s) => buildValue(named("gchararray"), (value) => value.setString(s));
const gtypeValue = (type) => buildValue(named("GType"), (value) => value.setGtype(type));
const variantValue = (v) => buildValue(named("GVariant"), (value) => value.setVariant(v));
const objectValue = (o) => buildValue(GIMarshallingTests.Object, (value) => value.setObject(o));
const enumValue = (v) => buildValue(genumType(), (value) => value.setEnum(v));
const flagsValue = (v) => buildValue(flagsType(), (value) => value.setFlags(v));
const boxedValue = (b) => buildValue(Regress.TestBoxed, (value) => value.setBoxed(b));

test("gvalue returns and out params carry their C values", () => {
    assert.equal(GIMarshallingTests.gvalueReturn(), 42);
    assert.equal(GIMarshallingTests.gvalueOut().getInt(), 42);
    assert.equal(GIMarshallingTests.gvalueInt64Out().getInt64(), 2n ** 63n - 1n);
    assert.equal(GIMarshallingTests.gvalueOutCallerAllocates(), 42);
    assert.deepEqual(GIMarshallingTests.gvalueOutUninitialized(), [false, null]);
    assert.ok(Number.isNaN(GIMarshallingTests.gvalueNoncanonicalNanFloat()));
    assert.ok(Number.isNaN(GIMarshallingTests.gvalueNoncanonicalNanDouble()));
    assert.equal(Regress.testValueReturn(17), 17);
});

test("each borrowed gvalue out param decodes into its own wrapper", () => {
    const first = GIMarshallingTests.gvalueOut();
    const second = GIMarshallingTests.gvalueOut();
    assert.ok(first instanceof GObject.Value);
    assert.ok(second instanceof GObject.Value);
    assert.notEqual(first, second);
    assert.equal(first.getInt(), second.getInt());
    assert.equal(GIMarshallingTests.gvalueInt64Out().getInt64(), GIMarshallingTests.gvalueInt64Out().getInt64());
});

test("gvalue in params accept built values holding the expected payload", () => {
    GIMarshallingTests.gvalueIn(intValue(42));
    GIMarshallingTests.gvalueInt64In(int64Value(2n ** 63n - 1n));
    GIMarshallingTests.gvalueFloat(floatValue(fixtureFloat), doubleValue(fixtureFloat));
    assert.equal(Regress.testIntValueArg(intValue(42)), 42);
});

test("plain js values marshal into gvalue params by type inference", () => {
    assert.equal(Regress.testIntValueArg(42), 42);
    GIMarshallingTests.gvalueFlatArray([42, "42", true]);
    GIMarshallingTests.gvalueFloat(floatValue(fixtureFloat), fixtureFloat);
});

test("gvalue round trips preserve each fundamental type", () => {
    const gint = named("gint");
    assert.equal(GIMarshallingTests.gvalueRoundTrip(intValue(42)), 42);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(booleanValue(true)), true);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(booleanValue(false)), false);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(scharValue(-128)), -128);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(ucharValue(255)), 255);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(uintValue(4_294_967_295)), 4_294_967_295);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(floatValue(0.5)), 0.5);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(doubleValue(2.5)), 2.5);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(int64Value(-(2n ** 63n))), -(2n ** 63n));
    assert.equal(GIMarshallingTests.gvalueRoundTrip(uint64Value(2n ** 64n - 1n)), 2n ** 64n - 1n);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(longValue(-9n)), -9n);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(ulongValue(9n)), 9n);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(stringValue("gtkx")), "gtkx");
    assert.equal(GIMarshallingTests.gvalueRoundTrip(gtypeValue(gint)), gint);
});

test("gvalue round trips preserve objects enums flags variants and boxed payloads", () => {
    const object = GIMarshallingTests.Object.new(42);
    const objectBack = GIMarshallingTests.gvalueRoundTrip(objectValue(object));
    assert.equal(objectBack, object);
    assert.equal(objectBack.int, 42);

    const enumBack = GIMarshallingTests.gvalueRoundTrip(enumValue(GIMarshallingTests.GEnum.VALUE3));
    assert.equal(enumBack, 42);

    const flagsBack = GIMarshallingTests.gvalueRoundTrip(flagsValue(GIMarshallingTests.Flags.VALUE3));
    assert.equal(flagsBack, 4);

    const variant = GLib.Variant.newInt32(7);
    const variantBack = GIMarshallingTests.gvalueRoundTrip(variantValue(variant));
    assert.equal(variantBack.getInt32(), 7);

    const boxed = Regress.TestBoxed.newAlternativeConstructor1(42);
    const boxedBack = GIMarshallingTests.gvalueRoundTrip(boxedValue(boxed));
    assert.ok(boxedBack instanceof Regress.TestBoxed);
    assert.equal(boxedBack.someInt8, 42);
    assert.notEqual(boxedBack, boxed);
});

test("gvalue copy hands back an independent value with the same payload", () => {
    assert.equal(GIMarshallingTests.gvalueCopy(intValue(42)), 42);
    assert.equal(GIMarshallingTests.gvalueCopy(stringValue("copy me")), "copy me");
    assert.equal(GIMarshallingTests.gvalueCopy(doubleValue(-1.5)), -1.5);

    const source = intValue(42);
    assert.equal(GIMarshallingTests.gvalueCopy(source), 42);
    assert.equal(source.getInt(), 42);
});

test("gvalue modification through a pointer is visible on the wrapper", () => {
    const value = intValue(42);
    GIMarshallingTests.gvalueInWithModification(value);
    assert.equal(value.getInt(), 24);
});

test("typed gvalues match their declared gtype", () => {
    GIMarshallingTests.gvalueInWithType(intValue(1), named("gint"));
    GIMarshallingTests.gvalueInWithType(stringValue("typed"), named("gchararray"));

    const object = GIMarshallingTests.Object.new(1);
    const holdsObject = objectValue(object);
    GIMarshallingTests.gvalueInWithType(holdsObject, GIMarshallingTests.Object);
    GIMarshallingTests.gvalueInWithType(holdsObject, GObject.Object);
    assert.equal(holdsObject.getObject(), object);

    const boxed = Regress.TestBoxed.newAlternativeConstructor1(3);
    const holdsBoxed = boxedValue(boxed);
    GIMarshallingTests.gvalueInWithType(holdsBoxed, Regress.TestBoxed);
    assert.equal(holdsBoxed.getBoxed().someInt8, 3);

    const holdsEnum = enumValue(GIMarshallingTests.GEnum.VALUE3);
    GIMarshallingTests.gvalueInEnum(holdsEnum);
    assert.equal(holdsEnum.getEnum(), GIMarshallingTests.GEnum.VALUE3);

    const holdsFlags = flagsValue(GIMarshallingTests.Flags.VALUE3);
    GIMarshallingTests.gvalueInFlags(holdsFlags);
    assert.equal(holdsFlags.getFlags(), GIMarshallingTests.Flags.VALUE3);
});

test("flat gvalue array returns expose each element", () => {
    const fixed = GIMarshallingTests.returnGvalueFlatArray();
    assert.equal(fixed.length, 3);
    assert.equal(fixed[0].getInt(), 42);
    assert.equal(fixed[1].getString(), "42");
    assert.equal(fixed[2].getBoolean(), true);

    const zeroTerminated = GIMarshallingTests.returnGvalueZeroTerminatedArray();
    assert.equal(zeroTerminated.length, 3);
    assert.equal(zeroTerminated[0].getInt(), 42);
    assert.equal(zeroTerminated[1].getString(), "42");
    assert.equal(zeroTerminated[2].getBoolean(), true);
});

test("flat gvalue array arguments accept built values", () => {
    const values = [intValue(42), stringValue("42"), booleanValue(true)];
    GIMarshallingTests.gvalueFlatArray(values);
    assert.equal(values[0].getInt(), 42);
    assert.equal(values[1].getString(), "42");
    assert.equal(values[2].getBoolean(), true);

    GIMarshallingTests.gvalueFlatArray([intValue(42), "42", true]);
});

test("regress gvalue helpers return their documented payloads", () => {
    const date = Regress.testDateInGvalue();
    assert.equal(date.getDay(), 5);
    assert.equal(date.getMonth(), 12);
    assert.equal(date.getYear(), 1984);

    const boxed = Regress.testGvalueOutBoxed(7);
    assert.ok(boxed instanceof Regress.TestBoxed);
    assert.equal(boxed.someInt8, 7);
    assert.equal(Regress.testGvalueOutBoxed(0).someInt8, 0);

    assert.equal(Regress.testValueReturn(-1), -1);
    assert.equal(Regress.testIntValueArg(intValue(-1)), -1);
});

test("value accessors duplicate and steal their contents", () => {
    const string = stringValue("dup");
    assert.equal(string.dupString(), "dup");
    assert.equal(string.getString(), "dup");
    assert.equal(string.stealString(), "dup");
    assert.equal(string.getString(), null);

    const object = GIMarshallingTests.Object.new(5);
    const holdsObject = objectValue(object);
    assert.equal(holdsObject.getObject(), object);
    assert.equal(holdsObject.dupObject(), object);

    const variant = GLib.Variant.newInt32(3);
    const holdsVariant = variantValue(variant);
    assert.equal(holdsVariant.getVariant().getInt32(), 3);
    assert.equal(holdsVariant.dupVariant().getInt32(), 3);

    const boxed = Regress.TestBoxed.newAlternativeConstructor1(11);
    const holdsBoxed = boxedValue(boxed);
    assert.equal(holdsBoxed.getBoxed().someInt8, 11);
});

test("values unset and re-initialize to another type", () => {
    const value = intValue(5);
    assert.equal(value.fitsPointer(), false);
    assert.equal(value.getInt(), 5);

    value.unset();
    value.init(named("gchararray"));
    value.setString("again");
    assert.equal(value.getString(), "again");
    assert.equal(GIMarshallingTests.gvalueRoundTrip(value), "again");

    value.unset();
    value.init(named("gboolean"));
    value.setBoolean(true);
    assert.equal(value.getBoolean(), true);
    assert.equal(GIMarshallingTests.gvalueRoundTrip(value), true);
});

test("values copy and transform between compatible types", () => {
    const source = intValue(42);
    const destination = new GObject.Value();
    destination.init(named("gint"));
    source.copy(destination);
    assert.equal(destination.getInt(), 42);

    const asDouble = new GObject.Value();
    asDouble.init(named("gdouble"));
    assert.equal(source.transform(asDouble), true);
    assert.equal(asDouble.getDouble(), 42);

    const asString = new GObject.Value();
    asString.init(named("gchararray"));
    assert.equal(source.transform(asString), true);
    assert.equal(asString.getString(), "42");

    const asObject = new GObject.Value();
    asObject.init(named("GObject"));
    assert.equal(stringValue("nope").transform(asObject), false);

    assert.equal(GObject.Value.typeCompatible(named("gint"), named("gint")), true);
    assert.equal(GObject.Value.typeCompatible(named("gint"), named("gchararray")), false);
    assert.equal(GObject.Value.typeTransformable(named("gint"), named("gchararray")), true);
    assert.equal(GObject.Value.typeTransformable(named("gchararray"), named("GObject")), false);
});

test("gvalue params reject values no gtype can be inferred from", () => {
    assert.throws(() => Regress.testIntValueArg(Symbol("nope")));
    assert.throws(() => Regress.testIntValueArg({}));
    assert.throws(() => Regress.testIntValueArg(() => 42));
    assert.throws(() => Regress.testIntValueArg(2n ** 65n));
    assert.throws(() => GIMarshallingTests.gvalueFlatArray([Symbol("nope"), "42", true]));
    assert.throws(() => GIMarshallingTests.gvalueFlatArray([{}, "42", true]));
    assert.throws(() => GIMarshallingTests.gvalueFlatArray([() => 1, "42", true]));
});

test("strict gvalue params reject plain js values", () => {
    assert.throws(() => GIMarshallingTests.gvalueIn(42));
    assert.throws(() => GIMarshallingTests.gvalueIn({}));
    assert.throws(() => GIMarshallingTests.gvalueIn(Symbol("nope")));
    assert.throws(() => GIMarshallingTests.gvalueRoundTrip("plain"));
    assert.throws(() => GIMarshallingTests.gvalueCopy(42));
    assert.throws(() => GIMarshallingTests.gvalueInWithModification(42));
    assert.throws(() => GIMarshallingTests.gvalueInEnum(42));
    assert.throws(() => GIMarshallingTests.gvalueInFlags(4));
    assert.throws(() => GIMarshallingTests.gvalueInt64In(2n ** 63n - 1n));
    assert.throws(() => GIMarshallingTests.gvalueInWithType(intValue(1), "gint"));
});

test("value setters reject payloads of the wrong type or range", () => {
    assert.throws(() => {
        const value = new GObject.Value();
        value.init("gint");
    });
    assert.throws(() => intValue(1.5));
    assert.throws(() => intValue(2 ** 40));
    assert.throws(() => intValue("42"));
    assert.throws(() => ucharValue(256));
    assert.throws(() => int64Value(Symbol("nope")));
    assert.throws(() => buildValue(named("GObject"), (value) => value.setObject({})));
    assert.throws(() => enumValue(Symbol("nope")));
    assert.throws(() => boxedValue(Symbol("nope")));
});
