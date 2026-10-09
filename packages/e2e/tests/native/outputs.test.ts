import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import { toClosure, wrapHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";

test("multiple outputs retain their declared order", () => {
    expect(GIMarshallingTests.intOutOut()).toEqual([6, 7]);
    expect(GIMarshallingTests.intReturnOut()).toEqual([6, 7]);
    expect(GIMarshallingTests.intThreeInThreeOut(1, 2, 3)).toEqual([1, 2, 3]);
    expect(Regress.testMultiDoubleArgs(1.5)).toEqual([3, 4.5]);
    expect(GIMarshallingTests.int64InoutMinMax(-(2n ** 63n))).toBe(2n ** 63n - 1n);
});

test("GType arguments, outputs and inout values retain their identity", () => {
    GIMarshallingTests.gtypeIn(GObject.TYPE_NONE);
    GIMarshallingTests.gtypeStringIn(GObject.TYPE_STRING);
    expect(GIMarshallingTests.gtypeOut()).toBe(GObject.TYPE_NONE);
    expect(GIMarshallingTests.gtypeStringOut()).toBe(GObject.TYPE_STRING);
    expect(GIMarshallingTests.gtypeOutUninitialized()).toEqual([false, 0n]);
    expect(GIMarshallingTests.gtypeInout(GObject.TYPE_NONE)).toBe(GObject.TYPE_INT);
    expect(Regress.testGtype(GObject.TYPE_STRING)).toBe(GObject.TYPE_STRING);
});

test("nullable parameters preserve their positions among required parameters", () => {
    GIMarshallingTests.intTwoInUtf8TwoInWithAllowNone(1, 2, "3", "4");
    GIMarshallingTests.intTwoInUtf8TwoInWithAllowNone(1, 2, null, null);
    GIMarshallingTests.intOneInUtf8TwoInOneAllowsNone(1, "2", "3");
    GIMarshallingTests.intOneInUtf8TwoInOneAllowsNone(1, null, "3");
    expect(() => GIMarshallingTests.intOneInUtf8TwoInOneAllowsNone(1, null, "a\0b")).toThrow();
});

test("uninitialized enum and flags outputs have a deterministic zero value", () => {
    expect(GIMarshallingTests.flagsOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.genumOutUninitialized()).toEqual([false, 0]);
});

test("upstream closures invoke JavaScript and return native closures", () => {
    const constant = wrapHandle(
        toClosure(() => 42),
        GObject.Closure,
    );
    const increment = wrapHandle(
        toClosure((value: number) => value + 1),
        GObject.Closure,
    );
    GIMarshallingTests.gclosureIn(constant);
    expect(Regress.testClosure(constant)).toBe(42);
    expect(Regress.testClosureOneArg(increment, 41)).toBe(42);
    expect(Regress.testClosure(GIMarshallingTests.gclosureReturn())).toBe(42);
});

test("a closure returns the variant received through its native argument", () => {
    const closure = wrapHandle(
        toClosure((value: GLib.Variant) => value),
        GObject.Closure,
    );
    const value = new GLib.Variant("s", "through closure");
    expect(Regress.testClosureVariant(closure, value).unpack()).toBe("through closure");
});

test("floating point and uninitialized record outputs decode their native values", () => {
    expect(GIMarshallingTests.floatOut()).toBe(GIMarshallingTests.floatReturn());
    expect(GIMarshallingTests.doubleOut()).toBe(GIMarshallingTests.doubleReturn());
    expect(GIMarshallingTests.arrayFixedOutStructUninitialized()).toEqual([false, null]);
    expect(Regress.testBooleanTrue(true)).toBe(true);
    expect(Regress.testBooleanFalse(false)).toBe(false);
    expect(Regress.testTortureSignature0(3, "café", 2)).toEqual([3, 6, 6]);
});

test.each([
    {
        name: "gid_t",
        value: 65_534,
        input: GIMarshallingTests.gidTIn,
        output: GIMarshallingTests.gidTOut,
        returned: GIMarshallingTests.gidTReturn,
        inout: GIMarshallingTests.gidTInout,
    },
    {
        name: "uid_t",
        value: 65_534,
        input: GIMarshallingTests.uidTIn,
        output: GIMarshallingTests.uidTOut,
        returned: GIMarshallingTests.uidTReturn,
        inout: GIMarshallingTests.uidTInout,
    },
    {
        name: "pid_t",
        value: 12_345,
        input: GIMarshallingTests.pidTIn,
        output: GIMarshallingTests.pidTOut,
        returned: GIMarshallingTests.pidTReturn,
        inout: GIMarshallingTests.pidTInout,
    },
])("$name scalar aliases preserve input, return, output and inout values", (scalar) => {
    scalar.input(scalar.value);
    expect(scalar.output()).toBe(scalar.value);
    expect(scalar.returned()).toBe(scalar.value);
    expect(scalar.inout(scalar.value)).toBe(0);
});

test("time values retain their bigint representation", () => {
    expect(GIMarshallingTests.timeTOut()).toBe(1_234_567_890n);
    expect(GIMarshallingTests.timeTReturn()).toBe(1_234_567_890n);
    expect(Regress.testTimet(1_234_567_890n)).toBe(1_234_567_890n);
});

test("size aliases reject imprecise numeric boundary inputs", () => {
    expect(() => GIMarshallingTests.sizeInout(2 ** 64)).toThrow();
    expect(() => GIMarshallingTests.ssizeInMin(-(2 ** 63))).toThrow();
    expect(() => GIMarshallingTests.ssizeInoutMinMax(-(2 ** 63))).toThrow();
    expect(() => GIMarshallingTests.ssizeInoutMaxMin(2 ** 63)).toThrow();
});

test("upstream async functions complete through their generated finish binding", async () => {
    const pending = Regress.testFunctionAsync(0);
    expect(Regress.testFunctionThawAsync()).toBe(1);
    await expect(pending).resolves.toBe(true);
    expect(Regress.testFunctionSync(0)).toBe(true);
});
