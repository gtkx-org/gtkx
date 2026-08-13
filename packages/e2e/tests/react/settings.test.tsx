import type { SettingsSchema, SettingValue } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { useSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import { expectSettingRoundTrip, resetSettingsKey } from "../helpers/settings.js";

type TestSchemaKeys = {
    enabled: "b";
    count: "i";
    label: "s";
    tags: "as";
    ratio: "d";
    "wrap-mode": "enum";
    theme: "s";
    retries: "u";
    "window-size": "(ii)";
    "big-signed": "x";
    "big-unsigned": "t";
};

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
const PROFILE_SCHEMA_ID = "com.gtkx.test.useSetting.profile";

const TYPED_SCHEMA: SettingsSchema<TestSchemaKeys> = {
    id: SCHEMA_ID,
    path: null,
    keys: {
        enabled: "b",
        count: "i",
        label: "s",
        tags: "as",
        ratio: "d",
        "wrap-mode": "enum",
        theme: "s",
        retries: "u",
        "window-size": "(ii)",
        "big-signed": "x",
        "big-unsigned": "t",
    },
};

const SCHEMA_ID2 = "com.gtkx.test.useSetting";

const SCHEMA: SettingsSchema<VariantSchemaKeys> = {
    id: SCHEMA_ID2,
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

const profileAt = (path: string): SettingsSchema<{ title: "s" }> => ({
    id: PROFILE_SCHEMA_ID,
    path,
    keys: { title: "s" },
});

const useMissingKey = () =>
    // @ts-expect-error "missing" is not a declared key of TYPED_SCHEMA
    useSetting(TYPED_SCHEMA, "missing");

const renderCountSetting = async () => {
    resetSettingsKey(SCHEMA_ID, "count");

    return renderHook(() => useSetting(TYPED_SCHEMA, "count"));
};

describe("useSetting (1)", () => {
    it("reads and writes boolean values", async () => {
        await expectSettingRoundTrip(TYPED_SCHEMA, "enabled", false, true);
    });

    it("reads and writes integer values", async () => {
        await expectSettingRoundTrip(TYPED_SCHEMA, "count", 0, 42);
    });

    it("reads and writes string values", async () => {
        await expectSettingRoundTrip(TYPED_SCHEMA, "label", "initial", "updated");
    });
});

describe("useSetting (2)", () => {
    it("reads and writes string array values", async () => {
        await expectSettingRoundTrip(TYPED_SCHEMA, "tags", [], ["alpha", "beta"]);
    });

    it("reads and writes double values", async () => {
        await expectSettingRoundTrip(TYPED_SCHEMA, "ratio", 1, 2.5);
    });

    it("reflects external GSettings changes via signal handler", async () => {
        const { result } = await renderCountSetting();
        const settings = Gio.Settings.new(SCHEMA_ID);
        await act(() => settings.setInt("count", 99));

        await waitFor(() => {
            expect(result.current[0]).toBe(99);
        });
    });
});

describe("useSetting (3)", () => {
    it("disconnects the signal handler on unmount", async () => {
        const { result, unmount } = await renderCountSetting();
        await unmount();
        const settings = Gio.Settings.new(SCHEMA_ID);
        await act(() => settings.setInt("count", 7));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current[0]).toBe(0);
    });
});

describe("useSetting (typed refs: scalars)", () => {
    it("reads and writes through a typed schema ref without a type argument", async () => {
        const { result } = await renderCountSetting();
        expectTypeOf(result.current[0]).toEqualTypeOf<number>();
        expectTypeOf(result.current[1]).toEqualTypeOf<(value: number) => void>();
        expect(result.current[0]).toBe(0);

        await act(() => {
            result.current[1](5);
        });

        await waitFor(() => {
            expect(result.current[0]).toBe(5);
        });
    });

    it("reads and writes uint keys", async () => {
        await expectSettingRoundTrip(TYPED_SCHEMA, "retries", 3, 9);
    });

    it("reads and writes int64 keys as bigints across the full range", async () => {
        expectTypeOf<SettingValue<TestSchemaKeys, "big-signed">>().toEqualTypeOf<bigint>();

        await expectSettingRoundTrip(
            TYPED_SCHEMA,
            "big-signed",
            -9_223_372_036_854_775_808n,
            9_223_372_036_854_775_807n,
        );
    });

    it("reads and writes uint64 keys as bigints across the full range", async () => {
        expectTypeOf<SettingValue<TestSchemaKeys, "big-unsigned">>().toEqualTypeOf<bigint>();
        await expectSettingRoundTrip(TYPED_SCHEMA, "big-unsigned", 18_446_744_073_709_551_615n, 7n);
    });
});

describe("useSetting (typed refs: enums and choices)", () => {
    it("reads and writes enum keys as their integer value", async () => {
        resetSettingsKey(SCHEMA_ID, "wrap-mode");
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "wrap-mode"));
        expectTypeOf(result.current[0]).toEqualTypeOf<number>();
        expect(result.current[0]).toBe(0);

        await act(() => {
            result.current[1](1);
        });

        await waitFor(() => {
            expect(result.current[0]).toBe(1);
        });
    });

    it("reads and writes string keys with choices", async () => {
        resetSettingsKey(SCHEMA_ID, "theme");
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "theme"));
        expectTypeOf(result.current[0]).toEqualTypeOf<string>();
        expect(result.current[0]).toBe("default");

        await act(() => {
            result.current[1]("dark");
        });

        await waitFor(() => {
            expect(result.current[0]).toBe("dark");
        });
    });
});

describe("useSetting (typed refs: tuples)", () => {
    it("reads and writes tuple keys as native arrays", async () => {
        resetSettingsKey(SCHEMA_ID, "window-size");
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "window-size"));
        expectTypeOf(result.current[0]).toEqualTypeOf<[number, number]>();
        expect(result.current[0]).toEqual([800, 600]);

        await act(() => {
            result.current[1]([1024, 768]);
        });

        await waitFor(() => {
            expect(result.current[0]).toEqual([1024, 768]);
        });
    });
});

describe("useSetting (typed refs: relocatable paths)", () => {
    it("keeps settings of the same relocatable schema isolated per path", async () => {
        const pathA = "/com/gtkx/test/useSetting/profiles/a/";
        const pathB = "/com/gtkx/test/useSetting/profiles/b/";

        const { result } = await renderHook(() => ({
            a: useSetting(profileAt(pathA), "title"),
            b: useSetting(profileAt(pathB), "title"),
        }));

        await act(() => {
            result.current.a[1]("alpha");
        });

        await waitFor(() => {
            expect(result.current.a[0]).toBe("alpha");
        });

        expect(result.current.b[0]).toBe("untitled");
    });
});

describe("useSetting (typed refs: unknown keys)", () => {
    it("rejects keys the schema does not declare at the type level", () => {
        expectTypeOf(useMissingKey).toBeFunction();
    });
});

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
        resetSettingsKey(SCHEMA_ID2, "extras");
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
        resetSettingsKey(SCHEMA_ID2, "opt-limit");
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
        resetSettingsKey(SCHEMA_ID2, "wrapped");
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
        resetSettingsKey(SCHEMA_ID2, "bus-path");
        resetSettingsKey(SCHEMA_ID2, "bus-signature");
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
            const schema: SettingsSchema = { id: SCHEMA_ID2, path: null, keys: { count: kind } };

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
