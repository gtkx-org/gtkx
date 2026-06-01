import * as Gio from "@gtkx/gi/gio";
import { useSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const SCHEMA_ID = "com.gtkx.test.useSetting";

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
