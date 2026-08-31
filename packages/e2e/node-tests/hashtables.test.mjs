import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import { t } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest } from "./helpers/memory.mjs";

drainAfterEachTest();

const genumValuedTableIn = t.fn("libgimarshallingtests.so", "gi_marshalling_tests_ghashtable_enum_none_in", () => ({
    args: [
        {
            type: t.hashTable(
                t.int32,
                t.enum("libgimarshallingtests.so", "gi_marshalling_tests_genum_get_type", false),
                "borrowed",
            ),
            isRequired: true,
        },
    ],
    returns: t.void,
}));

const utf8Table = () =>
    new Map([
        ["-1", "1"],
        ["0", "0"],
        ["1", "-1"],
        ["2", "-2"],
    ]);

const regressTable = () =>
    new Map([
        ["foo", "bar"],
        ["baz", "bat"],
        ["qux", "quux"],
    ]);

test("integer hash tables return and accept exact contents", () => {
    const expected = new Map([
        [-1, 1],
        [0, 0],
        [1, -1],
        [2, -2],
    ]);
    const returned = GIMarshallingTests.ghashtableIntNoneReturn();
    assert.ok(returned instanceof Map);
    assert.deepEqual(returned, expected);
    GIMarshallingTests.ghashtableIntNoneIn(expected);
    GIMarshallingTests.ghashtableIntNoneIn(returned);
});

test("utf8 hash tables round trip across transfer none, container and full", () => {
    const expected = utf8Table();
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8NoneReturn(), expected);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8ContainerReturn(), expected);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8FullReturn(), expected);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8NoneOut(), expected);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8ContainerOut(), expected);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8FullOut(), expected);
    GIMarshallingTests.ghashtableUtf8NoneIn(utf8Table());
    GIMarshallingTests.ghashtableUtf8ContainerIn(utf8Table());
    const consumed = utf8Table();
    GIMarshallingTests.ghashtableUtf8FullIn(consumed);
    assert.deepEqual(consumed, expected);
    GIMarshallingTests.ghashtableUtf8NoneIn(GIMarshallingTests.ghashtableUtf8NoneReturn());
});

test("uninitialized out hash tables decode as null", () => {
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8NoneOutUninitialized(), [false, null]);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8ContainerOutUninitialized(), [false, null]);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8FullOutUninitialized(), [false, null]);
});

test("floating point hash tables marshal values by pointer at both widths", () => {
    const doubles = new Map([
        ["-1", -0.1],
        ["0", 0],
        ["1", 0.1],
        ["2", 0.2],
    ]);
    GIMarshallingTests.ghashtableDoubleIn(doubles);
    GIMarshallingTests.ghashtableFloatIn(doubles);
    assert.deepEqual(doubles.values().toArray(), [-0.1, 0, 0.1, 0.2]);
});

test("floating point hash tables reject values that are not numbers or do not fit", () => {
    assert.throws(() => GIMarshallingTests.ghashtableFloatIn(new Map([["-1", "nope"]])));
    assert.throws(() => GIMarshallingTests.ghashtableFloatIn(new Map([["-1", 1e39]])));
    assert.throws(() => GIMarshallingTests.ghashtableDoubleIn(new Map([["-1", null]])));
    assert.throws(() => GIMarshallingTests.ghashtableDoubleIn(new Map([["-1", 1n]])));
});

test("64-bit integer hash tables marshal values by pointer", () => {
    const signed = new Map([
        ["-1", -1n],
        ["0", 0n],
        ["1", 1n],
        ["2", 2n ** 32n],
    ]);
    const unsigned = new Map([
        ["-1", 2n ** 32n],
        ["0", 0n],
        ["1", 1n],
        ["2", 2n],
    ]);
    GIMarshallingTests.ghashtableInt64In(signed);
    GIMarshallingTests.ghashtableUint64In(unsigned);
    assert.deepEqual(signed.values().toArray(), [-1n, 0n, 1n, 2n ** 32n]);
    assert.deepEqual(unsigned.values().toArray(), [2n ** 32n, 0n, 1n, 2n]);
});

test("64-bit integer hash tables accept exactly representable numbers", () => {
    const numbers = new Map([
        ["-1", -1],
        ["0", 0],
        ["1", 1],
        ["2", 2 ** 32],
    ]);
    GIMarshallingTests.ghashtableInt64In(numbers);
    assert.deepEqual(numbers.values().toArray(), [-1, 0, 1, 2 ** 32]);
});

test("64-bit integer hash tables reject out-of-range and wrong typed values", () => {
    assert.throws(() => GIMarshallingTests.ghashtableUint64In(new Map([["0", -1n]])));
    assert.throws(() => GIMarshallingTests.ghashtableInt64In(new Map([["0", 2n ** 63n]])));
    assert.throws(() => GIMarshallingTests.ghashtableInt64In(new Map([["0", "nope"]])));
    assert.throws(() => GIMarshallingTests.ghashtableInt64In(new Map([["0", 1.5]])));
});

test("a 64-bit integer is refused as a hash table key", () => {
    assert.throws(() => GLib.HashTable.add(new Map([[1n, 1n]]), 1n));
    assert.throws(() => GLib.HashTable.contains(new Map([[1n, 1n]]), 1n));
});

test("hash table integer entries reject fractional and out-of-range values", () => {
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[1.5, 1]])));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[1, 1.5]])));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[2 ** 31, 1]])));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[1, -(2 ** 31) - 1]])));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[NaN, 1]])));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[Infinity, 1]])));
});

test("enum hash tables round trip", () => {
    const expected = new Map([
        [1, GIMarshallingTests.ExtraEnum.VALUE1],
        [2, GIMarshallingTests.ExtraEnum.VALUE2],
        [3, GIMarshallingTests.ExtraEnum.VALUE3],
    ]);
    const returned = GIMarshallingTests.ghashtableEnumNoneReturn();
    assert.ok(returned instanceof Map);
    assert.deepEqual(returned, expected);
    assert.equal(returned.get(3), 42);
    GIMarshallingTests.ghashtableEnumNoneIn(expected);
    GIMarshallingTests.ghashtableEnumNoneIn(returned);
});

test("hash table enum entries reject wrong types and values outside the storage width", () => {
    assert.throws(() => GIMarshallingTests.ghashtableEnumNoneIn(new Map([[1, "VALUE1"]])));
    assert.throws(() => GIMarshallingTests.ghashtableEnumNoneIn(new Map([[1, 1.5]])));
    assert.throws(() => GIMarshallingTests.ghashtableEnumNoneIn(new Map([[1, -1]])));
});

test("a GType registered enum marshals as a hash table element", () => {
    const members = [
        [1, GIMarshallingTests.GEnum.VALUE1],
        [2, GIMarshallingTests.GEnum.VALUE2],
        [3, GIMarshallingTests.GEnum.VALUE3],
    ];
    genumValuedTableIn(members);
    assert.deepEqual(members, [
        [1, 0],
        [2, 1],
        [3, 42],
    ]);
});

test("a GType registered enum hash table element rejects values that are not members", () => {
    assert.throws(() => genumValuedTableIn([[1, 7]]));
    assert.throws(() => genumValuedTableIn([[1, "VALUE1"]]));
});

test("regress string hash tables return as maps in every transfer mode", () => {
    const expected = regressTable();
    assert.deepEqual(Regress.testGhashNothingReturn(), expected);
    assert.deepEqual(Regress.testGhashNothingReturn2(), expected);
    assert.deepEqual(Regress.testGhashContainerReturn(), expected);
    assert.deepEqual(Regress.testGhashEverythingReturn(), expected);
    Regress.testGhashNothingIn(regressTable());
    Regress.testGhashNothingIn2(regressTable());
    Regress.testGhashNothingIn(Regress.testGhashNothingReturn());
});

test("nested hash tables decode as maps of maps", () => {
    const nested = Regress.testGhashNestedEverythingReturn();
    assert.ok(nested instanceof Map);
    assert.equal(nested.size, 1);
    const inner = nested.get("wibble");
    assert.ok(inner instanceof Map);
    assert.deepEqual(inner, regressTable());
    assert.deepEqual(Regress.testGhashNestedEverythingReturn2(), new Map([["wibble", regressTable()]]));
});

test("null hash tables pass in and decode as null", () => {
    Regress.testGhashNullIn(null);
    assert.equal(Regress.testGhashNullReturn(), null);
    assert.equal(Regress.testGhashNullOut(), null);
});

test("an empty hash table stays distinguishable from a null one", () => {
    const owner = GIMarshallingTests.PropertiesAccessorsObject.new();
    assert.equal(owner.getHashTable(), null);
    owner.setHashTable(new Map());
    assert.deepEqual(owner.getHashTable(), new Map());
    owner.setHashTable(new Map([[7, "seven"]]));
    assert.deepEqual(owner.getHashTable(), new Map([[7, "seven"]]));
});

test("hash table arguments reject non-map containers", () => {
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn("nope"));
});

test("hash table arguments reject values that are not iterable", () => {
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn({}));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn({ 1: 1 }));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn({ length: 2 }));
    assert.throws(() => GIMarshallingTests.ghashtableUtf8NoneIn(7));
});

test("a non-nullable hash table argument rejects null and undefined", () => {
    assert.throws(() => GIMarshallingTests.ghashtableUtf8NoneIn(null));
    assert.throws(() => GIMarshallingTests.ghashtableUtf8NoneIn());
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(null));
});

test("hash table arguments reject keys of the wrong type", () => {
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([["x", 1]])));
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn(new Map([[Symbol("k"), 1]])));
    assert.throws(() => GIMarshallingTests.ghashtableUtf8NoneIn(new Map([[7, "1"]])));
});

test("hash table arguments reject values of the wrong type", () => {
    assert.throws(() => GIMarshallingTests.ghashtableUtf8NoneIn(new Map([["-1", 7]])));
    assert.throws(() => GIMarshallingTests.ghashtableUtf8NoneIn(new Map([["-1", Symbol("v")]])));
});
