import type * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

declare module "@gtkx/jsx/gtk" {
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }
}

describe("custom element rules from gtkx.config.ts", () => {
    it("applies a rule declared by the configured module", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(<GtkLabel ref={labelRef} cursorName="pointer" />);

        expect(labelRef.current?.getCursor()?.getName()).toBe("pointer");
    });

    it("reapplies the rule when the prop changes", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={labelRef} cursorName="pointer" />);

        await rerender(<GtkLabel ref={labelRef} cursorName="text" />);

        expect(labelRef.current?.getCursor()?.getName()).toBe("text");
    });
});
