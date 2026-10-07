import {
    type RecursiveVariantValue,
    type ShallowVariantValue,
    Variant,
    type VariantByteArray,
    type VariantInput,
    type VariantValue,
} from "@gtkx/gi/glib";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("generated Variant types", () => {
    it("infers the signature and unpacking depth of constructed variants", () => {
        const packed = new Variant("(a{iv}aymx)", [{ 1: new Variant("s", "value") }, "text", 9]);
        const shallow = packed.unpack();
        const deep = packed.deepUnpack();
        const recursive = packed.recursiveUnpack();

        expectTypeOf(packed).toEqualTypeOf<Variant<"(a{iv}aymx)">>();
        expectTypeOf(shallow).toEqualTypeOf<[Variant, Variant, Variant]>();
        expectTypeOf(deep).toEqualTypeOf<[Record<string, Variant>, Uint8Array, bigint | null]>();
        expectTypeOf(recursive).toEqualTypeOf<[Record<string, unknown>, Uint8Array, bigint | null]>();
        expectTypeOf(packed.deep_unpack()).toEqualTypeOf(deep);
        expectTypeOf<VariantInput<"ay">>().toEqualTypeOf<Uint8Array | number[] | string>();
        expectTypeOf<VariantInput<"x">>().toEqualTypeOf<bigint | number>();
        expectTypeOf<VariantInput<"i">>().toEqualTypeOf<number>();
        expectTypeOf<VariantInput<"a{is}">>().toEqualTypeOf<Record<string, string>>();
        expectTypeOf<ShallowVariantValue<`a${string}`>>().toEqualTypeOf<unknown>();

        expect(deep[0][1]).toBeInstanceOf(Variant);
        expect(deep[1]).toEqual(new Uint8Array([116, 101, 120, 116, 0]));
        expect(deep[2]).toBe(9n);
        expect(recursive[0]).toEqual({ 1: "value" });
    });

    it("infers static construction while leaving native return signatures unknown", () => {
        const packed = Variant.new("s", "value");
        const native = Variant.newInt32(42);

        expectTypeOf(packed).toEqualTypeOf<Variant<"s">>();
        expectTypeOf(packed.deepUnpack()).toEqualTypeOf<string>();
        expectTypeOf(native.deepUnpack()).toEqualTypeOf<unknown>();
        expectTypeOf(native.deepUnpack<"i">()).toEqualTypeOf<number>();
        expect(packed.deepUnpack()).toBe("value");
        expect(native.deepUnpack()).toBe(42);
    });

    it("preserves the generated Variant class inside nested containers", () => {
        const input: VariantInput<"(sa{sv}aymx)"> = ["state", { count: new Variant("i", 42) }, [1, 2], 9n];
        const packed = new Variant("(sa{sv}aymx)", input);
        const unpacked = packed.deepUnpack();

        expectTypeOf(packed).toEqualTypeOf<Variant<"(sa{sv}aymx)">>();
        expectTypeOf(unpacked).toEqualTypeOf<[string, Record<string, Variant>, Uint8Array, bigint | null]>();
        expectTypeOf(unpacked).toEqualTypeOf<VariantValue<"(sa{sv}aymx)">>();
        expectTypeOf<VariantByteArray>().toEqualTypeOf<Uint8Array>();
        expectTypeOf<VariantInput<"v">>().toEqualTypeOf<Variant>();

        expect(packed).toBeInstanceOf(Variant);
        expect(unpacked[0]).toBe("state");
        expect(unpacked[1].count).toBeInstanceOf(Variant);
        expect(Object.values(unpacked[1]).map((value) => value.deepUnpack<"i">())).toEqual([42]);
        expect(unpacked[2]).toEqual(new Uint8Array([1, 2]));
        expect(unpacked[3]).toBe(9n);
    });

    it("types recursive values and retains unknown for variants returned by native APIs", () => {
        const packed = new Variant("a{iv}", { 1: new Variant("s", "value") });
        const boxed = packed.deepUnpack();
        const recursive = packed.recursiveUnpack();
        const native = Variant.parse(null, "@a{iv} {1: <'value'>}", null, null);
        const inferred = native.recursiveUnpack();
        const asserted = native.recursiveUnpack<"a{iv}">();

        expectTypeOf(boxed).toEqualTypeOf<Record<string, Variant>>();
        expectTypeOf(recursive).toEqualTypeOf<Record<string, unknown>>();
        expectTypeOf(recursive).toEqualTypeOf<RecursiveVariantValue<"a{iv}">>();
        expectTypeOf(inferred).toEqualTypeOf<unknown>();
        expectTypeOf(asserted).toEqualTypeOf<Record<string, unknown>>();

        expect(boxed[1]).toBeInstanceOf(Variant);
        expect(recursive).toEqual({ 1: "value" });
        expect(inferred).toEqual(recursive);
        expect(asserted).toEqual(recursive);
    });

    it("types shallow scalars, byte arrays, containers and maybes", () => {
        const scalar = new Variant("i", 42);
        const bytes = new Variant("ay", [1, 2]);
        const array = new Variant("as", ["value"]);
        const dictionary = new Variant("a{sv}", { value: scalar });
        const maybe = new Variant("ms", null);

        expectTypeOf(scalar.unpack()).toEqualTypeOf<number>();
        expectTypeOf(bytes.unpack()).toEqualTypeOf<Uint8Array>();
        expectTypeOf(array.unpack()).toEqualTypeOf<Variant[]>();
        expectTypeOf(dictionary.unpack()).toEqualTypeOf<Record<string, Variant>>();
        expectTypeOf(maybe.unpack()).toEqualTypeOf<Variant | null>();
        expectTypeOf(array.unpack()).toEqualTypeOf<ShallowVariantValue<"as">>();

        expect(scalar.unpack()).toBe(42);
        expect(bytes.unpack()).toEqual(new Uint8Array([1, 2]));
        expect(array.unpack()).toEqual([expect.any(Variant)]);
        expect(dictionary.unpack().value).toBeInstanceOf(Variant);
        expect(maybe.unpack()).toBeNull();
    });
});
