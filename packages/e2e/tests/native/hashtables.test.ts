import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

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
    expect(returned instanceof Map).toBeTruthy();
    expect(returned).toEqual(expected);
    GIMarshallingTests.ghashtableIntNoneIn(expected);
    GIMarshallingTests.ghashtableIntNoneIn(returned);
});

test("utf8 hash tables round trip across transfer none, container and full", () => {
    const expected = utf8Table();
    expect(GIMarshallingTests.ghashtableUtf8NoneReturn()).toEqual(expected);
    expect(GIMarshallingTests.ghashtableUtf8ContainerReturn()).toEqual(expected);
    expect(GIMarshallingTests.ghashtableUtf8FullReturn()).toEqual(expected);
    expect(GIMarshallingTests.ghashtableUtf8NoneOut()).toEqual(expected);
    expect(GIMarshallingTests.ghashtableUtf8ContainerOut()).toEqual(expected);
    expect(GIMarshallingTests.ghashtableUtf8FullOut()).toEqual(expected);
    GIMarshallingTests.ghashtableUtf8NoneIn(utf8Table());
    GIMarshallingTests.ghashtableUtf8ContainerIn(utf8Table());
    const consumed = utf8Table();
    GIMarshallingTests.ghashtableUtf8FullIn(consumed);
    expect(consumed).toEqual(expected);
    GIMarshallingTests.ghashtableUtf8NoneIn(GIMarshallingTests.ghashtableUtf8NoneReturn());
});

test("uninitialized out hash tables decode as null", () => {
    expect(GIMarshallingTests.ghashtableUtf8NoneOutUninitialized()).toEqual([false, null]);
    expect(GIMarshallingTests.ghashtableUtf8ContainerOutUninitialized()).toEqual([false, null]);
    expect(GIMarshallingTests.ghashtableUtf8FullOutUninitialized()).toEqual([false, null]);
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
    expect(doubles.values().toArray()).toEqual([-0.1, 0, 0.1, 0.2]);
});

test("floating point hash tables reject values that are not numbers or do not fit", () => {
    expect(() => {
        // @ts-expect-error a string is not a float value
        GIMarshallingTests.ghashtableFloatIn(new Map([["-1", "nope"]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableFloatIn(new Map([["-1", 1e39]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error null is not a float value
        GIMarshallingTests.ghashtableDoubleIn(new Map([["-1", null]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a bigint is not a float value
        GIMarshallingTests.ghashtableDoubleIn(new Map([["-1", 1n]]));
    }).toThrow();
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
    expect(signed.values().toArray()).toEqual([-1n, 0n, 1n, 2n ** 32n]);
    expect(unsigned.values().toArray()).toEqual([2n ** 32n, 0n, 1n, 2n]);
});

test("64-bit integer hash tables accept exactly representable numbers", () => {
    const numbers = new Map([
        ["-1", -1],
        ["0", 0],
        ["1", 1],
        ["2", 2 ** 32],
    ]);
    // @ts-expect-error the value type is declared bigint, and the binding widens it to a plain number
    GIMarshallingTests.ghashtableInt64In(numbers);
    expect(numbers.values().toArray()).toEqual([-1, 0, 1, 2 ** 32]);
});

test("64-bit integer hash tables reject out-of-range and wrong typed values", () => {
    expect(() => {
        GIMarshallingTests.ghashtableUint64In(new Map([["0", -1n]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableInt64In(new Map([["0", 2n ** 63n]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a 64-bit integer value
        GIMarshallingTests.ghashtableInt64In(new Map([["0", "nope"]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a fractional number is not a 64-bit integer value
        GIMarshallingTests.ghashtableInt64In(new Map([["0", 1.5]]));
    }).toThrow();
});

test("a 64-bit integer is refused as a hash table key", () => {
    expect(() => GLib.HashTable.add(new Map([[1n, 1n]]), 1n)).toThrow();
    expect(() => GLib.HashTable.contains(new Map([[1n, 1n]]), 1n)).toThrow();
});

test("hash table integer entries reject fractional and out-of-range values", () => {
    expect(() => {
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[1.5, 1]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[1, 1.5]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[2 ** 31, 1]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[1, -(2 ** 31) - 1]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[NaN, 1]]));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[Infinity, 1]]));
    }).toThrow();
});

test("enum hash tables round trip", () => {
    const expected = new Map([
        [1, GIMarshallingTests.ExtraEnum.VALUE1],
        [2, GIMarshallingTests.ExtraEnum.VALUE2],
        [3, GIMarshallingTests.ExtraEnum.VALUE3],
    ]);
    const returned = GIMarshallingTests.ghashtableEnumNoneReturn();
    expect(returned instanceof Map).toBeTruthy();
    expect(returned).toEqual(expected);
    expect(returned.get(3)).toBe(42);
    GIMarshallingTests.ghashtableEnumNoneIn(expected);
    GIMarshallingTests.ghashtableEnumNoneIn(returned);
});

test("hash table enum entries reject wrong types and values outside the storage width", () => {
    expect(() => {
        // @ts-expect-error a string is not an ExtraEnum member
        GIMarshallingTests.ghashtableEnumNoneIn(new Map([[1, "VALUE1"]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error 1.5 is not an ExtraEnum member
        GIMarshallingTests.ghashtableEnumNoneIn(new Map([[1, 1.5]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error -1 is not an ExtraEnum member
        GIMarshallingTests.ghashtableEnumNoneIn(new Map([[1, -1]]));
    }).toThrow();
});

test("a GType registered enum marshals as a hash table element", () => {
    const members = [
        [1, GIMarshallingTests.GEnum.VALUE1],
        [2, GIMarshallingTests.GEnum.VALUE2],
        [3, GIMarshallingTests.GEnum.VALUE3],
    ];
    genumValuedTableIn(members);
    expect(members).toEqual([
        [1, 0],
        [2, 1],
        [3, 42],
    ]);
});

test("a GType registered enum hash table element rejects values that are not members", () => {
    expect(() => genumValuedTableIn([[1, 7]])).toThrow();
    expect(() => genumValuedTableIn([[1, "VALUE1"]])).toThrow();
});

test("regress string hash tables return as maps in every transfer mode", () => {
    const expected = regressTable();
    expect(Regress.testGhashNothingReturn()).toEqual(expected);
    expect(Regress.testGhashNothingReturn2()).toEqual(expected);
    expect(Regress.testGhashContainerReturn()).toEqual(expected);
    expect(Regress.testGhashEverythingReturn()).toEqual(expected);
    Regress.testGhashNothingIn(regressTable());
    Regress.testGhashNothingIn2(regressTable());
    Regress.testGhashNothingIn(Regress.testGhashNothingReturn());
});

test("nested hash tables decode as maps of maps", () => {
    const nested = Regress.testGhashNestedEverythingReturn();
    expect(nested instanceof Map).toBeTruthy();
    expect(nested.size).toBe(1);
    const inner = nested.get("wibble");
    expect(inner instanceof Map).toBeTruthy();
    expect(inner).toEqual(regressTable());
    expect(Regress.testGhashNestedEverythingReturn2()).toEqual(new Map([["wibble", regressTable()]]));
});

test("null hash tables pass in and decode as null", () => {
    Regress.testGhashNullIn(null);
    expect(Regress.testGhashNullReturn()).toBeNull();
    expect(Regress.testGhashNullOut()).toBeNull();
});

test("an empty hash table stays distinguishable from a null one", () => {
    const owner = GIMarshallingTests.PropertiesAccessorsObject.new();
    expect(owner.getHashTable()).toBeNull();
    owner.setHashTable(new Map());
    expect(owner.getHashTable()).toEqual(new Map());
    owner.setHashTable(new Map([[7, "seven"]]));
    expect(owner.getHashTable()).toEqual(new Map([[7, "seven"]]));
});

test("hash table arguments reject non-map containers", () => {
    expect(() => {
        // @ts-expect-error a string is not a hash table
        GIMarshallingTests.ghashtableIntNoneIn("nope");
    }).toThrow();
});

test("hash table arguments reject values that are not iterable", () => {
    expect(() => {
        // @ts-expect-error a plain object is not a hash table
        GIMarshallingTests.ghashtableIntNoneIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a hash table
        GIMarshallingTests.ghashtableIntNoneIn({ 1: 1 });
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a hash table
        GIMarshallingTests.ghashtableIntNoneIn({ length: 2 });
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a hash table
        GIMarshallingTests.ghashtableUtf8NoneIn(7);
    }).toThrow();
});

test("a non-nullable hash table argument rejects null and undefined", () => {
    expect(() => {
        // @ts-expect-error the hash table parameter is not nullable
        GIMarshallingTests.ghashtableUtf8NoneIn(null);
    }).toThrow();
    expect(() => {
        // @ts-expect-error the hash table parameter is not optional
        GIMarshallingTests.ghashtableUtf8NoneIn();
    }).toThrow();
    expect(() => {
        // @ts-expect-error the hash table parameter is not nullable
        GIMarshallingTests.ghashtableIntNoneIn(null);
    }).toThrow();
});

test("hash table arguments reject keys of the wrong type", () => {
    expect(() => {
        // @ts-expect-error a string is not an int key
        GIMarshallingTests.ghashtableIntNoneIn(new Map([["x", 1]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not an int key
        GIMarshallingTests.ghashtableIntNoneIn(new Map([[Symbol("k"), 1]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a utf8 key
        GIMarshallingTests.ghashtableUtf8NoneIn(new Map([[7, "1"]]));
    }).toThrow();
});

test("hash table arguments reject values of the wrong type", () => {
    expect(() => {
        // @ts-expect-error a number is not a utf8 value
        GIMarshallingTests.ghashtableUtf8NoneIn(new Map([["-1", 7]]));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a utf8 value
        GIMarshallingTests.ghashtableUtf8NoneIn(new Map([["-1", Symbol("v")]]));
    }).toThrow();
});
