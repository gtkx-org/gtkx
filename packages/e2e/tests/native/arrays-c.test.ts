import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const UNICHARS = ["c", "o", "n", "s", "t", " ", "♥", " ", "u", "t", "f", "8"];

const unalignedPattern = Array.from({ length: 32 }, (_, index) => (index + 1) % 8);

test("variable-length int arrays pass with the length in any position", () => {
    GIMarshallingTests.arrayIn([-1, 0, 1, 2]);
    GIMarshallingTests.arrayInLenBefore([-1, 0, 1, 2]);
    GIMarshallingTests.arrayInGuint64Len([-1, 0, 1, 2]);
    GIMarshallingTests.arrayInGuint8Len([-1, 0, 1, 2]);
    expect(Regress.testArrayIntIn([1, 2, 3, 4])).toBe(10);
    Regress.testArrayStaticInInt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("a length-bounded array annotated zero-terminated carries its terminator", () => {
    const ints = [-1, 0, 1, 2];

    for (let round = 0; round < 64; round += 1) {
        GIMarshallingTests.arrayInLenZeroTerminated(ints);
    }

    expect(ints).toEqual([-1, 0, 1, 2]);
});

test("a zero-terminated length-bounded array terminates a typed-array argument too", () => {
    const view = new Int32Array([-1, 0, 1, 2]);

    for (let round = 0; round < 64; round += 1) {
        // @ts-expect-error the parameter is declared number[], and the binding also takes a matching typed array
        GIMarshallingTests.arrayInLenZeroTerminated(view);
    }

    expect([...view]).toEqual([-1, 0, 1, 2]);
});

test("zero-terminated length-bounded arrays still validate their elements", () => {
    expect(() => {
        GIMarshallingTests.arrayInLenZeroTerminated([-1, 0, 1, 2.5]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.arrayInLenZeroTerminated([-1, 0, 1, 2 ** 53]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an int element
        GIMarshallingTests.arrayInLenZeroTerminated(["-1", "0", "1", "2"]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a Float64Array does not match an int32 array
        GIMarshallingTests.arrayInLenZeroTerminated(new Float64Array([-1, 0, 1, 2]));
    }).toThrow();
});

test("variable-length int arrays come back complete", () => {
    expect(GIMarshallingTests.arrayOut()).toEqual([-1, 0, 1, 2]);
    expect(GIMarshallingTests.arrayReturn()).toEqual([-1, 0, 1, 2]);
    expect(Regress.testArrayIntOut()).toEqual([0, 1, 2, 3, 4]);
    expect(Regress.testArrayIntFullOut()).toEqual([0, 1, 2, 3, 4]);
    expect(Regress.testArrayIntNoneOut()).toEqual([1, 2, 3, 4, 5]);
});

test("etc variants thread extra arguments and sums around the array", () => {
    expect(GIMarshallingTests.arrayOutEtc(9, 5)).toEqual([[9, 0, 1, 5], 14]);
    expect(GIMarshallingTests.arrayReturnEtc(9, 5)).toEqual([[9, 0, 1, 5], 14]);
    expect(GIMarshallingTests.arrayOutEtc(1, 2)).toEqual([[1, 0, 1, 2], 3]);
    GIMarshallingTests.arrayInUtf8TwoIn([-1, 0, 1, 2], "1", "2");
    GIMarshallingTests.arrayInUtf8TwoIn([-1, 0, 1, 2], null, null);
    GIMarshallingTests.arrayInUtf8TwoInOutOfOrder("1", [-1, 0, 1, 2], "2");
});

test("fixed-size arrays round trip", () => {
    expect(GIMarshallingTests.arrayFixedIntReturn()).toEqual([-1, 0, 1, 2]);
    expect(GIMarshallingTests.arrayFixedShortReturn()).toEqual([-1, 0, 1, 2]);
    GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2]);
    GIMarshallingTests.arrayFixedShortIn([-1, 0, 1, 2]);
    expect(GIMarshallingTests.arrayFixedOut()).toEqual([-1, 0, 1, 2]);
    expect(GIMarshallingTests.arrayFixedCallerAllocatedOut()).toEqual([-1, 0, 1, 2]);
    expect(Regress.testArrayFixedSizeIntIn([1, 2, 3, 4, 5])).toBe(15);
    expect(Regress.testArrayFixedSizeIntOut()).toEqual([0, 1, 2, 3, 4]);
    expect(Regress.testArrayFixedSizeIntReturn()).toEqual([0, 1, 2, 3, 4]);
});

test("integer elements marshal at every width", () => {
    expect(Regress.testArrayGint8In([1, 2, 3, 4])).toBe(10);
    expect(Regress.testArrayGint16In([1, 2, 3, 4])).toBe(10);
    expect(Regress.testArrayGint32In([1, 2, 3, 4])).toBe(10);
    expect(Regress.testArrayGint64In([1n, 2n, 3n, 4n])).toBe(10n);
    GIMarshallingTests.arrayInt64In([-1n, 0n, 1n, 2n]);
    GIMarshallingTests.arrayUint64In([BigInt.asUintN(64, -1n), 0n, 1n, 2n]);
});

test("uint8 data is accepted from buffers typed arrays and plain arrays", () => {
    const buffer = Buffer.from("abcd");
    GIMarshallingTests.arrayUint8In(buffer);
    expect([...buffer]).toEqual([97, 98, 99, 100]);

    const view = new Uint8Array([97, 98, 99, 100]);
    GIMarshallingTests.arrayUint8In(view);
    expect([...view]).toEqual([97, 98, 99, 100]);

    GIMarshallingTests.arrayUint8In([97, 98, 99, 100]);
});

test("typed-array views pass through when the element type matches", () => {
    // @ts-expect-error the parameter is declared number[], and the binding also takes a matching typed array
    GIMarshallingTests.arrayIn(new Int32Array([-1, 0, 1, 2]));
    // @ts-expect-error the parameter is declared number[], and the binding also takes a matching typed array
    GIMarshallingTests.arrayFixedIntIn(new Int32Array([-1, 0, 1, 2]));
    // @ts-expect-error the parameter is declared number[], and the binding also takes a matching typed array
    expect(Regress.testArrayIntIn(new Int32Array([1, 2, 3, 4]))).toBe(10);
});

test("boolean arrays round trip", () => {
    GIMarshallingTests.arrayBoolIn([true, false, true, true]);
    expect(GIMarshallingTests.arrayBoolOut()).toEqual([true, false, true, true]);
});

test("unichar arrays round trip as characters", () => {
    GIMarshallingTests.arrayUnicharIn(UNICHARS);
    expect(GIMarshallingTests.arrayUnicharOut()).toEqual(UNICHARS);
    expect(GIMarshallingTests.arrayZeroTerminatedReturnUnichar()).toEqual(UNICHARS);
});

test("enum and flags arrays pass their members", () => {
    const enums = [
        GIMarshallingTests.Enum.VALUE1,
        GIMarshallingTests.Enum.VALUE2,
        GIMarshallingTests.Enum.VALUE3,
    ];
    GIMarshallingTests.arrayEnumIn(enums);
    expect(enums).toEqual([0, 1, 42]);

    const flags = [
        GIMarshallingTests.Flags.VALUE1,
        GIMarshallingTests.Flags.VALUE2,
        GIMarshallingTests.Flags.VALUE3,
    ];
    GIMarshallingTests.arrayFlagsIn(flags);
    expect(flags).toEqual([1, 2, 4]);
});

test("string arrays with an explicit length pass through", () => {
    const strings = ["foo", "bar"];
    GIMarshallingTests.arrayStringIn(strings);
    expect(strings).toEqual(["foo", "bar"]);
});

test("zero-terminated string arrays round trip", () => {
    GIMarshallingTests.arrayZeroTerminatedIn(["0", "1", "2"]);
    expect(GIMarshallingTests.arrayZeroTerminatedOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.arrayZeroTerminatedReturn()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.arrayZeroTerminatedReturnNull()).toEqual([]);
});

test("boxed struct pointer arrays pass for every transfer mode", () => {
    const make = (value: number) => new GIMarshallingTests.BoxedStruct({ long: BigInt(value) });
    const borrowed = [make(1), make(2), make(3)];
    GIMarshallingTests.arrayStructIn(borrowed);
    expect(borrowed.map((entry) => entry.long)).toEqual([1n, 2n, 3n]);
    GIMarshallingTests.arrayStructFullIn([make(1), make(2), make(3)]);
    GIMarshallingTests.arrayStructTakeIn([make(1), make(2), make(3)]);
});

test("flat struct value arrays marshal by value", () => {
    const boxed = (value: number) => new GIMarshallingTests.BoxedStruct({ long: BigInt(value) });
    const simple = (value: number) => new GIMarshallingTests.SimpleStruct({ long: BigInt(value) });
    const boxedStructs = [boxed(1), boxed(2), boxed(3)];
    GIMarshallingTests.arrayStructValueIn(boxedStructs);
    expect(boxedStructs.map((entry) => entry.long)).toEqual([1n, 2n, 3n]);

    const simpleStructs = [simple(1), simple(2), simple(3)];
    GIMarshallingTests.arraySimpleStructIn(simpleStructs);
    expect(simpleStructs.map((entry) => entry.long)).toEqual([1n, 2n, 3n]);

    Regress.testArrayStructInFull([
        new Regress.TestStructA({ someInt: 201 }),
        new Regress.TestStructA({ someInt: 202 }),
    ]);

    const borrowed = [
        new Regress.TestStructA({ someInt: 301 }),
        new Regress.TestStructA({ someInt: 302 }),
        new Regress.TestStructA({ someInt: 303 }),
    ];
    Regress.testArrayStructInNone(borrowed);
    expect(borrowed.map((entry) => entry.someInt)).toEqual([301, 302, 303]);
});

test("struct arrays come back with populated fields", () => {
    const fixed = GIMarshallingTests.arrayFixedOutStruct();
    expect(fixed.map((entry) => [entry.long, entry.int8])).toEqual([[7n, 6], [6n, 7]]);
    const callerAllocated = GIMarshallingTests.arrayFixedCallerAllocatedStructOut();
    expect(callerAllocated.map((entry) => [entry.long, entry.int8])).toEqual([[-2n, -1], [1n, 2], [3n, 4], [5n, 6]]);
    expect(GIMarshallingTests.arrayZeroTerminatedReturnStruct().map((entry) => entry.long)).toEqual([42n, 43n, 44n]);
    expect(GIMarshallingTests.arrayZeroTerminatedReturnSequentialStruct().map((entry) => entry.long)).toEqual([
        42n,
        43n,
        44n,
    ]);
    expect(Regress.testArrayStructOut().map((entry) => entry.someInt)).toEqual([22, 33, 44]);
    expect(Regress.testArrayStructOutNone().map((entry) => entry.someInt)).toEqual([111, 222, 333]);
    expect(Regress.testArrayStructOutContainer().map((entry) => entry.someInt)).toEqual([11, 13, 17, 19, 23]);
    expect(Regress.testArrayStructOutFullFixed().map((entry) => entry.someInt)).toEqual([2, 3, 5, 7]);
});

test("gtype arrays accept classes and raw gtypes", () => {
    expect(Regress.testArrayGtypeIn([GObject.Object])).toBe("[GObject,]");
    expect(
        Regress.testArrayGtypeIn([GIMarshallingTests.gtypeReturn(), GIMarshallingTests.gtypeStringReturn()]),
    ).toBe("[void,gchararray,]");
});

test("unaligned byte buffers come back as full copies", () => {
    expect([...GIMarshallingTests.arrayReturnUnaligned()]).toEqual(unalignedPattern);
    expect([...GIMarshallingTests.arrayOutUnaligned()]).toEqual(unalignedPattern);
    expect([...GIMarshallingTests.arrayFixedReturnUnaligned()]).toEqual(unalignedPattern);
    expect([...GIMarshallingTests.arrayFixedOutUnaligned()]).toEqual(unalignedPattern);
    expect([...GIMarshallingTests.arrayZeroTerminatedReturnUnaligned()]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...GIMarshallingTests.arrayZeroTerminatedOutUnaligned()]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    GIMarshallingTests.cleanupUnalignedBuffer();
});

test("empty and null arrays are accepted where allowed", () => {
    expect(Regress.testArrayIntIn([])).toBe(0);
    expect(Regress.testArrayGint8In([])).toBe(0);
    expect(Regress.testArrayGtypeIn([])).toBe("[]");
    Regress.testArrayIntNullIn(null);
    expect(Regress.testArrayIntNullOut()).toEqual([]);
});

test("uninitialized out arrays settle to empty", () => {
    expect(GIMarshallingTests.arrayFixedOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.arrayOutUninitialized()).toEqual([false, []]);
    expect(GIMarshallingTests.arrayZeroTerminatedOutUninitialized()).toEqual([false, []]);
});

test("array arguments reject non-array values", () => {
    expect(() => {
        // @ts-expect-error a number is not an array
        GIMarshallingTests.arrayIn(123);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not an array
        GIMarshallingTests.arrayIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an array
        GIMarshallingTests.arrayIn("nope");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a byte array
        GIMarshallingTests.arrayUint8In("abcd");
    }).toThrow();
});

test("array elements reject mismatched types", () => {
    expect(() => {
        // @ts-expect-error a string is not an int element
        GIMarshallingTests.arrayIn(["a", "b", "c", "d"]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a boolean is not an int element
        GIMarshallingTests.arrayIn([true, false, true, true]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a string element
        GIMarshallingTests.arrayStringIn([1, 2]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a BoxedStruct element
        GIMarshallingTests.arrayStructIn([{}, {}, {}]);
    }).toThrow();
});

test("array elements reject fractional and out-of-range values", () => {
    expect(() => {
        GIMarshallingTests.arrayIn([-1.5, 0, 1, 2]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.arrayUint8In([256, 98, 99, 100]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.arrayUint64In([-1n, 0n, 1n, 2n]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.arrayInt64In([2n ** 63n, 0n, 1n, 2n]);
    }).toThrow();
});

test("fixed-size arrays reject wrong element counts", () => {
    expect(() => {
        GIMarshallingTests.arrayFixedIntIn([-1, 0, 1]);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2, 3]);
    }).toThrow();
    expect(() => {
        // @ts-expect-error the parameter is declared number[], and the binding also takes a matching typed array
        GIMarshallingTests.arrayFixedIntIn(new Int32Array([-1, 0, 1]));
    }).toThrow();
    expect(() => Regress.testArrayFixedSizeIntIn([1, 2, 3])).toThrow();
});

test("typed-array views reject mismatched kinds and shared buffers", () => {
    expect(() => {
        // @ts-expect-error an Int32Array does not match a uint8 array
        GIMarshallingTests.arrayUint8In(new Int32Array([97, 98, 99, 100]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a Uint8Array does not match a boolean array
        GIMarshallingTests.arrayBoolIn(new Uint8Array([1, 0, 1, 1]));
    }).toThrow();
    expect(() => {
        const shared = new Uint8Array(new SharedArrayBuffer(4));
        shared.set([97, 98, 99, 100]);
        GIMarshallingTests.arrayUint8In(shared);
    }).toThrow();
});

test("a cursor array reports how far a validating callee read", () => {
    expect(GLib.utf8Validate(new TextEncoder().encode("héllo"))).toEqual([true, new Uint8Array([])]);
    expect(GLib.utf8Validate(new Uint8Array([]))).toEqual([true, new Uint8Array([])]);
    expect(GLib.utf8Validate([104, 105])).toEqual([true, new Uint8Array([])]);
    expect(GLib.utf8Validate(new Uint8Array([0x68, 0xFF, 0x69]))).toEqual([false, new Uint8Array([255, 105])]);
});

test("a cursor array rejects values that are not byte sequences", () => {
    // @ts-expect-error a string is not a byte sequence
    expect(() => GLib.utf8Validate("héllo")).toThrow();
    // @ts-expect-error a number is not a byte sequence
    expect(() => GLib.utf8Validate(42)).toThrow();
    // @ts-expect-error a string is not a byte element
    expect(() => GLib.utf8Validate([104, "i"])).toThrow();
});
