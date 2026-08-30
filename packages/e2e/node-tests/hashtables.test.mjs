import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest } from "./helpers/memory.mjs";

drainAfterEachTest();

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

test("uninitialized out hash tables decode as empty maps", () => {
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8NoneOutUninitialized(), [false, new Map()]);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8ContainerOutUninitialized(), [false, new Map()]);
    assert.deepEqual(GIMarshallingTests.ghashtableUtf8FullOutUninitialized(), [false, new Map()]);
});

test("double valued hash tables marshal values by pointer", () => {
    const doubles = new Map([
        ["-1", -0.1],
        ["0", 0],
        ["1", 0.1],
        ["2", 0.2],
    ]);
    GIMarshallingTests.ghashtableDoubleIn(doubles);
    assert.deepEqual(doubles.values().toArray(), [-0.1, 0, 0.1, 0.2]);
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

test("null hash tables pass in and decode as empty maps", () => {
    Regress.testGhashNullIn(null);
    const returned = Regress.testGhashNullReturn();
    assert.ok(returned instanceof Map);
    assert.equal(returned.size, 0);
    assert.deepEqual(Regress.testGhashNullOut(), new Map());
});

test("hash table arguments reject non-map containers", () => {
    assert.throws(() => GIMarshallingTests.ghashtableIntNoneIn("nope"));
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
