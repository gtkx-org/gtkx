import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkDragSource, GtkDropTarget, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { type ComponentProps, createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

type Icon = ComponentProps<typeof GtkDragSource>["icon"];
type Types = ComponentProps<typeof GtkDropTarget>["types"];

const Source = ({ icon, sourceRef }: { icon: Icon; sourceRef: RefObject<Gtk.DragSource | null> }) => (
    <GtkLabel controllers={<GtkDragSource ref={sourceRef} {...(icon === undefined ? {} : { icon })} />}>
        Drag source
    </GtkLabel>
);

const Target = ({ types, targetRef }: { types: Types; targetRef: RefObject<Gtk.DropTarget | null> }) => (
    <GtkLabel
        controllers={(
            <GtkDropTarget
                ref={targetRef}
                actions={Gdk.DragAction.COPY}
                {...(types === undefined ? {} : { types })}
            />
        )}
    >
        Drop target
    </GtkLabel>
);

const renderThenOmitIcon = async (): Promise<WeakRef<Gtk.WidgetPaintable>> => {
    const sourceRef = createRef<Gtk.DragSource>();
    const paintable = Gtk.WidgetPaintable.new(null);
    const released = new WeakRef(paintable);
    const { rerender } = await render(<Source icon={{ paintable }} sourceRef={sourceRef} />);
    await rerender(<Source icon={undefined} sourceRef={sourceRef} />);
    await rerender(<Source icon={undefined} sourceRef={sourceRef} />);

    return released;
};

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

    it("releases a configured icon when the prop is omitted", async () => {
        const released = await renderThenOmitIcon();
        await gcUntil(() => released.deref() === undefined);
        expect(released.deref()).toBeUndefined();
    });
});

describe("drop target types", () => {
    it("clears configured types when the prop is omitted", async () => {
        const targetRef = createRef<Gtk.DropTarget>();
        const { rerender } = await render(<Target types={[GObject.TYPE_STRING]} targetRef={targetRef} />);
        const target = targetRef.current;

        expect(target?.getGtypes()).toEqual([GObject.TYPE_STRING]);
        await rerender(<Target types={undefined} targetRef={targetRef} />);
        expect(targetRef.current).toBe(target);
        expect(target?.getGtypes()).toEqual([]);
    });
});
