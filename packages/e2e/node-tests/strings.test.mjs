import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainAfterEachTest } from "./helpers/memory.mjs";

drainAfterEachTest();

const UTF8 = "const ♥ utf8";

test("utf8 strings round trip through every direction and transfer", () => {
    assert.equal(GIMarshallingTests.CONSTANT_UTF8, UTF8);
    assert.equal(GIMarshallingTests.utf8NoneReturn(), UTF8);
    assert.equal(GIMarshallingTests.utf8FullReturn(), UTF8);
    GIMarshallingTests.utf8NoneIn(UTF8);
    GIMarshallingTests.utf8FullIn(UTF8);
    assert.equal(GIMarshallingTests.utf8NoneOut(), UTF8);
    assert.equal(GIMarshallingTests.utf8FullOut(), UTF8);
});

test("utf8 strings are encoded as utf8 bytes for byte array parameters", () => {
    const bytes = new TextEncoder().encode(UTF8);
    GIMarshallingTests.utf8AsUint8arrayIn(bytes);
    GIMarshallingTests.utf8AsUint8arrayIn([...bytes]);
    assert.equal(new TextDecoder().decode(bytes), GIMarshallingTests.CONSTANT_UTF8);
});

test("dangling and uninitialized out strings decode as null", () => {
    assert.equal(GIMarshallingTests.utf8DanglingOut(), null);
    assert.deepEqual(GIMarshallingTests.utf8NoneOutUninitialized(), [false, null]);
});

test("invalid utf8 decodes with replacement characters", () => {
    assert.equal(GIMarshallingTests.extraUtf8FullReturnInvalid(), "invalid utf8 ��");
    assert.equal(GIMarshallingTests.extraUtf8FullOutInvalid(), "invalid utf8 ��");
    assert.deepEqual(Regress.testArrayOfNonUtf8Strings(), ["Andr� Lur�at"]);
});

test("regress utf8 functions exchange the documented constants", () => {
    assert.equal(Regress.UTF8_CONSTANT, UTF8);
    assert.equal(Regress.testUtf8ConstReturn(), UTF8);
    assert.equal(Regress.testUtf8NonconstReturn(), "nonconst ♥ utf8");
    Regress.testUtf8ConstIn(UTF8);
    assert.equal(Regress.testUtf8Out(), "nonconst ♥ utf8");
    assert.deepEqual(Regress.testUtf8OutOut(), ["first", "second"]);
    assert.deepEqual(Regress.testUtf8OutNonconstReturn(), ["first", "second"]);
    assert.equal(Regress.testIntOutUtf8(UTF8), 12);
});

test("empty strings round trip", () => {
    assert.equal(GIMarshallingTests.filenameCopy(""), "");
    assert.equal(Regress.testIntOutUtf8(""), 0);
});

test("nullable string parameters and returns carry null", () => {
    Regress.testUtf8NullIn(null);
    Regress.testUtf8NullIn();
    assert.equal(Regress.testUtf8NullOut(), null);
    assert.equal(Regress.testReturnAllowNone(), null);
    assert.equal(Regress.testReturnNullable(), null);
    assert.equal(GIMarshallingTests.filenameCopy(null), null);
});

test("filename strings round trip including non-ascii paths", () => {
    assert.equal(GIMarshallingTests.filenameCopy(UTF8), UTF8);
    assert.equal(GIMarshallingTests.filenameExists("/"), true);
    assert.equal(GIMarshallingTests.filenameExists("/gtkx-definitely-missing"), false);
    const repr = GIMarshallingTests.filenameToGlibRepr(UTF8);
    assert.ok(repr instanceof Uint8Array);
    assert.deepEqual([...repr], [...new TextEncoder().encode(UTF8)]);
    assert.deepEqual(GIMarshallingTests.filenameListReturn(), []);
    assert.deepEqual(Regress.testFilenameReturn(), ["åäö", "/etc/fstab"]);
    assert.equal(Regress.annotationReturnFilename(), "a utf-8 filename");
});

test("string arrays marshal in every transfer variant", () => {
    assert.equal(Regress.testStrvIn(["1", "2", "3"]), true);
    assert.equal(Regress.testStrvIn(["1", "2", "4"]), false);
    assert.equal(Regress.testStrvIn(["1", "2"]), false);
    assert.deepEqual(Regress.testStrvOut(), ["thanks", "for", "all", "the", "fish"]);
    assert.deepEqual(Regress.testStrvOutC(), ["thanks", "for", "all", "the", "fish"]);
    assert.deepEqual(Regress.testStrvOutContainer(), ["1", "2", "3"]);
    assert.deepEqual(Regress.testStrvOutarg(), ["1", "2", "3"]);
    assert.deepEqual(Regress.annotationStringZeroTerminated(), []);
    Regress.annotationStringArrayLength(["a", "b"]);
    Regress.annotationStringArrayLength([]);
});

test("string arrays unwrap from GValues including the null strv", () => {
    assert.deepEqual(Regress.testStrvInGvalue(), ["one", "two", "three"]);
    assert.deepEqual(Regress.testNullStrvInGvalue(), []);
});

test("string arguments reject values of the wrong type", () => {
    assert.throws(() => GIMarshallingTests.utf8NoneIn(42));
    assert.throws(() => GIMarshallingTests.utf8NoneIn(Symbol("nope")));
    assert.throws(() => GIMarshallingTests.utf8NoneIn({}));
    assert.throws(() => GIMarshallingTests.utf8FullIn(42));
    assert.throws(() => Regress.testUtf8ConstIn({}));
    assert.throws(() => GIMarshallingTests.filenameExists(7));
});

test("a non-nullable string parameter rejects null instead of marshalling NULL", () => {
    assert.throws(() => GIMarshallingTests.utf8NoneIn(null), TypeError);
    assert.throws(() => GIMarshallingTests.utf8NoneIn(), TypeError);
    assert.throws(() => Regress.TestBoxedD.new(null, 1), TypeError);
});

test("a nullable parameter still accepts null", () => {
    Regress.funcObjNullIn(null);
    Regress.funcObjNullableIn(null);
    GIMarshallingTests.utf8NoneIn(UTF8);
    assert.equal(Regress.TestBoxedD.new("ok", 1).getMagic(), 3);
});

test("string array arguments reject non-arrays and non-string elements", () => {
    assert.throws(() => Regress.testStrvIn("123"));
    assert.throws(() => Regress.testStrvIn([1, 2, 3]));
    assert.throws(() => Regress.testStrvIn(["1", 2, "3"]));
});
