import * as GLib from "@gtkx/gi/glib";
import { type SettingsSchema, type SettingValue, useSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { expectSettingRoundTrip, resetSettingsKey } from "../helpers/settings.js";

type VariantSchemaKeys = {
    payload: "ay";
    metadata: "a{ss}";
    extras: "a{sv}";
    scores: "a{ix}";
    matrix: "aai";
    "opt-limit": "mi";
    wrapped: "v";
    "big-offsets": "ax";
    "small-signed": "n";
    "small-unsigned": "q";
    "one-byte": "y";
    "handle-slot": "h";
    "bus-path": "o";
    "bus-signature": "g";
    pair: "{ss}";
};

type Value<P extends keyof VariantSchemaKeys> = SettingValue<VariantSchemaKeys, P>;

const SCHEMA_ID = "com.gtkx.test.useSetting";

const SCHEMA: SettingsSchema<VariantSchemaKeys> = {
    id: SCHEMA_ID,
    path: null,
    keys: {
        payload: "ay",
        metadata: "a{ss}",
        extras: "a{sv}",
        scores: "a{ix}",
        matrix: "aai",
        "opt-limit": "mi",
        wrapped: "v",
        "big-offsets": "ax",
        "small-signed": "n",
        "small-unsigned": "q",
        "one-byte": "y",
        "handle-slot": "h",
        "bus-path": "o",
        "bus-signature": "g",
        pair: "{ss}",
    },
};

describe("useSetting (variant types: arrays)", () => {
    it("reads and writes byte arrays as number arrays", async () => {
        expectTypeOf<Value<"payload">>().toEqualTypeOf<number[]>();
        await expectSettingRoundTrip(SCHEMA, "payload", [1, 2], [3, 4, 5]);
    });

    it("reads and writes int64 arrays as bigint arrays", async () => {
        expectTypeOf<Value<"big-offsets">>().toEqualTypeOf<bigint[]>();
        await expectSettingRoundTrip(SCHEMA, "big-offsets", [1n, 2n], [9_007_199_254_740_993n, -3n]);
    });

    it("reads and writes nested arrays", async () => {
        expectTypeOf<Value<"matrix">>().toEqualTypeOf<number[][]>();
        await expectSettingRoundTrip(SCHEMA, "matrix", [[1], [2, 3]], [[9, 8], [7], []]);
    });
});

describe("useSetting (variant types: dictionaries)", () => {
    it("reads and writes string-keyed dictionaries as plain objects", async () => {
        expectTypeOf<Value<"metadata">>().toEqualTypeOf<Record<string, string>>();
        await expectSettingRoundTrip(SCHEMA, "metadata", { origin: "default" }, { origin: "user", locale: "en" });
    });

    it("reads and writes non-string-keyed dictionaries as maps", async () => {
        expectTypeOf<Value<"scores">>().toEqualTypeOf<Map<number, bigint>>();

        await expectSettingRoundTrip(
            SCHEMA,
            "scores",
            new Map(),
            new Map([
                [1, 10n],
                [2, 20n],
            ]),
        );
    });

    it("reads and writes variant-valued dictionaries", async () => {
        expectTypeOf<Value<"extras">>().toEqualTypeOf<Record<string, GLib.Variant>>();
        resetSettingsKey(SCHEMA_ID, "extras");
        const { result } = await renderHook(() => useSetting(SCHEMA, "extras"));
        expect(result.current[0]).toEqual({});

        await act(() => {
            result.current[1]({ name: GLib.Variant.newString("x"), size: GLib.Variant.newInt32(5) });
        });

        await waitFor(() => {
            expect(Object.keys(result.current[0]).toSorted((a, b) => a.localeCompare(b))).toEqual(["name", "size"]);
        });

        expect(result.current[0].name?.getString()[0]).toBe("x");
        expect(result.current[0].size?.getInt32()).toBe(5);
    });
});

describe("useSetting (variant types: maybe and variant)", () => {
    it("reads and writes maybe keys as nullable values", async () => {
        expectTypeOf<Value<"opt-limit">>().toEqualTypeOf<number | null>();
        resetSettingsKey(SCHEMA_ID, "opt-limit");
        const { result } = await renderHook(() => useSetting(SCHEMA, "opt-limit"));
        expect(result.current[0]).toBeNull();

        await act(() => {
            result.current[1](5);
        });

        await waitFor(() => {
            expect(result.current[0]).toBe(5);
        });

        await act(() => {
            result.current[1](null);
        });

        await waitFor(() => {
            expect(result.current[0]).toBeNull();
        });
    });

    it("reads and writes variant keys as GLib.Variant", async () => {
        expectTypeOf<Value<"wrapped">>().toEqualTypeOf<GLib.Variant>();
        resetSettingsKey(SCHEMA_ID, "wrapped");
        const { result } = await renderHook(() => useSetting(SCHEMA, "wrapped"));
        expect(result.current[0].getString()[0]).toBe("hello");

        await act(() => {
            result.current[1](GLib.Variant.newInt32(7));
        });

        await waitFor(() => {
            expect(result.current[0].getInt32()).toBe(7);
        });
    });
});

describe("useSetting (variant types: scalars)", () => {
    it("reads and writes int16 keys across the full range", async () => {
        expectTypeOf<Value<"small-signed">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(SCHEMA, "small-signed", -32_768, 32_767);
    });

    it("reads and writes uint16 keys across the full range", async () => {
        expectTypeOf<Value<"small-unsigned">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(SCHEMA, "small-unsigned", 65_535, 0);
    });

    it("reads and writes byte keys across the full range", async () => {
        expectTypeOf<Value<"one-byte">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(SCHEMA, "one-byte", 255, 0);
    });

    it("reads and writes handle keys as numbers", async () => {
        expectTypeOf<Value<"handle-slot">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(SCHEMA, "handle-slot", 0, 42);
    });

    it("reads and writes object path keys as strings", async () => {
        expectTypeOf<Value<"bus-path">>().toEqualTypeOf<string>();
        await expectSettingRoundTrip(SCHEMA, "bus-path", "/com/gtkx/test", "/com/gtkx/other");
    });

    it("reads and writes signature keys as strings", async () => {
        expectTypeOf<Value<"bus-signature">>().toEqualTypeOf<string>();
        await expectSettingRoundTrip(SCHEMA, "bus-signature", "a{sv}", "s");
    });
});

describe("useSetting (variant types: dict entries)", () => {
    it("reads and writes bare dict entry keys as pairs", async () => {
        expectTypeOf<Value<"pair">>().toEqualTypeOf<[string, string]>();
        await expectSettingRoundTrip(SCHEMA, "pair", ["k", "v"], ["a", "b"]);
    });

    it("computes pair and dict types for nested positions", () => {
        expectTypeOf<SettingValue<{ k: "({si}u)" }, "k">>().toEqualTypeOf<[[string, number], number]>();
        expectTypeOf<SettingValue<{ k: "a{bs}" }, "k">>().toEqualTypeOf<Map<boolean, string>>();
        expectTypeOf<SettingValue<{ k: "(ii" }, "k">>().toEqualTypeOf<unknown>();
    });
});

describe("useSetting (variant types: invalid input)", () => {
    it("rejects invalid object paths and signatures with a descriptive error", async () => {
        resetSettingsKey(SCHEMA_ID, "bus-path");
        resetSettingsKey(SCHEMA_ID, "bus-signature");
        const paths = await renderHook(() => useSetting(SCHEMA, "bus-path"));
        const signatures = await renderHook(() => useSetting(SCHEMA, "bus-signature"));

        expect(() => {
            paths.result.current[1]("not a path");
        }).toThrow('"not a path" is not a valid GVariant object path');

        expect(() => {
            signatures.result.current[1]("nope");
        }).toThrow('"nope" is not a valid GVariant type signature');
    });

    it("rejects schema kinds that are not valid GVariant type strings", async () => {
        for (const kind of ["zz", "ii", "(ii", "a{vs}"]) {
            const schema: SettingsSchema = { id: SCHEMA_ID, path: null, keys: { count: kind } };

            await expect(renderHook(() => useSetting(schema, "count"))).rejects.toThrow(
                `Invalid GVariant type string "${kind}"`,
            );
        }
    });

    it("rejects keys the schema object does not declare", async () => {
        const untyped: SettingsSchema = SCHEMA;

        await expect(renderHook(() => useSetting(untyped, "missing"))).rejects.toThrow(
            'Key "missing" is not defined in schema "com.gtkx.test.useSetting"',
        );
    });
});
