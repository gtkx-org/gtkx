import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const UTF8 = "const ♥ utf8";

test("utf8 strings round trip through every direction and transfer", () => {
    expect(GIMarshallingTests.CONSTANT_UTF8).toBe(UTF8);
    expect(GIMarshallingTests.utf8NoneReturn()).toBe(UTF8);
    expect(GIMarshallingTests.utf8FullReturn()).toBe(UTF8);
    GIMarshallingTests.utf8NoneIn(UTF8);
    GIMarshallingTests.utf8FullIn(UTF8);
    expect(GIMarshallingTests.utf8NoneOut()).toBe(UTF8);
    expect(GIMarshallingTests.utf8FullOut()).toBe(UTF8);
});

test("utf8 strings are encoded as utf8 bytes for byte array parameters", () => {
    const bytes = new TextEncoder().encode(UTF8);
    GIMarshallingTests.utf8AsUint8arrayIn(bytes);
    GIMarshallingTests.utf8AsUint8arrayIn([...bytes]);
    expect(new TextDecoder().decode(bytes)).toBe(GIMarshallingTests.CONSTANT_UTF8);
});

test("dangling and uninitialized out strings decode as null", () => {
    expect(GIMarshallingTests.utf8DanglingOut()).toBeNull();
    expect(GIMarshallingTests.utf8NoneOutUninitialized()).toEqual([false, null]);
});

test("invalid utf8 decodes with replacement characters", () => {
    expect(GIMarshallingTests.extraUtf8FullReturnInvalid()).toBe("invalid utf8 ��");
    expect(GIMarshallingTests.extraUtf8FullOutInvalid()).toBe("invalid utf8 ��");
    expect(Regress.testArrayOfNonUtf8Strings()).toEqual(["Andr� Lur�at"]);
});

test("regress utf8 functions exchange the documented constants", () => {
    expect(Regress.UTF8_CONSTANT).toBe(UTF8);
    expect(Regress.testUtf8ConstReturn()).toBe(UTF8);
    expect(Regress.testUtf8NonconstReturn()).toBe("nonconst ♥ utf8");
    Regress.testUtf8ConstIn(UTF8);
    expect(Regress.testUtf8Out()).toBe("nonconst ♥ utf8");
    expect(Regress.testUtf8OutOut()).toEqual(["first", "second"]);
    expect(Regress.testUtf8OutNonconstReturn()).toEqual(["first", "second"]);
    expect(Regress.testIntOutUtf8(UTF8)).toBe(12);
});

test("empty strings round trip", () => {
    expect(GIMarshallingTests.filenameCopy("")).toBe("");
    expect(Regress.testIntOutUtf8("")).toBe(0);
});

test("nullable string parameters and returns carry null", () => {
    Regress.testUtf8NullIn(null);
    // @ts-expect-error the nullable parameter is not declared optional
    Regress.testUtf8NullIn();
    expect(Regress.testUtf8NullOut()).toBeNull();
    expect(Regress.testReturnAllowNone()).toBeNull();
    expect(Regress.testReturnNullable()).toBeNull();
    expect(GIMarshallingTests.filenameCopy(null)).toBeNull();
});

test("filename strings round trip including non-ascii paths", () => {
    expect(GIMarshallingTests.filenameCopy(UTF8)).toBe(UTF8);
    expect(GIMarshallingTests.filenameExists("/")).toBe(true);
    expect(GIMarshallingTests.filenameExists("/gtkx-definitely-missing")).toBe(false);
    const repr = GIMarshallingTests.filenameToGlibRepr(UTF8);
    expect(repr instanceof Uint8Array).toBeTruthy();
    expect([...repr]).toEqual([...new TextEncoder().encode(UTF8)]);
    expect(GIMarshallingTests.filenameListReturn()).toEqual([]);
    expect(Regress.testFilenameReturn()).toEqual(["åäö", "/etc/fstab"]);
    expect(Regress.annotationReturnFilename()).toBe("a utf-8 filename");
});

test("string arrays marshal in every transfer variant", () => {
    expect(Regress.testStrvIn(["1", "2", "3"])).toBe(true);
    expect(Regress.testStrvIn(["1", "2", "4"])).toBe(false);
    expect(Regress.testStrvIn(["1", "2"])).toBe(false);
    expect(Regress.testStrvOut()).toEqual(["thanks", "for", "all", "the", "fish"]);
    expect(Regress.testStrvOutC()).toEqual(["thanks", "for", "all", "the", "fish"]);
    expect(Regress.testStrvOutContainer()).toEqual(["1", "2", "3"]);
    expect(Regress.testStrvOutarg()).toEqual(["1", "2", "3"]);
    expect(Regress.annotationStringZeroTerminated()).toEqual([]);
    Regress.annotationStringArrayLength(["a", "b"]);
    Regress.annotationStringArrayLength([]);
});

test("string arrays unwrap from GValues including the null strv", () => {
    expect(Regress.testStrvInGvalue()).toEqual(["one", "two", "three"]);
    expect(Regress.testNullStrvInGvalue()).toEqual([]);
});

test("string arguments reject values of the wrong type", () => {
    expect(() => {
        // @ts-expect-error a number is not a string
        GIMarshallingTests.utf8NoneIn(42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a string
        GIMarshallingTests.utf8NoneIn(Symbol("nope"));
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a string
        GIMarshallingTests.utf8NoneIn({});
    }).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a string
        GIMarshallingTests.utf8FullIn(42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a plain object is not a string
        Regress.testUtf8ConstIn({});
    }).toThrow();
    // @ts-expect-error a number is not a filename
    expect(() => GIMarshallingTests.filenameExists(7)).toThrow();
});

test("a non-nullable string parameter rejects null instead of marshalling NULL", () => {
    expect(() => {
        // @ts-expect-error the parameter is not nullable
        GIMarshallingTests.utf8NoneIn(null);
    }).toThrow();
    expect(() => {
        // @ts-expect-error the parameter is not optional
        GIMarshallingTests.utf8NoneIn();
    }).toThrow();
    // @ts-expect-error the string parameter is not nullable
    expect(() => Regress.TestBoxedD.new(null, 1)).toThrow();
});

test("a nullable parameter still accepts null", () => {
    Regress.funcObjNullIn(null);
    Regress.funcObjNullableIn(null);
    GIMarshallingTests.utf8NoneIn(UTF8);
    expect(Regress.TestBoxedD.new("ok", 1).getMagic()).toBe(3);
});

test("string array arguments reject non-arrays and non-string elements", () => {
    // @ts-expect-error a bare string is not a string array
    expect(() => Regress.testStrvIn("123")).toThrow();
    // @ts-expect-error a number array is not a string array
    expect(() => Regress.testStrvIn([1, 2, 3])).toThrow();
    // @ts-expect-error a number is not a string element
    expect(() => Regress.testStrvIn(["1", 2, "3"])).toThrow();
});
