import * as GLib from "@gtkx/gi/glib";
import type * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const captureCriticals = async (domain: string, run: () => Promise<void>): Promise<string[]> => {
    const messages: string[] = [];
    const handler = GLib.logSetHandler(domain, GLib.LogLevelFlags.LEVEL_CRITICAL, (_domain, _level, message) => {
        messages.push(message);
    });
    try {
        await run();
    } finally {
        GLib.logRemoveHandler(domain, handler);
    }
    return messages;
};

describe("default-props reset on removal", () => {
    it("resets a boolean property to its GIR default when the prop is removed", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(
            <GtkLabel ref={ref} selectable={true}>
                x
            </GtkLabel>,
        );
        expect(ref.current?.selectable).toBe(true);

        await rerender(<GtkLabel ref={ref}>x</GtkLabel>);
        expect(ref.current?.selectable).toBe(false);
    });

    it("resets an enum property to its GIR default", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(
            <GtkLabel ref={ref} ellipsize={Pango.EllipsizeMode.END}>
                x
            </GtkLabel>,
        );
        expect(ref.current?.ellipsize).toBe(Pango.EllipsizeMode.END);

        await rerender(<GtkLabel ref={ref}>x</GtkLabel>);
        expect(ref.current?.ellipsize).toBe(Pango.EllipsizeMode.NONE);
    });

    it("resets a float property to its GIR default", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(
            <GtkLabel ref={ref} xalign={0.9}>
                x
            </GtkLabel>,
        );
        expect(ref.current?.xalign).toBeCloseTo(0.9);

        await rerender(<GtkLabel ref={ref}>x</GtkLabel>);
        expect(ref.current?.xalign).toBeCloseTo(0.5);
    });

    it("leaves a property alone when its setter rejects the null default", async () => {
        const ref = createRef<Gtk.Button>();
        const { rerender } = await render(<GtkButton ref={ref} iconName="list-add-symbolic" />);
        expect(ref.current?.iconName).toBe("list-add-symbolic");

        const criticals = await captureCriticals("Gtk", async () => {
            await rerender(<GtkButton ref={ref} label="Cancel" />);
        });

        expect(criticals).toEqual([]);
        expect(ref.current?.label).toBe("Cancel");
        expect(ref.current?.iconName).toBeNull();
    });

    it("resets a property with no typed C accessor through the static GValue path", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(
            <GtkLabel ref={ref} widthRequest={200}>
                x
            </GtkLabel>,
        );
        expect(ref.current?.widthRequest).toBe(200);

        await rerender(<GtkLabel ref={ref}>x</GtkLabel>);
        expect(ref.current?.widthRequest).toBe(-1);
    });
});
