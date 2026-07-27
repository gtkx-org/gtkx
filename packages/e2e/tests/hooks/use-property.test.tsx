import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { type RefProp, useProperty } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

function deref<T>(ref: { current: T | null }): T {
    const value = ref.current;

    if (value === null) {
        throw new Error("ref is null");
    }

    return value;
}

const renderMountedLabel = async (props: ComponentProps<typeof GtkLabel>): Promise<Gtk.Label> => {
    const ref = createRef<Gtk.Label>();
    await render(<GtkLabel ref={ref} {...props} />);

    return deref(ref);
};

describe("useProperty", () => {
    it("reads the initial property value", async () => {
        const label = await renderMountedLabel({ label: "Hello" });
        const { result } = await renderHook(() => useProperty(label, "label"));
        expect(result.current).toBe("Hello");
    });

    it("updates when the property changes externally", async () => {
        const label = await renderMountedLabel({ label: "Before" });
        const { result } = await renderHook(() => useProperty(label, "label"));
        expect(result.current).toBe("Before");

        await act(() => {
            label.setLabel("After");
        });

        await waitFor(() => {
            expect(result.current).toBe("After");
        });
    });

    it("reads boolean properties", async () => {
        const label = await renderMountedLabel({ visible: true, children: "Test" });
        const { result } = await renderHook(() => useProperty(label, "visible"));
        expect(result.current).toBe(true);
    });

    it("derives the notify detail from a multi-word property name", async () => {
        const label = await renderMountedLabel({ label: "Test" });
        const { result } = await renderHook(() => useProperty(label, "maxWidthChars"));
        expect(result.current).toBe(-1);

        await act(() => {
            label.setMaxWidthChars(12);
        });

        await waitFor(() => {
            expect(result.current).toBe(12);
        });
    });

    it("cleans up signal on unmount", async () => {
        const label = await renderMountedLabel({ label: "Test" });
        const { result, unmount } = await renderHook(() => useProperty(label, "label"));
        expect(result.current).toBe("Test");
        await unmount();

        await act(() => {
            label.setLabel("Changed");
        });

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

        await act(() => {
            label.setLabel("After");
        });

        await waitFor(() => {
            expect(result.current).toBe("After");
        });
    });

    it("follows a ref as it is populated and cleared", async () => {
        const label = new Gtk.Label({ label: "Hello" });
        const ref: { current: Gtk.Label | null } = { current: null };

        const { result, rerender } = await renderHook(
            ({ object }: { object: RefProp<Gtk.Label> }) => useProperty(object, "label"),
            { initialProps: { object: ref as RefProp<Gtk.Label> } },
        );

        expect(result.current).toBeUndefined();
        ref.current = label;
        await rerender({ object: ref });
        expect(result.current).toBe("Hello");
        ref.current = null;
        await rerender({ object: ref });
        expect(result.current).toBeUndefined();
    });

    it("re-reads and resubscribes when the object is replaced", async () => {
        const first = new Gtk.Label({ label: "First" });
        const second = new Gtk.Label({ label: "Second" });

        const { result, rerender } = await renderHook(
            ({ object }: { object: RefProp<Gtk.Label> }) => useProperty(object, "label"),
            { initialProps: { object: first as RefProp<Gtk.Label> } },
        );

        expect(result.current).toBe("First");
        await rerender({ object: second });
        expect(result.current).toBe("Second");

        await act(() => {
            first.setLabel("Stale");
        });

        expect(result.current).toBe("Second");
    });
});
