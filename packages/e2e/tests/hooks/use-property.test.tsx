import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkLabel, useProperty } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

function deref<T>(ref: { current: T | null }): T {
    const value = ref.current;
    if (value === null) throw new Error("ref is null");
    return value;
}

describe("useProperty", () => {
    it("reads the initial property value", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="Hello" />);
        const label = deref(ref);

        const { result } = await renderHook(() => useProperty(label, "label"));

        expect(result.current).toBe("Hello");
    });

    it("updates when the property changes externally", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="Before" />);
        const label = deref(ref);

        const { result } = await renderHook(() => useProperty(label, "label"));

        expect(result.current).toBe("Before");

        await act(() => label.setLabel("After"));

        await waitFor(() => {
            expect(result.current).toBe("After");
        });
    });

    it("reads boolean properties", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="Test" visible={true} />);
        const label = deref(ref);

        const { result } = await renderHook(() => useProperty(label, "visible"));

        expect(result.current).toBe(true);
    });

    it("cleans up signal on unmount", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} label="Test" />);
        const label = deref(ref);

        const { result, unmount } = await renderHook(() => useProperty(label, "label"));

        expect(result.current).toBe("Test");

        await unmount();

        await act(() => label.setLabel("Changed"));

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(result.current).toBe("Test");
    });
});
