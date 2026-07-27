import * as Gio from "@gtkx/gi/gio";
import { type SettingsSchema, type SettingValue, useSetting } from "@gtkx/react";
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
