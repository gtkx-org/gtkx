import type * as Gtk from "@gtkx/gi/gtk";
import { GtkDragSource, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { type ComponentProps, createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

type Icon = ComponentProps<typeof GtkDragSource>["icon"];

const Source = ({ icon, sourceRef }: { icon: Icon; sourceRef: RefObject<Gtk.DragSource | null> }) => (
    <GtkLabel controllers={<GtkDragSource ref={sourceRef} icon={icon} />}>
        Drag source
    </GtkLabel>
);

describe("drag source icons", () => {
    it.each([
        { name: "omitted", icon: undefined },
        { name: "null", icon: null },
        { name: "configured", icon: { hotX: 4, hotY: 6 } },
    ])("renders a source with icon $name", async ({ icon }) => {
        const sourceRef = createRef<Gtk.DragSource>();
        await render(<Source icon={icon} sourceRef={sourceRef} />);

        expect(sourceRef.current?.getWidget()).toBe(screen.getByText("Drag source"));
    });

    it("keeps the source attached when its configured icon becomes null", async () => {
        const sourceRef = createRef<Gtk.DragSource>();
        const { rerender } = await render(<Source icon={{ hotX: 4, hotY: 6 }} sourceRef={sourceRef} />);
        const source = sourceRef.current;

        expect(source?.getWidget()).toBe(screen.getByText("Drag source"));
        await rerender(<Source icon={null} sourceRef={sourceRef} />);

        expect(sourceRef.current).toBe(source);
        expect(source?.getWidget()).toBe(screen.getByText("Drag source"));
    });
});
