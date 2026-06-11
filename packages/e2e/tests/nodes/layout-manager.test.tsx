import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkBoxLayout, GtkFixedLayout, GtkGridChild, GtkGridLayout, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - LayoutManagerNode wiring", () => {
    it("attaches a GtkBoxLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkBoxLayout orientation={Gtk.Orientation.VERTICAL} spacing={12} />
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager();
        expect(layout).toBeInstanceOf(Gtk.BoxLayout);
        expect((layout as Gtk.BoxLayout).getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect((layout as Gtk.BoxLayout).getSpacing()).toBe(12);
    });

    it("attaches a GtkGridLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkGridLayout columnSpacing={6} rowSpacing={4} />
            </GtkBox>,
        );

        const layout = boxRef.current?.getLayoutManager();
        expect(layout).toBeInstanceOf(Gtk.GridLayout);
        expect((layout as Gtk.GridLayout).getColumnSpacing()).toBe(6);
        expect((layout as Gtk.GridLayout).getRowSpacing()).toBe(4);
    });

    it("attaches a GtkFixedLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkFixedLayout />
            </GtkBox>,
        );

        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.FixedLayout);
    });
});

describe("render - LayoutManagerNode lifecycle", () => {
    it("updates layout manager props through prop diff", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ spacing }: { spacing: number }) {
            return (
                <GtkBox ref={boxRef}>
                    <GtkBoxLayout spacing={spacing} />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App spacing={4} />);
        expect((boxRef.current?.getLayoutManager() as Gtk.BoxLayout).getSpacing()).toBe(4);

        await rerender(<App spacing={20} />);
        expect((boxRef.current?.getLayoutManager() as Gtk.BoxLayout).getSpacing()).toBe(20);
    });

    it("clears the layout manager slot when the marker is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return <GtkBox ref={boxRef}>{show && <GtkBoxLayout spacing={8} />}</GtkBox>;
        }

        const { rerender } = await render(<App show={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);

        await rerender(<App show={false} />);
        const remaining = boxRef.current?.getLayoutManager();
        expect(remaining instanceof Gtk.BoxLayout).toBe(false);
    });

    it("replaces an existing layout manager when a new one mounts", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ useGrid }: { useGrid: boolean }) {
            return <GtkBox ref={boxRef}>{useGrid ? <GtkGridLayout /> : <GtkBoxLayout spacing={4} />}</GtkBox>;
        }

        const { rerender } = await render(<App useGrid={false} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);

        await rerender(<App useGrid={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.GridLayout);
    });
});

describe("render - GtkGridChild against a generic widget with GridLayout", () => {
    it("positions widgets via the layout-child API", async () => {
        const boxRef = createRef<Gtk.Box>();
        const labelARef = createRef<Gtk.Label>();
        const labelBRef = createRef<Gtk.Label>();

        await render(
            <GtkBox ref={boxRef}>
                <GtkGridLayout />
                <GtkGridChild column={0} row={0}>
                    <GtkLabel ref={labelARef} label="A" />
                </GtkGridChild>
                <GtkGridChild column={1} row={1}>
                    <GtkLabel ref={labelBRef} label="B" />
                </GtkGridChild>
            </GtkBox>,
        );

        expect(labelARef.current).not.toBeNull();
        expect(labelBRef.current).not.toBeNull();

        const layout = boxRef.current?.getLayoutManager() as Gtk.GridLayout;
        const childA = layout.getLayoutChild(labelARef.current as Gtk.Label) as Gtk.GridLayoutChild;
        const childB = layout.getLayoutChild(labelBRef.current as Gtk.Label) as Gtk.GridLayoutChild;
        expect(childA.column).toBe(0);
        expect(childA.row).toBe(0);
        expect(childB.column).toBe(1);
        expect(childB.row).toBe(1);
    });
});
