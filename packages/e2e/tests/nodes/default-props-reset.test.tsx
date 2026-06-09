import type * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkLabel } from "@gtkx/react-gi/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("default-props reset on removal", () => {
    it("resets a boolean property to its GIR default when the prop is removed", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={ref} label="x" selectable={true} />);
        expect(ref.current?.selectable).toBe(true);

        await rerender(<GtkLabel ref={ref} label="x" />);
        expect(ref.current?.selectable).toBe(false);
    });

    it("resets an enum property to its GIR default", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={ref} label="x" ellipsize={Pango.EllipsizeMode.END} />);
        expect(ref.current?.ellipsize).toBe(Pango.EllipsizeMode.END);

        await rerender(<GtkLabel ref={ref} label="x" />);
        expect(ref.current?.ellipsize).toBe(Pango.EllipsizeMode.NONE);
    });

    it("resets a float property to its GIR default", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={ref} label="x" xalign={0.9} />);
        expect(ref.current?.xalign).toBeCloseTo(0.9);

        await rerender(<GtkLabel ref={ref} label="x" />);
        expect(ref.current?.xalign).toBeCloseTo(0.5);
    });

    it("resets a property with no typed C accessor through the static GValue path", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={ref} label="x" widthRequest={200} />);
        expect(ref.current?.widthRequest).toBe(200);

        await rerender(<GtkLabel ref={ref} label="x" />);
        expect(ref.current?.widthRequest).toBe(-1);
    });
});
