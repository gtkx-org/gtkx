import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { expect, it } from "vitest";

it("updates native props on the same widget and restores omitted defaults", async () => {
    const ref = createRef<Gtk.Label>();
    const { rerender, unmount } = await render(
        <GtkLabel ref={ref} selectable ellipsize={Pango.EllipsizeMode.END} xalign={0.9} widthRequest={200}>
            Before
        </GtkLabel>,
    );
    const widget = ref.current;
    expect(widget).toHaveObjectProperty("selectable", true);
    expect(widget).toHaveObjectProperty("ellipsize", Pango.EllipsizeMode.END);
    expect(widget).toHaveObjectProperty("widthRequest", 200);
    await rerender(<GtkLabel ref={ref}>After</GtkLabel>);
    expect(ref.current).toBe(widget);
    expect(widget).toHaveTextContent("After");
    expect(widget).toHaveObjectProperty("selectable", false);
    expect(widget).toHaveObjectProperty("ellipsize", Pango.EllipsizeMode.NONE);
    expect(widget).toHaveObjectProperty("xalign", 0.5);
    expect(widget).toHaveObjectProperty("widthRequest", -1);
    await unmount();
    expect(ref.current).toBeNull();
});

it("replaces mutually exclusive properties and coerces native numeric ranges", async () => {
    const ref = createRef<Gtk.Button>();
    const { rerender } = await render(
        <GtkButton ref={ref} iconName="list-add-symbolic" opacity={1.5} marginTop={-4} />,
    );
    expect(ref.current).toHaveObjectProperty("iconName", "list-add-symbolic");
    expect(ref.current).toHaveObjectProperty("opacity", 1);
    expect(ref.current).toHaveObjectProperty("marginTop", 0);
    await rerender(<GtkButton ref={ref} label="Cancel" opacity={-0.5} marginTop={2.4} />);
    expect(ref.current).toHaveTextContent("Cancel");
    expect(ref.current).toHaveObjectProperty("iconName", null);
    expect(ref.current).toHaveObjectProperty("opacity", 0);
    expect(ref.current).toHaveObjectProperty("marginTop", 2);
});

it("requires a new key when a construct-only property changes", async () => {
    const ref = createRef<Gtk.Box>();
    const { rerender } = await render(<GtkBox ref={ref} cssName="initial-name" />);
    expect(ref.current).toHaveObjectProperty("cssName", "initial-name");
    await expect(rerender(<GtkBox ref={ref} cssName="changed-name" />)).rejects.toThrow();
});

it("remounts with new constructor values when its key changes", async () => {
    const ref = createRef<Gtk.Box>();
    const { rerender } = await render(<GtkBox key="first" ref={ref} cssName="initial-name" />);
    const first = ref.current;
    await rerender(<GtkBox key="second" ref={ref} cssName="changed-name" />);
    expect(ref.current).not.toBe(first);
    expect(ref.current).toHaveObjectProperty("cssName", "changed-name");
});
