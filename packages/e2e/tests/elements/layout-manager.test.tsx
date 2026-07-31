import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkBoxLayout, GtkFixedLayout, GtkGridLayout } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type Ref } from "react";
import { describe, expect, it } from "vitest";

type BoxRef = { boxRef: Ref<Gtk.Box | null> };

const SpacedBox = ({ boxRef, spacing }: BoxRef & { spacing: number }) => (
    <GtkBox ref={boxRef} layoutManager={<GtkBoxLayout spacing={spacing} />} />
);

const OptionalLayoutBox = ({ boxRef, show }: BoxRef & { show: boolean }) => (
    <GtkBox ref={boxRef} layoutManager={show ? <GtkBoxLayout spacing={8} /> : null} />
);

const SwitchableLayoutBox = ({ boxRef, useGrid }: BoxRef & { useGrid: boolean }) => (
    <GtkBox ref={boxRef} layoutManager={useGrid ? <GtkGridLayout /> : <GtkBoxLayout spacing={4} />} />
);

describe("render - layoutManager prop wiring", () => {
    it("attaches a GtkBoxLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox
                ref={boxRef}
                layoutManager={<GtkBoxLayout orientation={Gtk.Orientation.VERTICAL} spacing={12} />}
            />,
        );

        const layout = boxRef.current?.getLayoutManager();
        expect(layout).toBeInstanceOf(Gtk.BoxLayout);
        expect(layout).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        expect(layout).toHaveObjectProperty("spacing", 12);
    });

    it("attaches a GtkGridLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GtkBox ref={boxRef} layoutManager={<GtkGridLayout columnSpacing={6} rowSpacing={4} />} />);
        const layout = boxRef.current?.getLayoutManager();
        expect(layout).toBeInstanceOf(Gtk.GridLayout);
        expect(layout).toHaveObjectProperty("columnSpacing", 6);
        expect(layout).toHaveObjectProperty("rowSpacing", 4);
    });

    it("attaches a GtkFixedLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GtkBox ref={boxRef} layoutManager={<GtkFixedLayout />} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.FixedLayout);
    });
});

describe("render - layoutManager prop lifecycle", () => {
    it("updates layout manager props through prop diff", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<SpacedBox boxRef={boxRef} spacing={4} />);
        const box = boxRef.current;

        if (box === null) {
            throw new Error("expected the box ref to be assigned");
        }

        expect(box.getLayoutManager()).toHaveObjectProperty("spacing", 4);
        await rerender(<SpacedBox boxRef={boxRef} spacing={20} />);
        expect(box.getLayoutManager()).toHaveObjectProperty("spacing", 20);
    });

    it("clears the layout manager slot when the wrapper element is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<OptionalLayoutBox boxRef={boxRef} show={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);
        await rerender(<OptionalLayoutBox boxRef={boxRef} show={false} />);
        const remaining = boxRef.current?.getLayoutManager();
        expect(remaining).not.toBeInstanceOf(Gtk.BoxLayout);
    });

    it("replaces an existing layout manager when a new one mounts", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<SwitchableLayoutBox boxRef={boxRef} useGrid={false} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);
        await rerender(<SwitchableLayoutBox boxRef={boxRef} useGrid={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.GridLayout);
    });
});
