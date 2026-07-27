import type * as Gtk from "@gtkx/gi/gtk";
import * as GLib from "@gtkx/gi/glib";
import * as Pango from "@gtkx/gi/pango";
import { GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { type ComponentProps, createRef } from "react";
import { describe, expect, it } from "vitest";

type LabelProps = ComponentProps<typeof GtkLabel>;

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

const readLabelPropAcrossReset = async <T,>(props: LabelProps, read: (label: Gtk.Label) => T): Promise<[T, T]> => {
    const ref = createRef<Gtk.Label>();

    const { rerender } = await render(
        <GtkLabel ref={ref} {...props}>
            x
        </GtkLabel>,
    );

    const mounted = ref.current;

    if (mounted === null) {
        throw new Error("expected the label to be mounted");
    }

    const before = read(mounted);
    await rerender(<GtkLabel ref={ref}>x</GtkLabel>);

    return [before, read(mounted)];
};

describe("default-props reset on removal", () => {
    it("resets a boolean property to its GIR default when the prop is removed", async () => {
        const [before, after] = await readLabelPropAcrossReset({ selectable: true }, (label) => label.selectable);
        expect(before).toBe(true);
        expect(after).toBe(false);
    });

    it("resets an enum property to its GIR default", async () => {
        const [before, after] = await readLabelPropAcrossReset(
            { ellipsize: Pango.EllipsizeMode.END },
            (label) => label.ellipsize,
        );

        expect(before).toBe(Pango.EllipsizeMode.END);
        expect(after).toBe(Pango.EllipsizeMode.NONE);
    });

    it("resets a float property to its GIR default", async () => {
        const [before, after] = await readLabelPropAcrossReset({ xalign: 0.9 }, (label) => label.xalign);
        expect(before).toBeCloseTo(0.9);
        expect(after).toBeCloseTo(0.5);
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
        const [before, after] = await readLabelPropAcrossReset({ widthRequest: 200 }, (label) => label.widthRequest);
        expect(before).toBe(200);
        expect(after).toBe(-1);
    });
});
