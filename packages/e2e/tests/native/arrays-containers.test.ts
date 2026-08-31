import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

const intValue = (contents: number): GObject.Value => {
    const value = new GObject.Value();

    value.init(GObject.typeFromName("gint"));
    value.setInt(contents);

    return value;
};

test("GArray of ints and 64-bit ints round trips", () => {
    expect(GIMarshallingTests.garrayIntNoneReturn()).toEqual([-1, 0, 1, 2]);
    GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, 2]);
    expect(GIMarshallingTests.garrayUint64NoneReturn()).toEqual([0n, 2n ** 64n - 1n]);
    GIMarshallingTests.garrayUint64NoneIn([0n, 2n ** 64n - 1n]);
});

test("GArray marshals enum, boolean and unichar elements", () => {
    expect(GIMarshallingTests.garrayEnumNoneReturn()).toEqual([
        GIMarshallingTests.GEnum.VALUE1,
        GIMarshallingTests.GEnum.VALUE2,
        GIMarshallingTests.GEnum.VALUE3,
    ]);
    GIMarshallingTests.garrayBoolNoneIn([true, false, true, true]);
    GIMarshallingTests.garrayUnicharNoneIn(["c", "o", "n", "s", "t", " ", "♥", " ", "u", "t", "f", "8"]);
});

test("GArray of strings round trips across transfer modes", () => {
    expect(GIMarshallingTests.garrayUtf8NoneReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.garrayUtf8ContainerReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.garrayUtf8FullReturn()).toEqual(["0", "1", "2"]);
    GIMarshallingTests.garrayUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.garrayUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.garrayUtf8FullIn(["0", "1", "2"]);
    expect(GIMarshallingTests.garrayUtf8NoneOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.garrayUtf8ContainerOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.garrayUtf8FullOut()).toEqual(["0", "1", "2"]);
});

test("GPtrArray of strings round trips across transfer modes", () => {
    expect(GIMarshallingTests.gptrarrayUtf8NoneReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gptrarrayUtf8ContainerReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gptrarrayUtf8FullReturn()).toEqual(["0", "1", "2"]);
    GIMarshallingTests.gptrarrayUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.gptrarrayUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.gptrarrayUtf8FullIn(["0", "1", "2"]);
    expect(GIMarshallingTests.gptrarrayUtf8NoneOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gptrarrayUtf8ContainerOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gptrarrayUtf8FullOut()).toEqual(["0", "1", "2"]);
});

test("GPtrArray string arguments survive repetition across transfer modes", () => {
    const strings = ["0", "1", "2"];

    for (let round = 0; round < 100; round += 1) {
        GIMarshallingTests.gptrarrayUtf8NoneIn(strings);
        GIMarshallingTests.gptrarrayUtf8ContainerIn(strings);
        GIMarshallingTests.gptrarrayUtf8FullIn(strings);
    }

    expect(strings).toEqual(["0", "1", "2"]);
});

test("GPtrArray slots also take boxed values and 64-bit words", () => {
    const values = [intValue(42), intValue(43)];

    Regress.annotationPtrArray(values);
    Regress.annotationPtrArray([]);
    Regress.introspectableViaAlias([0n, 1n, 2n ** 64n - 1n]);
    Regress.introspectableViaAlias([]);

    expect(values.map((value) => value.getInt())).toEqual([42, 43]);
});

test("GPtrArray of boxed structs returns element values", () => {
    const structs = GIMarshallingTests.gptrarrayBoxedStructFullReturn();
    expect(structs).toHaveLength(3);
    expect(structs[0] instanceof GIMarshallingTests.BoxedStruct).toBeTruthy();
    expect(structs.map((value) => value.long)).toEqual([42n, 43n, 44n]);
});

test("GArray of boxed structs copies its inline elements out of the container", () => {
    const structs = GIMarshallingTests.garrayBoxedStructFullReturn();
    expect(structs).toHaveLength(3);
    expect(structs[0] instanceof GIMarshallingTests.BoxedStruct).toBeTruthy();
    expect(structs.map((value) => value.long)).toEqual([42n, 43n, 44n]);

    (structs[0] as GIMarshallingTests.BoxedStruct).long = 7n;
    expect(structs.map((value) => value.long)).toEqual([7n, 43n, 44n]);
});

test("GArray boxed struct copies outlive the transfer-full container", async () => {
    const structs = GIMarshallingTests.garrayBoxedStructFullReturn();

    await drainGC();

    expect(structs.map((value) => value.long)).toEqual([42n, 43n, 44n]);
});

test("GByteArray carries binary data both ways", () => {
    const bytes = GIMarshallingTests.bytearrayFullReturn();
    expect(bytes instanceof Uint8Array).toBeTruthy();
    expect(bytes).toEqual(new Uint8Array([0, 49, 0xFF, 51]));
    expect(GIMarshallingTests.bytearrayFullOut()).toEqual(new Uint8Array([0, 49, 0xFF, 51]));
    GIMarshallingTests.bytearrayNoneIn(bytes);
    GIMarshallingTests.bytearrayNoneIn([0, 49, 0xFF, 51]);
});

test("GBytes round trips as a boxed value", () => {
    const bytes = GIMarshallingTests.gbytesFullReturn();
    expect(bytes.getSize()).toBe(4);
    expect(bytes.getData()).toEqual(new Uint8Array([0, 49, 0xFF, 51]));
    GIMarshallingTests.gbytesNoneIn(bytes);
    GIMarshallingTests.gbytesNoneIn(GLib.Bytes.new([0, 49, 0xFF, 51]));
});

test("GList and GSList of integers round trip through their pointer slots", () => {
    GIMarshallingTests.glistIntNoneIn([-1, 0, 1, 2]);
    GIMarshallingTests.gslistIntNoneIn([-1, 0, 1, 2]);
    GIMarshallingTests.glistUint32NoneIn([0, 0xFF_FF_FF_FF]);
    expect(GIMarshallingTests.glistIntNoneReturn()).toEqual([-1, 0, 1, 2]);
    expect(GIMarshallingTests.gslistIntNoneReturn()).toEqual([-1, 0, 1, 2]);
    expect(GIMarshallingTests.glistUint32NoneReturn()).toEqual([0, 0xFF_FF_FF_FF]);
});

test("GList of strings round trips across transfer modes", () => {
    expect(GIMarshallingTests.glistUtf8NoneReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.glistUtf8ContainerReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.glistUtf8FullReturn()).toEqual(["0", "1", "2"]);
    GIMarshallingTests.glistUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.glistUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.glistUtf8FullIn(["0", "1", "2"]);
    expect(GIMarshallingTests.glistUtf8NoneOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.glistUtf8ContainerOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.glistUtf8FullOut()).toEqual(["0", "1", "2"]);
});

test("GSList of strings round trips across transfer modes", () => {
    expect(GIMarshallingTests.gslistUtf8NoneReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gslistUtf8ContainerReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gslistUtf8FullReturn()).toEqual(["0", "1", "2"]);
    GIMarshallingTests.gslistUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.gslistUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.gslistUtf8FullIn(["0", "1", "2"]);
    expect(GIMarshallingTests.gslistUtf8NoneOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gslistUtf8ContainerOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gslistUtf8FullOut()).toEqual(["0", "1", "2"]);
});

test("uninitialized out containers report failure and yield empty arrays", () => {
    expect(GIMarshallingTests.garrayUtf8NoneOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.garrayUtf8ContainerOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.garrayUtf8FullOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.gptrarrayUtf8NoneOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.gptrarrayUtf8ContainerOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.gptrarrayUtf8FullOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.glistUtf8NoneOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.glistUtf8ContainerOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.glistUtf8FullOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.gslistUtf8NoneOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.gslistUtf8ContainerOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.gslistUtf8FullOutUninitialized()).toEqual([false, []]);
});

test("Regress GList returns the test sequence across transfer modes", () => {
    expect(Regress.testGlistNothingReturn()).toEqual(["1", "2", "3"]);
    expect(Regress.testGlistNothingReturn2()).toEqual(["1", "2", "3"]);
    expect(Regress.testGlistContainerReturn()).toEqual(["1", "2", "3"]);
    expect(Regress.testGlistEverythingReturn()).toEqual(["1", "2", "3"]);
    Regress.testGlistNothingIn(["1", "2", "3"]);
    Regress.testGlistNothingIn2(["1", "2", "3"]);
});

test("Regress GSList returns the test sequence across transfer modes", () => {
    expect(Regress.testGslistNothingReturn()).toEqual(["1", "2", "3"]);
    expect(Regress.testGslistNothingReturn2()).toEqual(["1", "2", "3"]);
    expect(Regress.testGslistContainerReturn()).toEqual(["1", "2", "3"]);
    expect(Regress.testGslistEverythingReturn()).toEqual(["1", "2", "3"]);
    Regress.testGslistNothingIn(["1", "2", "3"]);
    Regress.testGslistNothingIn2(["1", "2", "3"]);
});

test("null and empty lists marshal as null pointers", () => {
    Regress.testGlistNullIn(null);
    Regress.testGlistNullIn([]);
    expect(Regress.testGlistNullOut()).toEqual([]);
    Regress.testGslistNullIn(null);
    Regress.testGslistNullIn([]);
    expect(Regress.testGslistNullOut()).toEqual([]);
});

test("GType lists accept wrapper classes with container transfer", () => {
    const types = [Regress.TestObj, Regress.TestSubObj];
    Regress.testGlistGtypeContainerIn(types);
    expect(Regress.testArrayGtypeIn(types)).toBe("[RegressTestObj,RegressTestSubObj,]");
});

test("boxed element lists round trip across transfer modes", () => {
    const none = Regress.testGlistBoxedNoneReturn(2);
    expect(none).toHaveLength(2);
    expect(none.map((value) => value.anotherThing)).toEqual([42, 42]);
    const full = Regress.testGlistBoxedFullReturn(2);
    expect(full).toHaveLength(2);
    expect(full.map((value) => value.anotherThing)).toEqual([42, 42]);
    expect(full[0] instanceof Regress.TestBoxedC).toBeTruthy();
});

test("container arguments reject non-array values", () => {
    expect(() => {
        // @ts-expect-error a string is not an int array
        GIMarshallingTests.garrayIntNoneIn("nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a string list
        GIMarshallingTests.glistUtf8NoneIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a string array
        GIMarshallingTests.gptrarrayUtf8NoneIn(123);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a string list
        GIMarshallingTests.gslistUtf8NoneIn(Symbol("nope"));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a byte array
        GIMarshallingTests.bytearrayNoneIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a byte array
        GIMarshallingTests.bytearrayNoneIn("0123");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a GBytes
        GIMarshallingTests.gbytesNoneIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a GBytes
        GIMarshallingTests.gbytesNoneIn("bytes");
    }).toThrow();
});

test("container elements of the wrong type throw before the call", () => {
    expect(() => {
        // @ts-expect-error a string is not an int element
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, "2"]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayUint64NoneIn([0n, -1n]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a utf8 element
        GIMarshallingTests.garrayUtf8NoneIn(["0", "1", 2]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a boolean element
        GIMarshallingTests.garrayBoolNoneIn([true, 0, true, true]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayUnicharNoneIn(["co", "n", "s", "t", " ", "♥", " ", "u", "t", "f", "8", "x"]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a utf8 element
        GIMarshallingTests.garrayUtf8FullIn(["0", "1", 2]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a boolean is not a utf8 element
        GIMarshallingTests.gptrarrayUtf8FullIn(["0", false, "2"]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a utf8 element
        GIMarshallingTests.gptrarrayUtf8NoneIn([1, 2, 3]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a utf8 element
        GIMarshallingTests.gptrarrayUtf8ContainerIn([{}, {}, {}]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a utf8 element
        GIMarshallingTests.glistUtf8FullIn(["0", {}, "2"]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a utf8 element
        GIMarshallingTests.gslistUtf8FullIn(["0", Symbol("x"), "2"]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.glistIntNoneIn([-1, 0, 1, 2.5]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.gslistIntNoneIn([-1, 0, 2 ** 53, 2]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.glistUint32NoneIn([0.5, 0xFF_FF_FF_FF]);
    }).toThrow();
});

test("GArray integer elements reject fractional and out-of-range values", () => {
    expect(() => {
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, 2.5]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, 2 ** 53]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, 2 ** 31]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, -(2 ** 31) - 1]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, NaN]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, Infinity]);
    }).toThrow();
});
