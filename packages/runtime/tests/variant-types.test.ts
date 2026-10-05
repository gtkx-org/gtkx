import {
    fromVariant,
    type FromVariantOptions,
    type RecursiveFromVariantOptions,
    type RecursiveVariantValue,
    toVariant,
    Variant,
    type VariantByteArray,
    type VariantInput,
    type VariantValue,
} from "@gtkx/gi/glib";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("generated variant helper types", () => {
    it("preserves the generated Variant class inside nested containers", () => {
        const input: VariantInput<"(sa{sv}aymx)"> = ["state", { count: toVariant("i", 42) }, [1, 2], 9n];
        const packed = toVariant("(sa{sv}aymx)", input);
        const unpacked = fromVariant("(sa{sv}aymx)", packed);

        expectTypeOf(packed).toEqualTypeOf<Variant>();
        expectTypeOf(unpacked).toEqualTypeOf<[string, Record<string, Variant>, Uint8Array, bigint | null]>();
        expectTypeOf(unpacked).toEqualTypeOf<VariantValue<"(sa{sv}aymx)">>();
        expectTypeOf<VariantByteArray>().toEqualTypeOf<Uint8Array>();
        expectTypeOf<Parameters<typeof toVariant<"ay">>[1]>().toEqualTypeOf<Uint8Array | number[]>();
        expectTypeOf<Parameters<typeof toVariant<"v">>[1]>().toEqualTypeOf<Variant>();
        expectTypeOf<Parameters<typeof toVariant<"i">>[1]>().toEqualTypeOf<number>();

        expect(packed).toBeInstanceOf(Variant);
        expect(unpacked[0]).toBe("state");
        expect(unpacked[1].count).toBeInstanceOf(Variant);
        expect(Object.values(unpacked[1]).map((value) => fromVariant("i", value))).toEqual([42]);
        expect(unpacked[2]).toEqual(new Uint8Array([1, 2]));
        expect(unpacked[3]).toBe(9n);
    });

    it("types recursive values and retains unknown for an inferred type string", () => {
        const packed = toVariant("a{iv}", new Map([[1, toVariant("s", "value")]]));
        const boxed = fromVariant("a{iv}", packed);
        const options: RecursiveFromVariantOptions = { recursive: true };
        const recursive = fromVariant("a{iv}", packed, options);
        const inferred = fromVariant(packed, options);
        const configurable: FromVariantOptions = options;
        const configured = fromVariant("a{iv}", packed, configurable);

        expectTypeOf(boxed).toEqualTypeOf<Map<number, Variant>>();
        expectTypeOf(recursive).toEqualTypeOf<Map<number, unknown>>();
        expectTypeOf(recursive).toEqualTypeOf<RecursiveVariantValue<"a{iv}">>();
        expectTypeOf(inferred).toEqualTypeOf<unknown>();
        expectTypeOf(configured).toEqualTypeOf<Map<number, Variant> | Map<number, unknown>>();

        expect(boxed.get(1)).toBeInstanceOf(Variant);
        expect(recursive).toEqual(new Map([[1, "value"]]));
        expect(inferred).toEqual(recursive);
        expect(configured).toEqual(recursive);
    });
});
