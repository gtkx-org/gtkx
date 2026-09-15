import type { SettingsSchema, SettingValue } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import { useSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { describe, expect, expectTypeOf, it } from "vitest";
import schema, {
    com_gtkx_test_useSetting_profile as profile,
} from "../fixtures/com.gtkx.test.useSetting.gschema.xml";
import { expectSettingRoundTrip, renderSetting, renderSettings, resetSettingsKey } from "../helpers/settings.js";

type TestSchemaKeys = typeof schema.keys;
type Value<P extends keyof TestSchemaKeys> = SettingValue<TestSchemaKeys, P, typeof schema.values>;

const SCHEMA_ID = schema.id;

const renderCountSetting = async () => {
    await resetSettingsKey(SCHEMA_ID, "count");

    return renderSetting(schema, "count");
};

describe("useSetting", () => {
    it("reads and writes boolean values", async () => {
        await expectSettingRoundTrip(schema, "enabled", false, true);
    });

    it("reads and writes integer values", async () => {
        await expectSettingRoundTrip(schema, "count", 0, 42);
    });

    it("reads and writes string values", async () => {
        await expectSettingRoundTrip(schema, "label", "initial", "updated");
    });

    it("reads and writes string array values", async () => {
        await expectSettingRoundTrip(schema, "tags", [], ["alpha", "beta"]);
    });

    it("reads and writes double values", async () => {
        await expectSettingRoundTrip(schema, "ratio", 1, 2.5);
    });

    it("reflects external GSettings changes via signal handler", async () => {
        const { result } = await renderCountSetting();
        const settings = await renderSettings(SCHEMA_ID);
        await act(() => settings.setInt("count", 99));

        await waitFor(() => {
            expect(result.current[0]).toBe(99);
        });
    });

    it("disconnects the signal handler on unmount", async () => {
        const settings = await renderSettings(SCHEMA_ID);
        settings.reset("count");
        const changedSignal = GObject.signalLookup("changed", Gio.Settings);
        const countDetail = GLib.quarkFromString("count");
        expect(GObject.signalHasHandlerPending(settings, changedSignal, countDetail, true)).toBe(false);

        const { result, unmount } = await renderHook(() => useSetting(settings, schema, "count"));
        expect(result.current[0]).toBe(0);
        expect(GObject.signalHasHandlerPending(settings, changedSignal, countDetail, true)).toBe(true);
        await unmount();
        expect(GObject.signalHasHandlerPending(settings, changedSignal, countDetail, true)).toBe(false);

        await act(() => settings.setInt("count", 7));
        expect(settings.getInt("count")).toBe(7);
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
        await expectSettingRoundTrip(schema, "retries", 3, 9);
    });

    it("reads and writes int64 keys as bigints across the full range", async () => {
        expectTypeOf<SettingValue<TestSchemaKeys, "big-signed">>().toEqualTypeOf<bigint>();

        await expectSettingRoundTrip(
            schema,
            "big-signed",
            -9_223_372_036_854_775_808n,
            9_223_372_036_854_775_807n,
        );
    });

    it("reads and writes uint64 keys as bigints across the full range", async () => {
        expectTypeOf<SettingValue<TestSchemaKeys, "big-unsigned">>().toEqualTypeOf<bigint>();
        await expectSettingRoundTrip(schema, "big-unsigned", 18_446_744_073_709_551_615n, 7n);
    });
});

describe("useSetting (typed refs: enums and choices)", () => {
    it("reads and writes enum keys as their integer value", async () => {
        await resetSettingsKey(SCHEMA_ID, "wrap-mode");
        const { result } = await renderSetting(schema, "wrap-mode");
        expectTypeOf(result.current[0]).toEqualTypeOf<0 | 7 | 42>();
        expect(result.current[0]).toBe(schema.values["wrap-mode"].none);

        await act(() => {
            result.current[1](schema.values["wrap-mode"].word);
        });

        await waitFor(() => {
            expect(result.current[0]).toBe(7);
        });
        const external = await renderSettings(SCHEMA_ID);
        await act(() => external.setEnum("wrap-mode", schema.values["wrap-mode"].char));
        await waitFor(() => {
            expect(result.current[0]).toBe(42);
        });
    });

    it("reads and writes string keys with choices", async () => {
        await resetSettingsKey(SCHEMA_ID, "theme");
        const { result } = await renderSetting(schema, "theme");
        expectTypeOf(result.current[0]).toEqualTypeOf<"default" | "light" | "dark">();
        expect(result.current[0]).toBe("default");

        await act(() => {
            result.current[1]("dark");
        });

        await waitFor(() => {
            expect(result.current[0]).toBe("dark");
        });
    });
});

describe("useSetting (generated schema constraints)", () => {
    it("preserves choice arrays and nullable elements", async () => {
        await resetSettingsKey(SCHEMA_ID, "nested-theme");
        const { result } = await renderSetting(schema, "nested-theme");
        expectTypeOf(result.current[0]).toEqualTypeOf<("light" | "dark" | null)[][]>();
        expect(result.current[0]).toEqual([[null, "light"]]);
        await act(() => {
            result.current[1]([["dark", null], []]);
        });
        await waitFor(() => {
            expect(result.current[0]).toEqual([["dark", null], []]);
        });
    });

    it("reads and writes flag combinations using generated values", async () => {
        await resetSettingsKey(SCHEMA_ID, "features");
        const { result } = await renderSetting(schema, "features");
        expectTypeOf(result.current[0]).toEqualTypeOf<number>();
        expect(result.current[0]).toBe(0);
        await act(() => {
            result.current[1](schema.values.features.first | schema.values.features.second);
        });
        await waitFor(() => {
            expect(result.current[0]).toBe(9);
        });
        await act(() => {
            result.current[1](0);
        });
        await waitFor(() => {
            expect(result.current[0]).toBe(0);
        });
    });
});

describe("useSetting (typed refs: tuples)", () => {
    it("reads and writes tuple keys as native arrays", async () => {
        await resetSettingsKey(SCHEMA_ID, "window-size");
        const { result } = await renderSetting(schema, "window-size");
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

        const first = await renderSettings(profile.id, pathA);
        const second = await renderSettings(profile.id, pathB);
        const { result } = await renderHook(() => ({
            a: useSetting(first, profile.at(pathA), "title"),
            b: useSetting(second, profile.at(pathB), "title"),
        }));

        await act(() => {
            result.current.a[1]("alpha");
        });

        await waitFor(() => {
            expect(result.current.a[0]).toBe("alpha");
        });

        expect(result.current.b[0]).toBe("untitled");
    });

    it("follows a replacement settings instance and disconnects the previous one", async () => {
        const firstPath = "/com/gtkx/test/useSetting/replacement/first/";
        const secondPath = "/com/gtkx/test/useSetting/replacement/second/";
        const first = await renderSettings(profile.id, firstPath);
        const second = await renderSettings(profile.id, secondPath);
        first.setString("title", "first");
        second.setString("title", "second");
        const changedSignal = GObject.signalLookup("changed", Gio.Settings);
        const titleDetail = GLib.quarkFromString("title");
        expect(GObject.signalHasHandlerPending(first, changedSignal, titleDetail, true)).toBe(false);
        expect(GObject.signalHasHandlerPending(second, changedSignal, titleDetail, true)).toBe(false);
        const { result, rerender, unmount } = await renderHook(
            ({ settings, schema }: { settings: Gio.Settings; schema: SettingsSchema<{ title: "s" }> }) =>
                useSetting(settings, schema, "title"),
            { initialProps: { settings: first, schema: profile.at(firstPath) } },
        );
        expect(result.current[0]).toBe("first");
        expect(GObject.signalHasHandlerPending(first, changedSignal, titleDetail, true)).toBe(true);
        expect(GObject.signalHasHandlerPending(second, changedSignal, titleDetail, true)).toBe(false);
        await rerender({ settings: second, schema: profile.at(secondPath) });

        expect(result.current[0]).toBe("second");
        expect(GObject.signalHasHandlerPending(first, changedSignal, titleDetail, true)).toBe(false);
        expect(GObject.signalHasHandlerPending(second, changedSignal, titleDetail, true)).toBe(true);
        await act(() => {
            first.setString("title", "old target");
        });
        expect(result.current[0]).toBe("second");
        await act(() => {
            result.current[1]("updated");
        });
        expect(second.getString("title")).toBe("updated");
        expect(first.getString("title")).toBe("old target");
        await unmount();
        expect(GObject.signalHasHandlerPending(second, changedSignal, titleDetail, true)).toBe(false);
    });
});

describe("useSetting (variant types: arrays)", () => {
    it("reads and writes byte arrays as Uint8Array", async () => {
        expectTypeOf<Value<"payload">>().toEqualTypeOf<Uint8Array>();
        await expectSettingRoundTrip(schema, "payload", new Uint8Array([1, 2]), new Uint8Array([3, 4, 5]));
    });

    it("reads and writes int64 arrays as bigint arrays", async () => {
        expectTypeOf<Value<"big-offsets">>().toEqualTypeOf<bigint[]>();
        await expectSettingRoundTrip(schema, "big-offsets", [1n, 2n], [9_007_199_254_740_993n, -3n]);
    });

    it("reads and writes nested arrays", async () => {
        expectTypeOf<Value<"matrix">>().toEqualTypeOf<number[][]>();
        await expectSettingRoundTrip(schema, "matrix", [[1], [2, 3]], [[9, 8], [7], []]);
    });
});

describe("useSetting (variant types: dictionaries)", () => {
    it("reads and writes string-keyed dictionaries as plain objects", async () => {
        expectTypeOf<Value<"metadata">>().toEqualTypeOf<Record<string, string>>();
        await expectSettingRoundTrip(schema, "metadata", { origin: "default" }, { origin: "user", locale: "en" });
    });

    it("reads and writes non-string-keyed dictionaries as maps", async () => {
        expectTypeOf<Value<"scores">>().toEqualTypeOf<Map<number, bigint>>();

        await expectSettingRoundTrip(
            schema,
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
        await resetSettingsKey(SCHEMA_ID, "extras");
        const { result } = await renderSetting(schema, "extras");
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
        await resetSettingsKey(SCHEMA_ID, "opt-limit");
        const { result } = await renderSetting(schema, "opt-limit");
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
        await resetSettingsKey(SCHEMA_ID, "wrapped");
        const { result } = await renderSetting(schema, "wrapped");
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
        await expectSettingRoundTrip(schema, "small-signed", -32_768, 32_767);
    });

    it("reads and writes uint16 keys across the full range", async () => {
        expectTypeOf<Value<"small-unsigned">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(schema, "small-unsigned", 65_535, 0);
    });

    it("reads and writes byte keys across the full range", async () => {
        expectTypeOf<Value<"one-byte">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(schema, "one-byte", 255, 0);
    });

    it("reads and writes handle keys as numbers", async () => {
        expectTypeOf<Value<"handle-slot">>().toEqualTypeOf<number>();
        await expectSettingRoundTrip(schema, "handle-slot", 0, 42);
    });

    it("reads and writes object path keys as strings", async () => {
        expectTypeOf<Value<"bus-path">>().toEqualTypeOf<string>();
        await expectSettingRoundTrip(schema, "bus-path", "/com/gtkx/test", "/com/gtkx/other");
    });

    it("reads and writes signature keys as strings", async () => {
        expectTypeOf<Value<"bus-signature">>().toEqualTypeOf<string>();
        await expectSettingRoundTrip(schema, "bus-signature", "a{sv}", "s");
    });
});

describe("useSetting (variant types: dict entries)", () => {
    it("reads and writes bare dict entry keys as pairs", async () => {
        expectTypeOf<Value<"pair">>().toEqualTypeOf<[string, string]>();
        await expectSettingRoundTrip(schema, "pair", ["k", "v"], ["a", "b"]);
    });

    it("computes pair and dict types for nested positions", () => {
        expectTypeOf<SettingValue<{ k: "({si}u)" }, "k">>().toEqualTypeOf<[[string, number], number]>();
        expectTypeOf<SettingValue<{ k: "a{bs}" }, "k">>().toEqualTypeOf<Map<boolean, string>>();
        expectTypeOf<SettingValue<{ k: "(ii" }, "k">>().toEqualTypeOf<unknown>();
    });
});

describe("useSetting (variant types: invalid input)", () => {
    it("rejects invalid object paths and signatures with a descriptive error", async () => {
        await resetSettingsKey(SCHEMA_ID, "bus-path");
        await resetSettingsKey(SCHEMA_ID, "bus-signature");
        const paths = await renderSetting(schema, "bus-path");
        const signatures = await renderSetting(schema, "bus-signature");

        expect(() => {
            paths.result.current[1]("not a path");
        }).toThrow();

        expect(() => {
            signatures.result.current[1]("nope");
        }).toThrow();
    });

    it("rejects schema kinds that are not valid GVariant type strings", async () => {
        for (const kind of ["zz", "ii", "(ii", "a{vs}"]) {
            const schema: SettingsSchema = { id: SCHEMA_ID, path: null, keys: { count: kind } };

            await expect(renderSetting(schema, "count")).rejects.toThrow();
        }
    });

    it("rejects keys the schema object does not declare", async () => {
        const untyped: SettingsSchema = schema;

        await expect(renderSetting(untyped, "missing")).rejects.toThrow();
    });
});
