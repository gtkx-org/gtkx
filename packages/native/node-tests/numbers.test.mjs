import assert from "node:assert/strict";
import { test } from "node:test";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import * as RegressUnix from "@gtkx/gi/regressunix";
import { installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

test("8-bit integers round trip at their bounds", () => {
    assert.equal(GIMarshallingTests.int8ReturnMax(), 127);
    assert.equal(GIMarshallingTests.int8ReturnMin(), -128);
    GIMarshallingTests.int8InMax(127);
    GIMarshallingTests.int8InMin(-128);
    assert.equal(GIMarshallingTests.int8OutMax(), 127);
    assert.equal(GIMarshallingTests.int8OutMin(), -128);
    assert.equal(GIMarshallingTests.int8InoutMaxMin(127), -128);
    assert.equal(GIMarshallingTests.int8InoutMinMax(-128), 127);
    assert.equal(GIMarshallingTests.uint8Return(), 0xff);
    GIMarshallingTests.uint8In(0xff);
    assert.equal(GIMarshallingTests.uint8Out(), 0xff);
    assert.equal(GIMarshallingTests.uint8Inout(0xff), 0);
});

test("16-bit integers round trip at their bounds", () => {
    assert.equal(GIMarshallingTests.int16ReturnMax(), 32767);
    assert.equal(GIMarshallingTests.int16ReturnMin(), -32768);
    GIMarshallingTests.int16InMax(32767);
    GIMarshallingTests.int16InMin(-32768);
    assert.equal(GIMarshallingTests.int16OutMax(), 32767);
    assert.equal(GIMarshallingTests.int16OutMin(), -32768);
    assert.equal(GIMarshallingTests.int16InoutMaxMin(32767), -32768);
    assert.equal(GIMarshallingTests.int16InoutMinMax(-32768), 32767);
    assert.equal(GIMarshallingTests.uint16Return(), 65535);
    GIMarshallingTests.uint16In(65535);
    assert.equal(GIMarshallingTests.uint16Out(), 65535);
    assert.equal(GIMarshallingTests.uint16Inout(65535), 0);
});

test("32-bit integers round trip at their bounds", () => {
    assert.equal(GIMarshallingTests.int32ReturnMax(), 2147483647);
    assert.equal(GIMarshallingTests.int32ReturnMin(), -2147483648);
    GIMarshallingTests.int32InMax(2147483647);
    GIMarshallingTests.int32InMin(-2147483648);
    assert.equal(GIMarshallingTests.int32OutMax(), 2147483647);
    assert.equal(GIMarshallingTests.int32OutMin(), -2147483648);
    assert.equal(GIMarshallingTests.int32InoutMaxMin(2147483647), -2147483648);
    assert.equal(GIMarshallingTests.int32InoutMinMax(-2147483648), 2147483647);
    assert.equal(GIMarshallingTests.uint32Return(), 4294967295);
    GIMarshallingTests.uint32In(4294967295);
    assert.equal(GIMarshallingTests.uint32Out(), 4294967295);
    assert.equal(GIMarshallingTests.uint32Inout(4294967295), 0);
});

test("64-bit integers use BigInt end to end", () => {
    assert.equal(GIMarshallingTests.int64ReturnMax(), 2n ** 63n - 1n);
    assert.equal(GIMarshallingTests.int64ReturnMin(), -(2n ** 63n));
    GIMarshallingTests.int64InMax(2n ** 63n - 1n);
    GIMarshallingTests.int64InMin(-(2n ** 63n));
    assert.equal(GIMarshallingTests.int64OutMax(), 2n ** 63n - 1n);
    assert.equal(GIMarshallingTests.int64OutMin(), -(2n ** 63n));
    assert.equal(GIMarshallingTests.int64InoutMaxMin(2n ** 63n - 1n), -(2n ** 63n));
    assert.equal(GIMarshallingTests.uint64Return(), 2n ** 64n - 1n);
    GIMarshallingTests.uint64In(2n ** 64n - 1n);
    assert.equal(GIMarshallingTests.uint64Out(), 2n ** 64n - 1n);
    assert.equal(GIMarshallingTests.uint64Inout(2n ** 64n - 1n), 0n);
});

test("short and ushort round trip at their bounds", () => {
    assert.equal(GIMarshallingTests.shortReturnMax(), 32767);
    assert.equal(GIMarshallingTests.shortReturnMin(), -32768);
    GIMarshallingTests.shortInMax(32767);
    GIMarshallingTests.shortInMin(-32768);
    assert.equal(GIMarshallingTests.shortOutMax(), 32767);
    assert.equal(GIMarshallingTests.shortOutMin(), -32768);
    assert.equal(GIMarshallingTests.shortInoutMaxMin(32767), -32768);
    assert.equal(GIMarshallingTests.shortInoutMinMax(-32768), 32767);
    assert.equal(GIMarshallingTests.ushortReturn(), 65535);
    GIMarshallingTests.ushortIn(65535);
    assert.equal(GIMarshallingTests.ushortOut(), 65535);
    assert.equal(GIMarshallingTests.ushortInout(65535), 0);
});

test("int and uint round trip at their bounds", () => {
    assert.equal(GIMarshallingTests.intReturnMax(), 2147483647);
    assert.equal(GIMarshallingTests.intReturnMin(), -2147483648);
    GIMarshallingTests.intInMax(2147483647);
    GIMarshallingTests.intInMin(-2147483648);
    assert.equal(GIMarshallingTests.intOutMax(), 2147483647);
    assert.equal(GIMarshallingTests.intOutMin(), -2147483648);
    assert.equal(GIMarshallingTests.intInoutMaxMin(2147483647), -2147483648);
    assert.equal(GIMarshallingTests.intInoutMinMax(-2147483648), 2147483647);
    assert.equal(GIMarshallingTests.uintReturn(), 4294967295);
    GIMarshallingTests.uintIn(4294967295);
    assert.equal(GIMarshallingTests.uintOut(), 4294967295);
    assert.equal(GIMarshallingTests.uintInout(4294967295), 0);
});

test("long and ulong use BigInt end to end", () => {
    assert.equal(GIMarshallingTests.longReturnMax(), 2n ** 63n - 1n);
    assert.equal(GIMarshallingTests.longReturnMin(), -(2n ** 63n));
    GIMarshallingTests.longInMax(2n ** 63n - 1n);
    GIMarshallingTests.longInMin(-(2n ** 63n));
    assert.equal(GIMarshallingTests.longOutMax(), 2n ** 63n - 1n);
    assert.equal(GIMarshallingTests.longOutMin(), -(2n ** 63n));
    assert.equal(GIMarshallingTests.longInoutMaxMin(2n ** 63n - 1n), -(2n ** 63n));
    assert.equal(GIMarshallingTests.longInoutMinMax(-(2n ** 63n)), 2n ** 63n - 1n);
    assert.equal(GIMarshallingTests.ulongReturn(), 2n ** 64n - 1n);
    GIMarshallingTests.ulongIn(2n ** 64n - 1n);
    assert.equal(GIMarshallingTests.ulongOut(), 2n ** 64n - 1n);
    assert.equal(GIMarshallingTests.ulongInout(2n ** 64n - 1n), 0n);
    assert.throws(() => GIMarshallingTests.longInMax(2n ** 63n));
    assert.throws(() => GIMarshallingTests.ulongIn(-1n));
    assert.throws(() => Regress.testUlong(2n ** 64n));
    assert.throws(() => Regress.testLong(2n ** 63n));
});

test("size and ssize enforce the 2^53 precision guard", () => {
    assert.equal(Regress.testSsize(-42), -42);
    assert.equal(Regress.testSsize(2 ** 53), 2 ** 53);
    assert.equal(Regress.testSsize(-(2 ** 53)), -(2 ** 53));
    assert.equal(Regress.testSize(0), 0);
    assert.equal(Regress.testSize(2 ** 53), 2 ** 53);
    assert.throws(() => GIMarshallingTests.ssizeReturnMax());
    assert.throws(() => GIMarshallingTests.ssizeReturnMin());
    assert.throws(() => GIMarshallingTests.ssizeOutMax());
    assert.throws(() => GIMarshallingTests.ssizeOutMin());
    assert.throws(() => GIMarshallingTests.sizeReturn());
    assert.throws(() => GIMarshallingTests.sizeOut());
    assert.throws(() => GIMarshallingTests.ssizeInMax(2n ** 63n - 1n));
    assert.throws(() => GIMarshallingTests.ssizeInMax(1.5));
    assert.throws(() => GIMarshallingTests.ssizeInMax(Number(2n ** 63n)));
    assert.throws(() => GIMarshallingTests.sizeIn(-1));
    assert.throws(() => Regress.testSize(2 ** 53 + 2));
    assert.throws(() => Regress.testSsize(2 ** 53 + 2));
});

test("unix scalar typedefs round trip", () => {
    assert.equal(GIMarshallingTests.timeTReturn(), 1234567890n);
    GIMarshallingTests.timeTIn(1234567890n);
    GIMarshallingTests.timeTIn(1234567890);
    assert.equal(GIMarshallingTests.timeTOut(), 1234567890n);
    assert.equal(GIMarshallingTests.timeTInout(1234567890n), 0n);
    assert.equal(GIMarshallingTests.gidTReturn(), 65534);
    GIMarshallingTests.gidTIn(65534);
    assert.equal(GIMarshallingTests.gidTOut(), 65534);
    assert.equal(GIMarshallingTests.gidTInout(65534), 0);
    assert.equal(GIMarshallingTests.uidTReturn(), 65534);
    GIMarshallingTests.uidTIn(65534);
    assert.equal(GIMarshallingTests.uidTOut(), 65534);
    assert.equal(GIMarshallingTests.uidTInout(65534), 0);
    assert.equal(GIMarshallingTests.pidTReturn(), 12345);
    GIMarshallingTests.pidTIn(12345);
    assert.equal(GIMarshallingTests.pidTOut(), 12345);
    assert.equal(GIMarshallingTests.pidTInout(12345), 0);
    assert.equal(Regress.testTimet(1234567890n), 1234567890n);
    assert.equal(RegressUnix.testGidt(65534), 65534);
    assert.equal(RegressUnix.testPidt(12345), 12345);
    assert.equal(RegressUnix.testUidt(65534), 65534);
    assert.throws(() => GIMarshallingTests.timeTIn(1234567890.5));
    assert.throws(() => RegressUnix.testGidt(-1));
});

test("uninitialized out params come back as false with a zero value", () => {
    assert.deepEqual(GIMarshallingTests.int8OutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.uint8OutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.int16OutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.uint16OutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.int32OutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.uint32OutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.int64OutUninitialized(), [false, 0n]);
    assert.deepEqual(GIMarshallingTests.uint64OutUninitialized(), [false, 0n]);
    assert.deepEqual(GIMarshallingTests.shortOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.ushortOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.intOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.uintOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.longOutUninitialized(), [false, 0n]);
    assert.deepEqual(GIMarshallingTests.ulongOutUninitialized(), [false, 0n]);
    assert.deepEqual(GIMarshallingTests.ssizeOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.sizeOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.booleanOutUninitialized(), [false, false]);
    assert.deepEqual(GIMarshallingTests.floatOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.doubleOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.timeTOutUninitialized(), [false, 0n]);
    assert.deepEqual(GIMarshallingTests.gidTOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.uidTOutUninitialized(), [false, 0]);
    assert.deepEqual(GIMarshallingTests.pidTOutUninitialized(), [false, 0]);
});

test("booleans round trip and reject non-boolean input", () => {
    assert.equal(GIMarshallingTests.booleanReturnTrue(), true);
    assert.equal(GIMarshallingTests.booleanReturnFalse(), false);
    assert.equal(GIMarshallingTests.booleanInTrue(true), undefined);
    GIMarshallingTests.booleanInFalse(false);
    assert.equal(GIMarshallingTests.booleanOutTrue(), true);
    assert.equal(GIMarshallingTests.booleanOutFalse(), false);
    assert.equal(GIMarshallingTests.booleanInoutTrueFalse(true), false);
    assert.equal(GIMarshallingTests.booleanInoutFalseTrue(false), true);
    assert.equal(Regress.testBoolean(true), true);
    assert.equal(Regress.testBoolean(false), false);
    assert.throws(() => GIMarshallingTests.booleanInTrue(1));
    assert.throws(() => GIMarshallingTests.booleanInTrue("true"));
    assert.throws(() => Regress.testBoolean(null));
    assert.throws(() => Regress.testBoolean());
});

test("unichar values round trip as single-character strings", () => {
    assert.equal(Regress.testUnichar("A"), "A");
    assert.equal(Regress.testUnichar("\u{10FFFF}"), "\u{10FFFF}");
    assert.equal(Regress.testUnichar(66), "B");
    assert.equal(Regress.testUnichar(""), "\u0000");
    assert.equal(Regress.testUnichar("\uD800"), "�");
    assert.equal(Regress.testUnichar("\uDC00"), "�");
    assert.throws(() => Regress.testUnichar("ab"));
    assert.throws(() => Regress.testUnichar(0x110000));
    assert.throws(() => Regress.testUnichar(-1));
    assert.throws(() => Regress.testUnichar(65.5));
    assert.throws(() => Regress.testUnichar(true));
});

test("regress scalar echoes return their input", () => {
    assert.equal(Regress.testInt8(-128), -128);
    assert.equal(Regress.testInt8(127), 127);
    assert.equal(Regress.testUint8(255), 255);
    assert.equal(Regress.testInt16(-32768), -32768);
    assert.equal(Regress.testUint16(65535), 65535);
    assert.equal(Regress.testInt32(-2147483648), -2147483648);
    assert.equal(Regress.testInt32(2147483647), 2147483647);
    assert.equal(Regress.testUint32(4294967295), 4294967295);
    assert.equal(Regress.testInt64(-(2n ** 63n)), -(2n ** 63n));
    assert.equal(Regress.testInt64(2n ** 63n - 1n), 2n ** 63n - 1n);
    assert.equal(Regress.testUint64(2n ** 64n - 1n), 2n ** 64n - 1n);
    assert.equal(Regress.testShort(-32768), -32768);
    assert.equal(Regress.testUshort(65535), 65535);
    assert.equal(Regress.testInt(-2147483648), -2147483648);
    assert.equal(Regress.testUint(4294967295), 4294967295);
    assert.equal(Regress.testLong(-(2n ** 63n)), -(2n ** 63n));
    assert.equal(Regress.testUlong(2n ** 64n - 1n), 2n ** 64n - 1n);
    assert.equal(Regress.testFloat(1.25), 1.25);
    assert.equal(Regress.testFloat(Math.PI), Math.fround(Math.PI));
    assert.equal(Regress.testFloat(-Infinity), -Infinity);
    assert.equal(Regress.testDouble(Math.PI), Math.PI);
    assert.equal(Regress.testDouble(Infinity), Infinity);
    assert.ok(Number.isNaN(Regress.testDouble(NaN)));
});

test("floats round trip including non-finite values", () => {
    const maxFloat = GIMarshallingTests.floatReturn();
    GIMarshallingTests.floatIn(maxFloat);
    assert.equal(GIMarshallingTests.floatInout(maxFloat), Math.fround(1.17549435e-38));
    assert.equal(GIMarshallingTests.doubleReturn(), Number.MAX_VALUE);
    GIMarshallingTests.doubleIn(Number.MAX_VALUE);
    assert.equal(GIMarshallingTests.doubleInout(Number.MAX_VALUE), 2.2250738585072014e-308);
    assert.ok(Number.isNaN(GIMarshallingTests.floatNoncanonicalNanOut()));
    assert.ok(Number.isNaN(GIMarshallingTests.doubleNoncanonicalNanOut()));
});

test("64-bit arguments accept exactly representable plain numbers", () => {
    assert.equal(Regress.testInt64(2 ** 53), 9007199254740992n);
    assert.equal(Regress.testInt64(-(2 ** 53)), -9007199254740992n);
    assert.equal(Regress.testInt64(2 ** 53 - 1), 9007199254740991n);
    assert.equal(Regress.testLong(12), 12n);
    assert.equal(GIMarshallingTests.timeTInout(1234567890), 0n);
    assert.throws(() => Regress.testInt64(2 ** 53 + 2));
    assert.throws(() => Regress.testInt64(-(2 ** 53) - 2));
    assert.throws(() => Regress.testInt64(1.5));
});

test("plain numbers are accepted where a 64-bit integer is expected", () => {
    GIMarshallingTests.arrayInt64In([-1, 0, 1, 2]);
    GIMarshallingTests.arrayUint64In([-1n, 0n, 1n, 2n].map((value) => BigInt.asUintN(64, value)));
});

test("void returns give undefined", () => {
    assert.equal(GIMarshallingTests.intInMax(2147483647), undefined);
    assert.equal(GIMarshallingTests.uint16In(65535), undefined);
    assert.equal(GIMarshallingTests.longInMin(-(2n ** 63n)), undefined);
    assert.equal(GIMarshallingTests.timeTIn(1234567890n), undefined);
    assert.equal(GIMarshallingTests.booleanInFalse(false), undefined);
});

test("null coerces to zero and missing arguments throw", () => {
    assert.equal(Regress.testInt(null), 0);
    assert.equal(Regress.testInt64(null), 0n);
    assert.equal(Regress.testUnichar(null), "\u0000");
    assert.throws(() => Regress.testInt(undefined));
    assert.throws(() => Regress.testInt());
});

test("integer arguments reject fractional and out-of-range values", () => {
    assert.throws(() => GIMarshallingTests.int8InMax(1.5));
    assert.throws(() => GIMarshallingTests.int8InMax(128));
    assert.throws(() => GIMarshallingTests.uint8In(-1));
    assert.throws(() => GIMarshallingTests.intInMax(2 ** 53));
    assert.throws(() => GIMarshallingTests.int64InMax(2n ** 63n));
    assert.throws(() => GIMarshallingTests.uint64In(-1n));
});

test("each width rejects values outside its range", () => {
    assert.throws(() => GIMarshallingTests.int16InMax(32768));
    assert.throws(() => GIMarshallingTests.int16InMin(-32769));
    assert.throws(() => GIMarshallingTests.uint16In(65536));
    assert.throws(() => GIMarshallingTests.uint16In(-1));
    assert.throws(() => GIMarshallingTests.int32InMax(2147483648));
    assert.throws(() => GIMarshallingTests.uint32In(4294967296));
    assert.throws(() => GIMarshallingTests.uint32In(-1));
    assert.throws(() => GIMarshallingTests.shortInMax(32768));
    assert.throws(() => GIMarshallingTests.ushortIn(-1));
    assert.throws(() => GIMarshallingTests.ushortIn(65536));
    assert.throws(() => GIMarshallingTests.intInMax(2147483648));
    assert.throws(() => GIMarshallingTests.uintIn(-1));
    assert.throws(() => GIMarshallingTests.uintIn(4294967296));
    assert.throws(() => GIMarshallingTests.uint16In(1.5));
    assert.throws(() => GIMarshallingTests.uint32In(2.5));
    assert.throws(() => GIMarshallingTests.shortInMax(1.5));
});

test("integer arguments reject values of the wrong type", () => {
    assert.throws(() => GIMarshallingTests.int8InMax("127"));
    assert.throws(() => GIMarshallingTests.int64InMax("big"));
    assert.throws(() => GIMarshallingTests.intInMax(Symbol("nope")));
    assert.throws(() => Regress.testInt(42n));
    assert.throws(() => Regress.testInt(true));
    assert.throws(() => Regress.testInt(NaN));
    assert.throws(() => Regress.testInt(Infinity));
    assert.throws(() => GIMarshallingTests.sizeIn(1n));
    assert.throws(() => GIMarshallingTests.uint32In({}));
});
