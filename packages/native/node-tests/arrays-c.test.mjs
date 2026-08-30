import assert from "node:assert/strict";
import { test } from "node:test";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

const unalignedPattern = Array.from({ length: 32 }, (_, index) => (index + 1) % 8);

test("variable-length int arrays pass with the length in any position", () => {
    GIMarshallingTests.arrayIn([-1, 0, 1, 2]);
    GIMarshallingTests.arrayInLenBefore([-1, 0, 1, 2]);
    GIMarshallingTests.arrayInGuint64Len([-1, 0, 1, 2]);
    GIMarshallingTests.arrayInGuint8Len([-1, 0, 1, 2]);
    assert.equal(Regress.testArrayIntIn([1, 2, 3, 4]), 10);
    Regress.testArrayStaticInInt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("variable-length int arrays come back complete", () => {
    assert.deepEqual(GIMarshallingTests.arrayOut(), [-1, 0, 1, 2]);
    assert.deepEqual(GIMarshallingTests.arrayReturn(), [-1, 0, 1, 2]);
    assert.deepEqual(Regress.testArrayIntOut(), [0, 1, 2, 3, 4]);
    assert.deepEqual(Regress.testArrayIntFullOut(), [0, 1, 2, 3, 4]);
    assert.deepEqual(Regress.testArrayIntNoneOut(), [1, 2, 3, 4, 5]);
});

test("etc variants thread extra arguments and sums around the array", () => {
    assert.deepEqual(GIMarshallingTests.arrayOutEtc(9, 5), [[9, 0, 1, 5], 14]);
    assert.deepEqual(GIMarshallingTests.arrayReturnEtc(9, 5), [[9, 0, 1, 5], 14]);
    assert.deepEqual(GIMarshallingTests.arrayOutEtc(1, 2), [[1, 0, 1, 2], 3]);
    GIMarshallingTests.arrayInUtf8TwoIn([-1, 0, 1, 2], "1", "2");
    GIMarshallingTests.arrayInUtf8TwoIn([-1, 0, 1, 2], null, null);
    GIMarshallingTests.arrayInUtf8TwoInOutOfOrder("1", [-1, 0, 1, 2], "2");
});

test("fixed-size arrays round trip", () => {
    assert.deepEqual(GIMarshallingTests.arrayFixedIntReturn(), [-1, 0, 1, 2]);
    assert.deepEqual(GIMarshallingTests.arrayFixedShortReturn(), [-1, 0, 1, 2]);
    GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2]);
    GIMarshallingTests.arrayFixedShortIn([-1, 0, 1, 2]);
    assert.deepEqual(GIMarshallingTests.arrayFixedOut(), [-1, 0, 1, 2]);
    assert.deepEqual(GIMarshallingTests.arrayFixedCallerAllocatedOut(), [-1, 0, 1, 2]);
    assert.equal(Regress.testArrayFixedSizeIntIn([1, 2, 3, 4, 5]), 15);
    assert.deepEqual(Regress.testArrayFixedSizeIntOut(), [0, 1, 2, 3, 4]);
    assert.deepEqual(Regress.testArrayFixedSizeIntReturn(), [0, 1, 2, 3, 4]);
});

test("integer elements marshal at every width", () => {
    assert.equal(Regress.testArrayGint8In([1, 2, 3, 4]), 10);
    assert.equal(Regress.testArrayGint16In([1, 2, 3, 4]), 10);
    assert.equal(Regress.testArrayGint32In([1, 2, 3, 4]), 10);
    assert.equal(Regress.testArrayGint64In([1n, 2n, 3n, 4n]), 10n);
    GIMarshallingTests.arrayInt64In([-1n, 0n, 1n, 2n]);
    GIMarshallingTests.arrayUint64In([BigInt.asUintN(64, -1n), 0n, 1n, 2n]);
});

test("uint8 data is accepted from buffers typed arrays and plain arrays", () => {
    GIMarshallingTests.arrayUint8In(Buffer.from("abcd"));
    GIMarshallingTests.arrayUint8In(new Uint8Array([97, 98, 99, 100]));
    GIMarshallingTests.arrayUint8In([97, 98, 99, 100]);
});

test("typed-array views pass through when the element type matches", () => {
    GIMarshallingTests.arrayIn(new Int32Array([-1, 0, 1, 2]));
    GIMarshallingTests.arrayFixedIntIn(new Int32Array([-1, 0, 1, 2]));
    assert.equal(Regress.testArrayIntIn(new Int32Array([1, 2, 3, 4])), 10);
});

test("boolean arrays round trip", () => {
    GIMarshallingTests.arrayBoolIn([true, false, true, true]);
    assert.deepEqual(GIMarshallingTests.arrayBoolOut(), [true, false, true, true]);
});

test("unichar arrays round trip as characters", () => {
    GIMarshallingTests.arrayUnicharIn([..."const ♥ utf8"]);
    assert.deepEqual(GIMarshallingTests.arrayUnicharOut(), [..."const ♥ utf8"]);
    assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedReturnUnichar(), [..."const ♥ utf8"]);
});

test("enum and flags arrays pass their members", () => {
    GIMarshallingTests.arrayEnumIn([
        GIMarshallingTests.Enum.VALUE1,
        GIMarshallingTests.Enum.VALUE2,
        GIMarshallingTests.Enum.VALUE3,
    ]);
    GIMarshallingTests.arrayFlagsIn([
        GIMarshallingTests.Flags.VALUE1,
        GIMarshallingTests.Flags.VALUE2,
        GIMarshallingTests.Flags.VALUE3,
    ]);
});

test("string arrays with an explicit length pass through", () => {
    GIMarshallingTests.arrayStringIn(["foo", "bar"]);
});

test("zero-terminated string arrays round trip", () => {
    GIMarshallingTests.arrayZeroTerminatedIn(["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedReturnNull(), []);
});

test("boxed struct pointer arrays pass for every transfer mode", () => {
    const make = (value) => new GIMarshallingTests.BoxedStruct({ long: BigInt(value) });
    GIMarshallingTests.arrayStructIn([make(1), make(2), make(3)]);
    GIMarshallingTests.arrayStructFullIn([make(1), make(2), make(3)]);
    GIMarshallingTests.arrayStructTakeIn([make(1), make(2), make(3)]);
});

test("flat struct value arrays marshal by value", () => {
    const boxed = (value) => new GIMarshallingTests.BoxedStruct({ long: BigInt(value) });
    const simple = (value) => new GIMarshallingTests.SimpleStruct({ long: BigInt(value) });
    GIMarshallingTests.arrayStructValueIn([boxed(1), boxed(2), boxed(3)]);
    GIMarshallingTests.arraySimpleStructIn([simple(1), simple(2), simple(3)]);
    Regress.testArrayStructInFull([
        new Regress.TestStructA({ someInt: 201 }),
        new Regress.TestStructA({ someInt: 202 }),
    ]);
    Regress.testArrayStructInNone([
        new Regress.TestStructA({ someInt: 301 }),
        new Regress.TestStructA({ someInt: 302 }),
        new Regress.TestStructA({ someInt: 303 }),
    ]);
});

test("struct arrays come back with populated fields", () => {
    const fixed = GIMarshallingTests.arrayFixedOutStruct();
    assert.deepEqual(fixed.map((entry) => [entry.long, entry.int8]), [[7n, 6], [6n, 7]]);
    const callerAllocated = GIMarshallingTests.arrayFixedCallerAllocatedStructOut();
    assert.deepEqual(
        callerAllocated.map((entry) => [entry.long, entry.int8]),
        [[-2n, -1], [1n, 2], [3n, 4], [5n, 6]],
    );
    assert.deepEqual(
        GIMarshallingTests.arrayZeroTerminatedReturnStruct().map((entry) => entry.long),
        [42n, 43n, 44n],
    );
    assert.deepEqual(
        GIMarshallingTests.arrayZeroTerminatedReturnSequentialStruct().map((entry) => entry.long),
        [42n, 43n, 44n],
    );
    assert.deepEqual(Regress.testArrayStructOut().map((entry) => entry.someInt), [22, 33, 44]);
    assert.deepEqual(Regress.testArrayStructOutNone().map((entry) => entry.someInt), [111, 222, 333]);
    assert.deepEqual(Regress.testArrayStructOutContainer().map((entry) => entry.someInt), [11, 13, 17, 19, 23]);
    assert.deepEqual(Regress.testArrayStructOutFullFixed().map((entry) => entry.someInt), [2, 3, 5, 7]);
});

test("gtype arrays accept classes and raw gtypes", () => {
    assert.equal(Regress.testArrayGtypeIn([GObject.Object]), "[GObject,]");
    assert.equal(
        Regress.testArrayGtypeIn([GIMarshallingTests.gtypeReturn(), GIMarshallingTests.gtypeStringReturn()]),
        "[void,gchararray,]",
    );
});

test("unaligned byte buffers come back as full copies", () => {
    assert.deepEqual(Array.from(GIMarshallingTests.arrayReturnUnaligned()), unalignedPattern);
    assert.deepEqual(Array.from(GIMarshallingTests.arrayOutUnaligned()), unalignedPattern);
    assert.deepEqual(Array.from(GIMarshallingTests.arrayFixedReturnUnaligned()), unalignedPattern);
    assert.deepEqual(Array.from(GIMarshallingTests.arrayFixedOutUnaligned()), unalignedPattern);
    assert.deepEqual(Array.from(GIMarshallingTests.arrayZeroTerminatedReturnUnaligned()), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(Array.from(GIMarshallingTests.arrayZeroTerminatedOutUnaligned()), [1, 2, 3, 4, 5, 6, 7]);
    GIMarshallingTests.cleanupUnalignedBuffer();
});

test("empty and null arrays are accepted where allowed", () => {
    assert.equal(Regress.testArrayIntIn([]), 0);
    assert.equal(Regress.testArrayGint8In([]), 0);
    assert.equal(Regress.testArrayGtypeIn([]), "[]");
    Regress.testArrayIntNullIn(null);
    assert.deepEqual(Regress.testArrayIntNullOut(), []);
});

test("uninitialized out arrays settle to empty", () => {
    assert.deepEqual(GIMarshallingTests.arrayFixedOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.arrayOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.arrayZeroTerminatedOutUninitialized(), [false, []]);
});

test("array arguments reject non-array values", () => {
    assert.throws(() => GIMarshallingTests.arrayIn(123));
    assert.throws(() => GIMarshallingTests.arrayIn({}));
    assert.throws(() => GIMarshallingTests.arrayIn("nope"));
    assert.throws(() => GIMarshallingTests.arrayUint8In("abcd"));
});

test("array elements reject mismatched types", () => {
    assert.throws(() => GIMarshallingTests.arrayIn(["a", "b", "c", "d"]));
    assert.throws(() => GIMarshallingTests.arrayIn([true, false, true, true]));
    assert.throws(() => GIMarshallingTests.arrayStringIn([1, 2]));
    assert.throws(() => GIMarshallingTests.arrayStructIn([{}, {}, {}]));
});

test("array elements reject fractional and out-of-range values", () => {
    assert.throws(() => GIMarshallingTests.arrayIn([-1.5, 0, 1, 2]));
    assert.throws(() => GIMarshallingTests.arrayUint8In([256, 98, 99, 100]));
    assert.throws(() => GIMarshallingTests.arrayUint64In([-1n, 0n, 1n, 2n]));
    assert.throws(() => GIMarshallingTests.arrayInt64In([2n ** 63n, 0n, 1n, 2n]));
});

test("fixed-size arrays reject wrong element counts", () => {
    assert.throws(() => GIMarshallingTests.arrayFixedIntIn([-1, 0, 1]));
    assert.throws(() => GIMarshallingTests.arrayFixedIntIn([-1, 0, 1, 2, 3]));
    assert.throws(() => GIMarshallingTests.arrayFixedIntIn(new Int32Array([-1, 0, 1])));
    assert.throws(() => Regress.testArrayFixedSizeIntIn([1, 2, 3]));
});

test("typed-array views reject mismatched kinds and shared buffers", () => {
    assert.throws(() => GIMarshallingTests.arrayUint8In(new Int32Array([97, 98, 99, 100])));
    assert.throws(() => GIMarshallingTests.arrayBoolIn(new Uint8Array([1, 0, 1, 1])));
    assert.throws(() => {
        const shared = new Uint8Array(new SharedArrayBuffer(4));
        shared.set([97, 98, 99, 100]);
        GIMarshallingTests.arrayUint8In(shared);
    });
});
