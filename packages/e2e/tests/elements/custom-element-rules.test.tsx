import type * as Gtk from "@gtkx/gi/gtk";
import { GtkAspectFrame, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

declare module "@gtkx/jsx/gtk" {
    /* eslint-disable @typescript-eslint/consistent-type-definitions -- declaration merging requires interfaces */
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }

    interface GtkFrameProps {
        labelSlot?: ReactNode;
    }
    /* eslint-enable @typescript-eslint/consistent-type-definitions */
}

describe("custom element rules from gtkx.config.ts", () => {
    it("applies a rule declared by the configured module", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<GtkLabel ref={labelRef} cursorName="pointer" />);
        expect(labelRef.current?.getCursor()).toHaveObjectProperty("name", "pointer");
    });

    it("consults the app config before a built-in slot behavior", async () => {
        const frameRef = createRef<Gtk.AspectFrame>();

        await render(
            <GtkAspectFrame ref={frameRef}>
                <GtkLabel>child</GtkLabel>
            </GtkAspectFrame>,
        );

        expect(frameRef.current).toHaveClass("app-claimed-children");
    });

    it("reapplies the rule when the prop changes", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={labelRef} cursorName="pointer" />);
        await rerender(<GtkLabel ref={labelRef} cursorName="text" />);
        expect(labelRef.current?.getCursor()).toHaveObjectProperty("name", "text");
    });

    it("places children through a declared container prop", async () => {
        const frameRef = createRef<Gtk.Frame>();
        await render(<GtkFrame ref={frameRef} labelSlot={<GtkLabel>Section</GtkLabel>} />);
        expect(await screen.findByText("Section")).toBeDefined();
        expect(frameRef.current?.getLabelWidget()).not.toBeNull();
    });

    it("clears a declared container prop when its child unmounts", async () => {
        const frameRef = createRef<Gtk.Frame>();

        const App = ({ hasLabel }: { hasLabel: boolean }) => (
            <GtkFrame ref={frameRef} labelSlot={hasLabel ? <GtkLabel>Section</GtkLabel> : null} />
        );

        const { rerender } = await render(<App hasLabel={true} />);
        expect(frameRef.current?.getLabelWidget()).not.toBeNull();
        await rerender(<App hasLabel={false} />);
        expect(frameRef.current?.getLabelWidget()).toBeNull();
    });
});
