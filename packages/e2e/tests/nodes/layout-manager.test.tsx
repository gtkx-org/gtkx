import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkBoxLayout, GtkFixedLayout, GtkGridLayout } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

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
        expect((layout as Gtk.BoxLayout).getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect((layout as Gtk.BoxLayout).getSpacing()).toBe(12);
    });

    it("attaches a GtkGridLayout to the host widget", async () => {
        const boxRef = createRef<Gtk.Box>();

        await render(<GtkBox ref={boxRef} layoutManager={<GtkGridLayout columnSpacing={6} rowSpacing={4} />} />);

        const layout = boxRef.current?.getLayoutManager();
        expect(layout).toBeInstanceOf(Gtk.GridLayout);
        expect((layout as Gtk.GridLayout).getColumnSpacing()).toBe(6);
        expect((layout as Gtk.GridLayout).getRowSpacing()).toBe(4);
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

        function App({ spacing }: { spacing: number }) {
            return <GtkBox ref={boxRef} layoutManager={<GtkBoxLayout spacing={spacing} />} />;
        }

        const { rerender } = await render(<App spacing={4} />);
        expect((boxRef.current?.getLayoutManager() as Gtk.BoxLayout).getSpacing()).toBe(4);

        await rerender(<App spacing={20} />);
        expect((boxRef.current?.getLayoutManager() as Gtk.BoxLayout).getSpacing()).toBe(20);
    });

    it("clears the layout manager slot when the wrapper element is unmounted", async () => {
        const boxRef = createRef<Gtk.Box>();

        function App({ show }: { show: boolean }) {
            return <GtkBox ref={boxRef} layoutManager={show ? <GtkBoxLayout spacing={8} /> : null} />;
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
            return <GtkBox ref={boxRef} layoutManager={useGrid ? <GtkGridLayout /> : <GtkBoxLayout spacing={4} />} />;
        }

        const { rerender } = await render(<App useGrid={false} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.BoxLayout);

        await rerender(<App useGrid={true} />);
        expect(boxRef.current?.getLayoutManager()).toBeInstanceOf(Gtk.GridLayout);
    });
});
