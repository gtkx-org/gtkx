import { Variant } from "@gtkx/gi/glib";
import { describe, expect, it } from "vitest";

const parse = (text: string): Variant => Variant.parse(null, text, null, null);

const expectVariant = (value: unknown): Variant => {
    expect(value).toBeInstanceOf(Variant);

    if (value instanceof Variant) {
        return value;
    }

    throw new Error("Expected a Variant");
};

describe("GJS-compatible Variant construction", () => {
    it("constructs canonical variants with the constructor and static alias", () => {
        const constructed = new Variant("(sa{sv})", ["state", { count: new Variant("i", 42) }]);
        const aliased = Variant.new("(sa{sv})", ["state", { count: Variant.new("i", 42) }]);

        expect(constructed).toBeInstanceOf(Variant);
        expect(aliased).toBeInstanceOf(Variant);
        expect(constructed.equal(parse("('state', {'count': <42>})"))).toBe(true);
        expect(aliased.equal(constructed)).toBe(true);
        expect(constructed.recursiveUnpack()).toEqual(["state", { count: 42 }]);
    });

    it("supports the existing native factories and their returned child variants", () => {
        const native = Variant.newTuple([Variant.newString("native"), Variant.newInt32(7)]);

        expect(native).toBeInstanceOf(Variant);
        expect(native.deepUnpack()).toEqual(["native", 7]);
        expect(native.getChildValue(0)).toBeInstanceOf(Variant);
        expect(native.getChildValue(0).unpack()).toBe("native");
        expect(native.getChildValue(1).recursiveUnpack()).toBe(7);
    });

    it("packs numeric dictionary keys supplied as object properties", () => {
        const dictionary = new Variant("a{is}", { 1: "one", 2: "two" });

        expect(dictionary.equal(parse("@a{is} {1: 'one', 2: 'two'}"))).toBe(true);
        expect(dictionary.deepUnpack()).toEqual({ 1: "one", 2: "two" });
    });

    it("rejects Map inputs instead of silently packing an empty dictionary", () => {
        const dictionaryType: string = "a{is}";

        expect(() => new Variant(dictionaryType, new Map([[1, "one"]]))).toThrow();
    });

    it("accepts safe 64-bit numbers while preserving full bigint precision", () => {
        expect(new Variant("x", -42).deepUnpack()).toBe(-42n);
        expect(Variant.new("t", Number.MAX_SAFE_INTEGER).unpack()).toBe(BigInt(Number.MAX_SAFE_INTEGER));
        expect(new Variant("x", -9_223_372_036_854_775_808n).recursiveUnpack()).toBe(-9_223_372_036_854_775_808n);
        expect(new Variant("t", 18_446_744_073_709_551_615n).deepUnpack()).toBe(18_446_744_073_709_551_615n);
    });

    it.each([Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        "rejects the inexact 64-bit numeric input %s",
        (value) => {
            expect(() => new Variant("x", value)).toThrow();
            expect(() => Variant.new("t", value)).toThrow();
        },
    );

    it.each(["", "z", "ss", "a", "m", "(si", "{sv", "a{vs}", "a{asi}"])(
        "rejects the invalid type string %s",
        (typeString) => {
            expect(() => new Variant(typeString, null)).toThrow();
            expect(() => Variant.new(typeString, null)).toThrow();
        },
    );

    it("rejects invalid object paths and signature values", () => {
        expect(() => new Variant("o", "not a path")).toThrow();
        expect(() => Variant.new("g", "not a signature")).toThrow();
    });
});

describe("GJS-compatible Variant unpacking", () => {
    const containers = [
        { text: "@aai [[1, 2], [3]]", childTypes: ["ai", "ai"], value: [[1, 2], [3]] },
        { text: "('hello', [1, 2])", childTypes: ["s", "ai"], value: ["hello", [1, 2]] },
        { text: "{'key', 7}", childTypes: ["s", "i"], value: ["key", 7] },
    ];

    it.each(containers)("distinguishes shallow and deep unpacking for $text", ({ text, childTypes, value }) => {
        const variant = parse(text);
        const shallow = variant.unpack();

        expect(Array.isArray(shallow)).toBe(true);

        if (!Array.isArray(shallow)) {
            throw new Error("Expected an array of child variants");
        }

        expect(shallow.map((child) => expectVariant(child).getTypeString())).toEqual(childTypes);
        expect(variant.deepUnpack()).toEqual(value);
        expect(variant.deep_unpack()).toEqual(value);
        expect(variant.recursiveUnpack()).toEqual(value);
    });

    it("unpacks dictionary keys while retaining the selected depth for their values", () => {
        const variant = parse("@a{sv} {'answer': <42>, 'nested': <{'name': <'value'>}>}");
        const shallow = variant.unpack<"a{sv}">();
        const deep = variant.deepUnpack<"a{sv}">();

        expect(expectVariant(shallow.answer).getTypeString()).toBe("v");
        expect(expectVariant(shallow.nested).getTypeString()).toBe("v");
        expect(expectVariant(deep.answer).getTypeString()).toBe("i");
        expect(expectVariant(deep.answer).unpack()).toBe(42);
        expect(expectVariant(deep.nested).getTypeString()).toBe("a{sv}");
        expect(variant.recursiveUnpack()).toEqual({ answer: 42, nested: { name: "value" } });
    });

    it("unpacks numeric dictionaries from native APIs into records at every depth", () => {
        const variant = parse("@a{iv} {1: <'one'>}");
        const shallow = variant.unpack<"a{iv}">();
        const deep = variant.deepUnpack<"a{iv}">();

        expect(Object.getPrototypeOf(shallow)).toBe(Object.prototype);
        expect(Object.keys(shallow)).toEqual(["1"]);
        expect(expectVariant(shallow[1]).getTypeString()).toBe("v");
        expect(Object.getPrototypeOf(deep)).toBe(Object.prototype);
        expect(expectVariant(deep[1]).unpack()).toBe("one");
        expect(variant.recursiveUnpack()).toEqual({ 1: "one" });
    });

    it("preserves present maybe children for shallow unpacking and null for absent ones", () => {
        const present = new Variant("mas", ["one", "two"]);
        const absent = new Variant("mas", null);

        expect(expectVariant(present.unpack()).getTypeString()).toBe("as");
        expect(present.deepUnpack()).toEqual(["one", "two"]);
        expect(present.recursiveUnpack()).toEqual(["one", "two"]);
        expect(absent.unpack()).toBeNull();
        expect(absent.deepUnpack()).toBeNull();
        expect(absent.recursiveUnpack()).toBeNull();
    });

    it("stops at boxed variants unless recursive unpacking is requested", () => {
        const variant = new Variant("mv", new Variant("v", new Variant("s", "value")));

        expect(expectVariant(variant.unpack()).getTypeString()).toBe("v");
        expect(expectVariant(variant.deepUnpack()).getTypeString()).toBe("v");
        expect(expectVariant(variant.deep_unpack()).getTypeString()).toBe("v");
        expect(variant.recursiveUnpack()).toBe("value");
    });

    it("preserves special dictionary names as own properties", () => {
        const expected = Object.fromEntries([["__proto__", "safe"], ["constructor", "value"]]);
        const variant = new Variant("a{ss}", expected);
        const unpacked = variant.deepUnpack();

        expect(unpacked).toEqual(expected);
        expect(Object.getPrototypeOf(unpacked)).toBe(Object.prototype);
        expect(Object.hasOwn(unpacked, "__proto__")).toBe(true);
        expect(variant.recursiveUnpack()).toEqual(expected);
    });

    it("unpacks empty native containers without losing their shapes", () => {
        for (const variant of [parse("@as []"), parse("()")]) {
            expect(variant.unpack()).toEqual([]);
            expect(variant.deepUnpack()).toEqual([]);
            expect(variant.recursiveUnpack()).toEqual([]);
        }

        const dictionary = parse("@a{sv} {}");
        expect(dictionary.unpack()).toEqual({});
        expect(dictionary.deepUnpack()).toEqual({});
        expect(dictionary.recursiveUnpack()).toEqual({});
    });
});

describe("GJS-compatible byte array construction", () => {
    it.each([
        { text: "", bytes: [0] },
        { text: "hé", bytes: [104, 195, 169, 0] },
        { text: "a\0b", bytes: [97, 0, 98, 0] },
    ])("encodes and terminates the string $text", ({ text, bytes }) => {
        const variant = new Variant("ay", text);
        const expected = new Uint8Array(bytes);

        expect(variant.unpack()).toEqual(expected);
        expect(variant.deepUnpack()).toEqual(expected);
        expect(variant.recursiveUnpack()).toEqual(expected);
    });

    it("preserves supplied byte values and returns Uint8Array at every depth", () => {
        for (const value of [[], [0, 1, 255], new Uint8Array(), new Uint8Array([0, 1, 255])]) {
            const variant = Variant.new("ay", value);
            const expected = new Uint8Array(value);

            expect(variant.unpack()).toBeInstanceOf(Uint8Array);
            expect(variant.unpack()).toEqual(expected);
            expect(variant.deepUnpack()).toEqual(expected);
            expect(variant.recursiveUnpack()).toEqual(expected);
        }

        expect(parse("@ay [1, 2]").unpack()).toEqual(new Uint8Array([1, 2]));
    });

    it("handles strings and typed bytes inside nested containers", () => {
        const variant = new Variant("aay", ["a", new Uint8Array([2, 3])]);

        expect(variant.deepUnpack()).toEqual([new Uint8Array([97, 0]), new Uint8Array([2, 3])]);
        expect(variant.recursiveUnpack()).toEqual([new Uint8Array([97, 0]), new Uint8Array([2, 3])]);
    });
});
