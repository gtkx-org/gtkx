import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import { type SchemaRef, useSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { describe, expect, expectTypeOf, it } from "vitest";

const SCHEMA_ID = "com.gtkx.test.useSetting";
const PROFILE_SCHEMA_ID = "com.gtkx.test.useSetting.profile";

type TestSchemaKeys = {
    enabled: boolean;
    count: number;
    "wrap-mode": "none" | "word" | "char";
    theme: "default" | "light" | "dark";
    retries: number;
    "window-size": GLib.Variant;
};

const TYPED_SCHEMA: SchemaRef<TestSchemaKeys> = {
    id: SCHEMA_ID,
    path: null,
    keys: {
        enabled: "b",
        count: "i",
        "wrap-mode": "enum",
        theme: "s",
        retries: "u",
        "window-size": "(ii)",
    },
};

const profileAt = (path: string): SchemaRef<{ title: string }> => ({
    id: PROFILE_SCHEMA_ID,
    path,
    keys: { title: "s" },
});

const resetKey = (key: string, fallback: () => void): void => {
    const settings = Gio.Settings.new(SCHEMA_ID);
    if (settings.isWritable(key)) {
        settings.reset(key);
    } else {
        fallback();
    }
};

describe("useSetting (1)", () => {
    it("reads the initial boolean value from the schema default", async () => {
        resetKey("enabled", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "enabled", "boolean"));

        expect(result.current[0]).toBe(false);
    });

    it("writes a boolean value through the returned setter", async () => {
        resetKey("enabled", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "enabled", "boolean"));

        await act(() => result.current[1](true));

        await waitFor(() => {
            expect(result.current[0]).toBe(true);
        });
    });

    it("reads and writes integer values", async () => {
        resetKey("count", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "count", "int"));

        expect(result.current[0]).toBe(0);

        await act(() => result.current[1](42));

        await waitFor(() => {
            expect(result.current[0]).toBe(42);
        });
    });

    it("reads and writes string values", async () => {
        resetKey("label", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "label", "string"));

        expect(result.current[0]).toBe("initial");

        await act(() => result.current[1]("updated"));

        await waitFor(() => {
            expect(result.current[0]).toBe("updated");
        });
    });
});

describe("useSetting (2)", () => {
    it("reads and writes string array values", async () => {
        resetKey("tags", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "tags", "strv"));

        expect(result.current[0]).toEqual([]);

        await act(() => result.current[1](["alpha", "beta"]));

        await waitFor(() => {
            expect(result.current[0]).toEqual(["alpha", "beta"]);
        });
    });

    it("reads and writes double values", async () => {
        resetKey("ratio", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "ratio", "double"));

        expect(result.current[0]).toBeCloseTo(1.0);

        await act(() => result.current[1](2.5));

        await waitFor(() => {
            expect(result.current[0]).toBeCloseTo(2.5);
        });
    });

    it("reflects external GSettings changes via signal handler", async () => {
        resetKey("count", () => {});
        const { result } = await renderHook(() => useSetting(SCHEMA_ID, "count", "int"));

        const settings = Gio.Settings.new(SCHEMA_ID);
        await act(() => settings.setInt("count", 99));

        await waitFor(() => {
            expect(result.current[0]).toBe(99);
        });
    });
});

describe("useSetting (3)", () => {
    it("disconnects the signal handler on unmount", async () => {
        resetKey("count", () => {});
        const { result, unmount } = await renderHook(() => useSetting(SCHEMA_ID, "count", "int"));

        await unmount();

        const settings = Gio.Settings.new(SCHEMA_ID);
        await act(() => settings.setInt("count", 7));

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current[0]).toBe(0);
    });
});

describe("useSetting (typed refs: scalars)", () => {
    it("reads and writes through a typed schema ref without a type argument", async () => {
        resetKey("count", () => {});
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "count"));

        expectTypeOf(result.current[0]).toEqualTypeOf<number>();
        expectTypeOf(result.current[1]).toEqualTypeOf<(value: number) => void>();
        expect(result.current[0]).toBe(0);

        await act(() => result.current[1](5));

        await waitFor(() => {
            expect(result.current[0]).toBe(5);
        });
    });

    it("reads and writes uint keys", async () => {
        resetKey("retries", () => {});
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "retries"));

        expect(result.current[0]).toBe(3);

        await act(() => result.current[1](9));

        await waitFor(() => {
            expect(result.current[0]).toBe(9);
        });
    });
});

describe("useSetting (typed refs: enums and choices)", () => {
    it("narrows enum keys to a union of nicks and round-trips them as strings", async () => {
        resetKey("wrap-mode", () => {});
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "wrap-mode"));

        expectTypeOf(result.current[0]).toEqualTypeOf<"none" | "word" | "char">();
        expect(result.current[0]).toBe("none");

        await act(() => result.current[1]("word"));

        await waitFor(() => {
            expect(result.current[0]).toBe("word");
        });
    });

    it("narrows string keys with choices to a union of the choice values", async () => {
        resetKey("theme", () => {});
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "theme"));

        expectTypeOf(result.current[0]).toEqualTypeOf<"default" | "light" | "dark">();
        expect(result.current[0]).toBe("default");

        await act(() => result.current[1]("dark"));

        await waitFor(() => {
            expect(result.current[0]).toBe("dark");
        });
    });
});

describe("useSetting (typed refs: variants)", () => {
    it("falls back to GLib.Variant for keys without a native mapping", async () => {
        resetKey("window-size", () => {});
        const { result } = await renderHook(() => useSetting(TYPED_SCHEMA, "window-size"));

        expectTypeOf(result.current[0]).toEqualTypeOf<GLib.Variant>();
        expect(result.current[0]).toBeInstanceOf(GLib.Variant);
        expect(result.current[0].getChildValue(0).getInt32()).toBe(800);
        expect(result.current[0].getChildValue(1).getInt32()).toBe(600);

        const next = GLib.Variant.newTuple([GLib.Variant.newInt32(1024), GLib.Variant.newInt32(768)]);
        await act(() => result.current[1](next));

        await waitFor(() => {
            expect(result.current[0].getChildValue(0).getInt32()).toBe(1024);
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

        await act(() => result.current.a[1]("alpha"));

        await waitFor(() => {
            expect(result.current.a[0]).toBe("alpha");
        });
        expect(result.current.b[0]).toBe("untitled");
    });
});

describe("useSetting (typed refs: unknown keys)", () => {
    it("rejects keys the schema does not declare", async () => {
        const loose: SchemaRef = { id: SCHEMA_ID, path: null, keys: { enabled: "b" } };

        await expect(renderHook(() => useSetting(loose, "missing"))).rejects.toThrow(
            'Key "missing" is not declared by the GSettings schema "com.gtkx.test.useSetting"',
        );
    });
});
