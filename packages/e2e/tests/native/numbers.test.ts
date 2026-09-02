import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import * as RegressUnix from "@gtkx/gi/regressunix";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const SMALLEST_NORMAL_DOUBLE = 2 ** -1022;

test("8-bit integers round trip at their bounds", () => {
    expect(GIMarshallingTests.int8ReturnMax()).toBe(127);
    expect(GIMarshallingTests.int8ReturnMin()).toBe(-128);
    GIMarshallingTests.int8InMax(127);
    GIMarshallingTests.int8InMin(-128);
    expect(GIMarshallingTests.int8OutMax()).toBe(127);
    expect(GIMarshallingTests.int8OutMin()).toBe(-128);
    expect(GIMarshallingTests.int8InoutMaxMin(127)).toBe(-128);
    expect(GIMarshallingTests.int8InoutMinMax(-128)).toBe(127);
    expect(GIMarshallingTests.uint8Return()).toBe(0xFF);
    GIMarshallingTests.uint8In(0xFF);
    expect(GIMarshallingTests.uint8Out()).toBe(0xFF);
    expect(GIMarshallingTests.uint8Inout(0xFF)).toBe(0);
});

test("16-bit integers round trip at their bounds", () => {
    expect(GIMarshallingTests.int16ReturnMax()).toBe(32_767);
    expect(GIMarshallingTests.int16ReturnMin()).toBe(-32_768);
    GIMarshallingTests.int16InMax(32_767);
    GIMarshallingTests.int16InMin(-32_768);
    expect(GIMarshallingTests.int16OutMax()).toBe(32_767);
    expect(GIMarshallingTests.int16OutMin()).toBe(-32_768);
    expect(GIMarshallingTests.int16InoutMaxMin(32_767)).toBe(-32_768);
    expect(GIMarshallingTests.int16InoutMinMax(-32_768)).toBe(32_767);
    expect(GIMarshallingTests.uint16Return()).toBe(65_535);
    GIMarshallingTests.uint16In(65_535);
    expect(GIMarshallingTests.uint16Out()).toBe(65_535);
    expect(GIMarshallingTests.uint16Inout(65_535)).toBe(0);
});

test("32-bit integers round trip at their bounds", () => {
    expect(GIMarshallingTests.int32ReturnMax()).toBe(2_147_483_647);
    expect(GIMarshallingTests.int32ReturnMin()).toBe(-2_147_483_648);
    GIMarshallingTests.int32InMax(2_147_483_647);
    GIMarshallingTests.int32InMin(-2_147_483_648);
    expect(GIMarshallingTests.int32OutMax()).toBe(2_147_483_647);
    expect(GIMarshallingTests.int32OutMin()).toBe(-2_147_483_648);
    expect(GIMarshallingTests.int32InoutMaxMin(2_147_483_647)).toBe(-2_147_483_648);
    expect(GIMarshallingTests.int32InoutMinMax(-2_147_483_648)).toBe(2_147_483_647);
    expect(GIMarshallingTests.uint32Return()).toBe(4_294_967_295);
    GIMarshallingTests.uint32In(4_294_967_295);
    expect(GIMarshallingTests.uint32Out()).toBe(4_294_967_295);
    expect(GIMarshallingTests.uint32Inout(4_294_967_295)).toBe(0);
});

test("64-bit integers use BigInt end to end", () => {
    expect(GIMarshallingTests.int64ReturnMax()).toBe(2n ** 63n - 1n);
    expect(GIMarshallingTests.int64ReturnMin()).toBe(-(2n ** 63n));
    GIMarshallingTests.int64InMax(2n ** 63n - 1n);
    GIMarshallingTests.int64InMin(-(2n ** 63n));
    expect(GIMarshallingTests.int64OutMax()).toBe(2n ** 63n - 1n);
    expect(GIMarshallingTests.int64OutMin()).toBe(-(2n ** 63n));
    expect(GIMarshallingTests.int64InoutMaxMin(2n ** 63n - 1n)).toBe(-(2n ** 63n));
    expect(GIMarshallingTests.uint64Return()).toBe(2n ** 64n - 1n);
    GIMarshallingTests.uint64In(2n ** 64n - 1n);
    expect(GIMarshallingTests.uint64Out()).toBe(2n ** 64n - 1n);
    expect(GIMarshallingTests.uint64Inout(2n ** 64n - 1n)).toBe(0n);
});

test("short and ushort round trip at their bounds", () => {
    expect(GIMarshallingTests.shortReturnMax()).toBe(32_767);
    expect(GIMarshallingTests.shortReturnMin()).toBe(-32_768);
    GIMarshallingTests.shortInMax(32_767);
    GIMarshallingTests.shortInMin(-32_768);
    expect(GIMarshallingTests.shortOutMax()).toBe(32_767);
    expect(GIMarshallingTests.shortOutMin()).toBe(-32_768);
    expect(GIMarshallingTests.shortInoutMaxMin(32_767)).toBe(-32_768);
    expect(GIMarshallingTests.shortInoutMinMax(-32_768)).toBe(32_767);
    expect(GIMarshallingTests.ushortReturn()).toBe(65_535);
    GIMarshallingTests.ushortIn(65_535);
    expect(GIMarshallingTests.ushortOut()).toBe(65_535);
    expect(GIMarshallingTests.ushortInout(65_535)).toBe(0);
});

test("int and uint round trip at their bounds", () => {
    expect(GIMarshallingTests.intReturnMax()).toBe(2_147_483_647);
    expect(GIMarshallingTests.intReturnMin()).toBe(-2_147_483_648);
    GIMarshallingTests.intInMax(2_147_483_647);
    GIMarshallingTests.intInMin(-2_147_483_648);
    expect(GIMarshallingTests.intOutMax()).toBe(2_147_483_647);
    expect(GIMarshallingTests.intOutMin()).toBe(-2_147_483_648);
    expect(GIMarshallingTests.intInoutMaxMin(2_147_483_647)).toBe(-2_147_483_648);
    expect(GIMarshallingTests.intInoutMinMax(-2_147_483_648)).toBe(2_147_483_647);
    expect(GIMarshallingTests.uintReturn()).toBe(4_294_967_295);
    GIMarshallingTests.uintIn(4_294_967_295);
    expect(GIMarshallingTests.uintOut()).toBe(4_294_967_295);
    expect(GIMarshallingTests.uintInout(4_294_967_295)).toBe(0);
});

test("long and ulong use BigInt end to end", () => {
    expect(GIMarshallingTests.longReturnMax()).toBe(2n ** 63n - 1n);
    expect(GIMarshallingTests.longReturnMin()).toBe(-(2n ** 63n));
    GIMarshallingTests.longInMax(2n ** 63n - 1n);
    GIMarshallingTests.longInMin(-(2n ** 63n));
    expect(GIMarshallingTests.longOutMax()).toBe(2n ** 63n - 1n);
    expect(GIMarshallingTests.longOutMin()).toBe(-(2n ** 63n));
    expect(GIMarshallingTests.longInoutMaxMin(2n ** 63n - 1n)).toBe(-(2n ** 63n));
    expect(GIMarshallingTests.longInoutMinMax(-(2n ** 63n))).toBe(2n ** 63n - 1n);
    expect(GIMarshallingTests.ulongReturn()).toBe(2n ** 64n - 1n);
    GIMarshallingTests.ulongIn(2n ** 64n - 1n);
    expect(GIMarshallingTests.ulongOut()).toBe(2n ** 64n - 1n);
    expect(GIMarshallingTests.ulongInout(2n ** 64n - 1n)).toBe(0n);
    expect(() => {
        GIMarshallingTests.longInMax(2n ** 63n);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ulongIn(-1n);
    }).toThrow();
    expect(() => Regress.testUlong(2n ** 64n)).toThrow();
    expect(() => Regress.testLong(2n ** 63n)).toThrow();
});

test("size and ssize enforce the 2^53 precision guard", () => {
    expect(Regress.testSsize(-42)).toBe(-42);
    expect(Regress.testSsize(2 ** 53)).toBe(2 ** 53);
    expect(Regress.testSsize(-(2 ** 53))).toBe(-(2 ** 53));
    expect(Regress.testSize(0)).toBe(0);
    expect(Regress.testSize(2 ** 53)).toBe(2 ** 53);
    expect(() => GIMarshallingTests.ssizeReturnMax()).toThrow();
    expect(() => GIMarshallingTests.ssizeReturnMin()).toThrow();
    expect(() => GIMarshallingTests.ssizeOutMax()).toThrow();
    expect(() => GIMarshallingTests.ssizeOutMin()).toThrow();
    expect(() => GIMarshallingTests.sizeReturn()).toThrow();
    expect(() => GIMarshallingTests.sizeOut()).toThrow();
    expect(() => {
        // @ts-expect-error a bigint is not an ssize argument
        GIMarshallingTests.ssizeInMax(2n ** 63n - 1n);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ssizeInMax(1.5);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ssizeInMax(Number(2n ** 63n));
    }).toThrow();
    expect(() => {
        GIMarshallingTests.sizeIn(-1);
    }).toThrow();
    expect(() => Regress.testSize(2 ** 53 + 2)).toThrow();
    expect(() => Regress.testSsize(2 ** 53 + 2)).toThrow();
});

test("unix scalar typedefs round trip", () => {
    expect(GIMarshallingTests.timeTReturn()).toBe(1_234_567_890n);
    GIMarshallingTests.timeTIn(1_234_567_890n);
    // @ts-expect-error the parameter is declared bigint, and the binding widens it to a plain number
    GIMarshallingTests.timeTIn(1_234_567_890);
    expect(GIMarshallingTests.timeTOut()).toBe(1_234_567_890n);
    expect(GIMarshallingTests.timeTInout(1_234_567_890n)).toBe(0n);
    expect(GIMarshallingTests.gidTReturn()).toBe(65_534);
    GIMarshallingTests.gidTIn(65_534);
    expect(GIMarshallingTests.gidTOut()).toBe(65_534);
    expect(GIMarshallingTests.gidTInout(65_534)).toBe(0);
    expect(GIMarshallingTests.uidTReturn()).toBe(65_534);
    GIMarshallingTests.uidTIn(65_534);
    expect(GIMarshallingTests.uidTOut()).toBe(65_534);
    expect(GIMarshallingTests.uidTInout(65_534)).toBe(0);
    expect(GIMarshallingTests.pidTReturn()).toBe(12_345);
    GIMarshallingTests.pidTIn(12_345);
    expect(GIMarshallingTests.pidTOut()).toBe(12_345);
    expect(GIMarshallingTests.pidTInout(12_345)).toBe(0);
    expect(Regress.testTimet(1_234_567_890n)).toBe(1_234_567_890n);
    expect(RegressUnix.testGidt(65_534)).toBe(65_534);
    expect(RegressUnix.testPidt(12_345)).toBe(12_345);
    expect(RegressUnix.testUidt(65_534)).toBe(65_534);
    expect(() => {
        // @ts-expect-error a fractional number is not a time_t
        GIMarshallingTests.timeTIn(1_234_567_890.5);
    }).toThrow();
    expect(() => RegressUnix.testGidt(-1)).toThrow();
});

test("uninitialized out params come back as false with a zero value", () => {
    expect(GIMarshallingTests.int8OutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.uint8OutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.int16OutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.uint16OutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.int32OutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.uint32OutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.int64OutUninitialized()).toEqual([false, 0n]);
    expect(GIMarshallingTests.uint64OutUninitialized()).toEqual([false, 0n]);
    expect(GIMarshallingTests.shortOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.ushortOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.intOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.uintOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.longOutUninitialized()).toEqual([false, 0n]);
    expect(GIMarshallingTests.ulongOutUninitialized()).toEqual([false, 0n]);
    expect(GIMarshallingTests.ssizeOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.sizeOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.booleanOutUninitialized()).toEqual([false, false]);
    expect(GIMarshallingTests.floatOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.doubleOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.timeTOutUninitialized()).toEqual([false, 0n]);
    expect(GIMarshallingTests.gidTOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.uidTOutUninitialized()).toEqual([false, 0]);
    expect(GIMarshallingTests.pidTOutUninitialized()).toEqual([false, 0]);
});

test("booleans round trip and reject non-boolean input", () => {
    const booleanInTrue: (isSet: boolean) => unknown = GIMarshallingTests.booleanInTrue;

    expect(GIMarshallingTests.booleanReturnTrue()).toBe(true);
    expect(GIMarshallingTests.booleanReturnFalse()).toBe(false);
    expect(booleanInTrue(true)).toBeUndefined();
    GIMarshallingTests.booleanInFalse(false);
    expect(GIMarshallingTests.booleanOutTrue()).toBe(true);
    expect(GIMarshallingTests.booleanOutFalse()).toBe(false);
    expect(GIMarshallingTests.booleanInoutTrueFalse(true)).toBe(false);
    expect(GIMarshallingTests.booleanInoutFalseTrue(false)).toBe(true);
    expect(Regress.testBoolean(true)).toBe(true);
    expect(Regress.testBoolean(false)).toBe(false);
    expect(() => {
        // @ts-expect-error a number is not a boolean
        GIMarshallingTests.booleanInTrue(1);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not a boolean
        GIMarshallingTests.booleanInTrue("true");
    }).toThrow();
    // @ts-expect-error the boolean parameter is not nullable
    expect(() => Regress.testBoolean(null)).toThrow();
    // @ts-expect-error the boolean parameter is not optional
    expect(() => Regress.testBoolean()).toThrow();
});

test("unichar values round trip as single-character strings", () => {
    expect(Regress.testUnichar("A")).toBe("A");
    expect(Regress.testUnichar("\u{10FFFF}")).toBe("\u{10FFFF}");
    // @ts-expect-error a number is not a unichar string
    expect(Regress.testUnichar(66)).toBe("B");
    expect(Regress.testUnichar("")).toBe("\u{0}");
    expect(Regress.testUnichar(String.fromCodePoint(0xD8_00))).toBe("\u{FFFD}");
    expect(Regress.testUnichar(String.fromCodePoint(0xDC_00))).toBe("\u{FFFD}");
    expect(() => Regress.testUnichar("ab")).toThrow();
    // @ts-expect-error a number is not a unichar string
    expect(() => Regress.testUnichar(0x11_00_00)).toThrow();
    // @ts-expect-error a number is not a unichar string
    expect(() => Regress.testUnichar(-1)).toThrow();
    // @ts-expect-error a number is not a unichar string
    expect(() => Regress.testUnichar(65.5)).toThrow();
    // @ts-expect-error a boolean is not a unichar string
    expect(() => Regress.testUnichar(true)).toThrow();
});

test("regress scalar echoes return their input", () => {
    expect(Regress.testInt8(-128)).toBe(-128);
    expect(Regress.testInt8(127)).toBe(127);
    expect(Regress.testUint8(255)).toBe(255);
    expect(Regress.testInt16(-32_768)).toBe(-32_768);
    expect(Regress.testUint16(65_535)).toBe(65_535);
    expect(Regress.testInt32(-2_147_483_648)).toBe(-2_147_483_648);
    expect(Regress.testInt32(2_147_483_647)).toBe(2_147_483_647);
    expect(Regress.testUint32(4_294_967_295)).toBe(4_294_967_295);
    expect(Regress.testInt64(-(2n ** 63n))).toBe(-(2n ** 63n));
    expect(Regress.testInt64(2n ** 63n - 1n)).toBe(2n ** 63n - 1n);
    expect(Regress.testUint64(2n ** 64n - 1n)).toBe(2n ** 64n - 1n);
    expect(Regress.testShort(-32_768)).toBe(-32_768);
    expect(Regress.testUshort(65_535)).toBe(65_535);
    expect(Regress.testInt(-2_147_483_648)).toBe(-2_147_483_648);
    expect(Regress.testUint(4_294_967_295)).toBe(4_294_967_295);
    expect(Regress.testLong(-(2n ** 63n))).toBe(-(2n ** 63n));
    expect(Regress.testUlong(2n ** 64n - 1n)).toBe(2n ** 64n - 1n);
    expect(Regress.testFloat(1.25)).toBe(1.25);
    expect(Regress.testFloat(Math.PI)).toBe(Math.fround(Math.PI));
    expect(Regress.testFloat(-Infinity)).toBe(-Infinity);
    expect(Regress.testDouble(Math.PI)).toBe(Math.PI);
    expect(Regress.testDouble(Infinity)).toBe(Infinity);
    expect(Number.isNaN(Regress.testDouble(NaN))).toBeTruthy();
});

test("floats round trip including non-finite values", () => {
    const maxFloat = GIMarshallingTests.floatReturn();
    GIMarshallingTests.floatIn(maxFloat);
    expect(GIMarshallingTests.floatInout(maxFloat)).toBe(Math.fround(1.17549435e-38));
    expect(GIMarshallingTests.doubleReturn()).toBe(Number.MAX_VALUE);
    GIMarshallingTests.doubleIn(Number.MAX_VALUE);
    expect(GIMarshallingTests.doubleInout(Number.MAX_VALUE)).toBe(SMALLEST_NORMAL_DOUBLE);
    expect(Number.isNaN(GIMarshallingTests.floatNoncanonicalNanOut())).toBeTruthy();
    expect(Number.isNaN(GIMarshallingTests.doubleNoncanonicalNanOut())).toBeTruthy();
});

test("64-bit arguments accept exactly representable plain numbers", () => {
    // @ts-expect-error the parameter is declared bigint, and the binding widens it to a plain number
    expect(Regress.testInt64(2 ** 53)).toBe(9_007_199_254_740_992n);
    // @ts-expect-error the parameter is declared bigint, and the binding widens it to a plain number
    expect(Regress.testInt64(-(2 ** 53))).toBe(-9_007_199_254_740_992n);
    // @ts-expect-error the parameter is declared bigint, and the binding widens it to a plain number
    expect(Regress.testInt64(2 ** 53 - 1)).toBe(9_007_199_254_740_991n);
    // @ts-expect-error the parameter is declared bigint, and the binding widens it to a plain number
    expect(Regress.testLong(12)).toBe(12n);
    // @ts-expect-error the parameter is declared bigint, and the binding widens it to a plain number
    expect(GIMarshallingTests.timeTInout(1_234_567_890)).toBe(0n);
    // @ts-expect-error a plain number beyond 2^53 is not an exact 64-bit integer
    expect(() => Regress.testInt64(2 ** 53 + 2)).toThrow();
    // @ts-expect-error a plain number beyond 2^53 is not an exact 64-bit integer
    expect(() => Regress.testInt64(-(2 ** 53) - 2)).toThrow();
    // @ts-expect-error a fractional number is not a 64-bit integer
    expect(() => Regress.testInt64(1.5)).toThrow();
});

test("plain numbers are accepted where a 64-bit integer is expected", () => {
    // @ts-expect-error the element is declared bigint, and the binding widens it to a plain number
    GIMarshallingTests.arrayInt64In([-1, 0, 1, 2]);
    GIMarshallingTests.arrayUint64In([-1n, 0n, 1n, 2n].map((value) => BigInt.asUintN(64, value)));
    // @ts-expect-error the element is declared bigint, and the binding widens it to a plain number
    expect(Regress.testArrayGint64In([1, 2, 3, 4])).toBe(10n);
});

test("void returns give undefined", () => {
    const intInMax: (value: number) => unknown = GIMarshallingTests.intInMax;
    const uint16In: (value: number) => unknown = GIMarshallingTests.uint16In;
    const longInMin: (value: bigint) => unknown = GIMarshallingTests.longInMin;
    const timeTIn: (value: bigint) => unknown = GIMarshallingTests.timeTIn;
    const booleanInFalse: (isSet: boolean) => unknown = GIMarshallingTests.booleanInFalse;

    expect(intInMax(2_147_483_647)).toBeUndefined();
    expect(uint16In(65_535)).toBeUndefined();
    expect(longInMin(-(2n ** 63n))).toBeUndefined();
    expect(timeTIn(1_234_567_890n)).toBeUndefined();
    expect(booleanInFalse(false)).toBeUndefined();
});

test("null coerces to zero and missing arguments throw", () => {
    // @ts-expect-error the int parameter is not nullable
    expect(Regress.testInt(null)).toBe(0);
    // @ts-expect-error the int64 parameter is not nullable
    expect(Regress.testInt64(null)).toBe(0n);
    // @ts-expect-error the unichar parameter is not nullable
    expect(Regress.testUnichar(null)).toBe("\u{0}");
    // @ts-expect-error the int parameter is not optional
    expect(() => Regress.testInt()).toThrow();
    // @ts-expect-error the int parameter is not optional
    expect(() => Regress.testInt()).toThrow();
});

test("integer arguments reject fractional and out-of-range values", () => {
    expect(() => {
        GIMarshallingTests.int8InMax(1.5);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.int8InMax(128);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint8In(-1);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.intInMax(2 ** 53);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.int64InMax(2n ** 63n);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint64In(-1n);
    }).toThrow();
});

test("each width rejects values outside its range", () => {
    expect(() => {
        GIMarshallingTests.int16InMax(32_768);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.int16InMin(-32_769);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint16In(65_536);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint16In(-1);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.int32InMax(2_147_483_648);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint32In(4_294_967_296);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint32In(-1);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.shortInMax(32_768);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ushortIn(-1);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.ushortIn(65_536);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.intInMax(2_147_483_648);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uintIn(-1);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uintIn(4_294_967_296);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint16In(1.5);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.uint32In(2.5);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.shortInMax(1.5);
    }).toThrow();
});

test("integer arguments reject values of the wrong type", () => {
    expect(() => {
        // @ts-expect-error a string is not an int8
        GIMarshallingTests.int8InMax("127");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an int64
        GIMarshallingTests.int64InMax("big");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not an int
        GIMarshallingTests.intInMax(Symbol("nope"));
    }).toThrow();
    // @ts-expect-error a bigint is not an int
    expect(() => Regress.testInt(42n)).toThrow();
    // @ts-expect-error a boolean is not an int
    expect(() => Regress.testInt(true)).toThrow();
    expect(() => Regress.testInt(NaN)).toThrow();
    expect(() => Regress.testInt(Infinity)).toThrow();
    expect(() => {
        // @ts-expect-error a bigint is not a size
        GIMarshallingTests.sizeIn(1n);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a uint32
        GIMarshallingTests.uint32In({});
    }).toThrow();
});
