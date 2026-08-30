import assert from "node:assert/strict";
import { test } from "node:test";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import { installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

test("GArray of ints and 64-bit ints round trips", () => {
    assert.deepEqual(GIMarshallingTests.garrayIntNoneReturn(), [-1, 0, 1, 2]);
    GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, 2]);
    assert.deepEqual(GIMarshallingTests.garrayUint64NoneReturn(), [0n, 2n ** 64n - 1n]);
    GIMarshallingTests.garrayUint64NoneIn([0n, 2n ** 64n - 1n]);
});

test("GArray marshals enum, boolean and unichar elements", () => {
    assert.deepEqual(GIMarshallingTests.garrayEnumNoneReturn(), [
        GIMarshallingTests.GEnum.VALUE1,
        GIMarshallingTests.GEnum.VALUE2,
        GIMarshallingTests.GEnum.VALUE3,
    ]);
    GIMarshallingTests.garrayBoolNoneIn([true, false, true, true]);
    GIMarshallingTests.garrayUnicharNoneIn([..."const ♥ utf8"]);
});

test("GArray of strings round trips across transfer modes", () => {
    assert.deepEqual(GIMarshallingTests.garrayUtf8NoneReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8ContainerReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8FullReturn(), ["0", "1", "2"]);
    GIMarshallingTests.garrayUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.garrayUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.garrayUtf8FullIn(["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8NoneOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8ContainerOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8FullOut(), ["0", "1", "2"]);
});

test("GPtrArray of strings returns across transfer modes", () => {
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8NoneReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8ContainerReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8FullReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8NoneOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8ContainerOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8FullOut(), ["0", "1", "2"]);
});

test("GPtrArray of boxed structs returns element values", () => {
    const structs = GIMarshallingTests.gptrarrayBoxedStructFullReturn();
    assert.equal(structs.length, 3);
    assert.ok(structs[0] instanceof GIMarshallingTests.BoxedStruct);
    assert.deepEqual(structs.map((value) => value.long), [42n, 43n, 44n]);
});

test("GByteArray carries binary data both ways", () => {
    const bytes = GIMarshallingTests.bytearrayFullReturn();
    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(bytes, new Uint8Array([0, 49, 0xff, 51]));
    assert.deepEqual(GIMarshallingTests.bytearrayFullOut(), new Uint8Array([0, 49, 0xff, 51]));
    GIMarshallingTests.bytearrayNoneIn(bytes);
    GIMarshallingTests.bytearrayNoneIn([0, 49, 0xff, 51]);
});

test("GBytes round trips as a boxed value", () => {
    const bytes = GIMarshallingTests.gbytesFullReturn();
    assert.equal(bytes.getSize(), 4);
    assert.deepEqual(bytes.getData(), new Uint8Array([0, 49, 0xff, 51]));
    GIMarshallingTests.gbytesNoneIn(bytes);
    GIMarshallingTests.gbytesNoneIn(GLib.Bytes.new([0, 49, 0xff, 51]));
});

test("GList of strings round trips across transfer modes", () => {
    assert.deepEqual(GIMarshallingTests.glistUtf8NoneReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.glistUtf8ContainerReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.glistUtf8FullReturn(), ["0", "1", "2"]);
    GIMarshallingTests.glistUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.glistUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.glistUtf8FullIn(["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.glistUtf8NoneOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.glistUtf8ContainerOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.glistUtf8FullOut(), ["0", "1", "2"]);
});

test("GSList of strings round trips across transfer modes", () => {
    assert.deepEqual(GIMarshallingTests.gslistUtf8NoneReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8ContainerReturn(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8FullReturn(), ["0", "1", "2"]);
    GIMarshallingTests.gslistUtf8NoneIn(["0", "1", "2"]);
    GIMarshallingTests.gslistUtf8ContainerIn(["0", "1", "2"]);
    GIMarshallingTests.gslistUtf8FullIn(["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8NoneOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8ContainerOut(), ["0", "1", "2"]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8FullOut(), ["0", "1", "2"]);
});

test("uninitialized out containers report failure and yield empty arrays", () => {
    assert.deepEqual(GIMarshallingTests.garrayUtf8NoneOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8ContainerOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.garrayUtf8FullOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8NoneOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8ContainerOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.gptrarrayUtf8FullOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.glistUtf8NoneOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.glistUtf8ContainerOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.glistUtf8FullOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8NoneOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8ContainerOutUninitialized(), [false, []]);
    assert.deepEqual(GIMarshallingTests.gslistUtf8FullOutUninitialized(), [false, []]);
});

test("Regress GList returns the test sequence across transfer modes", () => {
    assert.deepEqual(Regress.testGlistNothingReturn(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testGlistNothingReturn2(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testGlistContainerReturn(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testGlistEverythingReturn(), ["1", "2", "3"]);
    Regress.testGlistNothingIn(["1", "2", "3"]);
    Regress.testGlistNothingIn2(["1", "2", "3"]);
});

test("Regress GSList returns the test sequence across transfer modes", () => {
    assert.deepEqual(Regress.testGslistNothingReturn(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testGslistNothingReturn2(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testGslistContainerReturn(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testGslistEverythingReturn(), ["1", "2", "3"]);
    Regress.testGslistNothingIn(["1", "2", "3"]);
    Regress.testGslistNothingIn2(["1", "2", "3"]);
});

test("null and empty lists marshal as null pointers", () => {
    Regress.testGlistNullIn(null);
    Regress.testGlistNullIn([]);
    assert.deepEqual(Regress.testGlistNullOut(), []);
    Regress.testGslistNullIn(null);
    Regress.testGslistNullIn([]);
    assert.deepEqual(Regress.testGslistNullOut(), []);
});

test("GType lists accept wrapper classes with container transfer", () => {
    Regress.testGlistGtypeContainerIn([Regress.TestObj, Regress.TestSubObj]);
});

test("boxed element lists round trip across transfer modes", () => {
    const none = Regress.testGlistBoxedNoneReturn(2);
    assert.equal(none.length, 2);
    assert.deepEqual(none.map((value) => value.anotherThing), [42, 42]);
    const full = Regress.testGlistBoxedFullReturn(2);
    assert.equal(full.length, 2);
    assert.deepEqual(full.map((value) => value.anotherThing), [42, 42]);
    assert.ok(full[0] instanceof Regress.TestBoxedC);
});

test("container arguments reject non-array values", () => {
    assert.throws(() => GIMarshallingTests.garrayIntNoneIn("nope"));
    assert.throws(() => GIMarshallingTests.glistUtf8NoneIn({}));
    assert.throws(() => GIMarshallingTests.gptrarrayUtf8NoneIn(123));
    assert.throws(() => GIMarshallingTests.gslistUtf8NoneIn(Symbol("nope")));
    assert.throws(() => GIMarshallingTests.bytearrayNoneIn({}));
    assert.throws(() => GIMarshallingTests.bytearrayNoneIn("0123"));
    assert.throws(() => GIMarshallingTests.gbytesNoneIn({}));
    assert.throws(() => GIMarshallingTests.gbytesNoneIn("bytes"));
});

test("container elements of the wrong type throw before the call", () => {
    assert.throws(() => GIMarshallingTests.garrayIntNoneIn([-1, 0, 1, "2"]));
    assert.throws(() => GIMarshallingTests.garrayUint64NoneIn([0n, -1n]));
    assert.throws(() => GIMarshallingTests.garrayUtf8NoneIn(["0", "1", 2]));
    assert.throws(() => GIMarshallingTests.garrayBoolNoneIn([true, 0, true, true]));
    assert.throws(() =>
        GIMarshallingTests.garrayUnicharNoneIn(["co", "n", "s", "t", " ", "♥", " ", "u", "t", "f", "8", "x"]),
    );
    assert.throws(() => GIMarshallingTests.garrayUtf8FullIn(["0", "1", 2]));
    assert.throws(() => GIMarshallingTests.gptrarrayUtf8FullIn(["0", false, "2"]));
    assert.throws(() => GIMarshallingTests.glistUtf8FullIn(["0", {}, "2"]));
    assert.throws(() => GIMarshallingTests.gslistUtf8FullIn(["0", Symbol("x"), "2"]));
    assert.throws(() => GIMarshallingTests.glistIntNoneIn([-1, 0, 1, 2.5]));
    assert.throws(() => GIMarshallingTests.gslistIntNoneIn([-1, 0, 2 ** 53, 2]));
    assert.throws(() => GIMarshallingTests.glistUint32NoneIn([0.5, 0xffffffff]));
});
