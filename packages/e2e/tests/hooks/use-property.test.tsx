import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { type GObjectTarget, useProperty } from "@gtkx/react";
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

describe("useProperty (targets)", () => {
    it("reads through a ref target and updates on change", async () => {
        const label = new Gtk.Label({ label: "Hello" });
        const ref: { current: Gtk.Label | null } = { current: label };

        const { result } = await renderHook(() => useProperty(ref, "label"));

        expect(result.current).toBe("Hello");

        await act(() => label.setLabel("After"));

        await waitFor(() => {
            expect(result.current).toBe("After");
        });
    });

    it("follows a ref target as it is populated and cleared", async () => {
        const label = new Gtk.Label({ label: "Hello" });
        const ref: { current: Gtk.Label | null } = { current: null };

        const { result, rerender } = await renderHook(
            ({ target }: { target: GObjectTarget<Gtk.Label> }) => useProperty(target, "label"),
            { initialProps: { target: ref as GObjectTarget<Gtk.Label> } },
        );

        expect(result.current).toBeUndefined();

        ref.current = label;
        await rerender({ target: ref });
        expect(result.current).toBe("Hello");

        ref.current = null;
        await rerender({ target: ref });
        expect(result.current).toBeUndefined();
    });

    it("re-reads and resubscribes when the target is replaced", async () => {
        const first = new Gtk.Label({ label: "First" });
        const second = new Gtk.Label({ label: "Second" });

        const { result, rerender } = await renderHook(
            ({ target }: { target: GObjectTarget<Gtk.Label> }) => useProperty(target, "label"),
            { initialProps: { target: first as GObjectTarget<Gtk.Label> } },
        );

        expect(result.current).toBe("First");

        await rerender({ target: second });
        expect(result.current).toBe("Second");

        await act(() => first.setLabel("Stale"));
        expect(result.current).toBe("Second");
    });
});
