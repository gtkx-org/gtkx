import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cursorsDemo } from "../../../src/demos/gestures/cursors.js";
import { renderDemo } from "../../test-utils.js";

const rowFramesFor = async (name: string): Promise<Gtk.Frame[]> => {
    const label = (await screen.findByText(name)) as Gtk.Widget;
    let row: Gtk.Widget | null = label;
    while (row && !(row instanceof Gtk.ListBoxRow)) row = row.getParent();
    const frames: Gtk.Frame[] = [];
    const walk = (widget: Gtk.Widget | null): void => {
        if (!widget) return;
        if (widget instanceof Gtk.Frame) frames.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            walk(child);
            child = child.getNextSibling();
        }
    };
    walk(row);
    return frames;
};

describe("cursorsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(cursorsDemo.id).toBe("cursors");
        expect(cursorsDemo.title).toBe("Cursors");
        expect(cursorsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cursorsDemo.keywords)).toBe(true);
        expect(typeof cursorsDemo.sourceCode).toBe("string");
        expect(cursorsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cursorsDemo.component).toBeTypeOf("function");
        expect(cursorsDemo.defaultWidth).toBe(300);
        expect(cursorsDemo.defaultHeight).toBe(300);
    });
});

describe("cursorsDemo list structure", () => {
    it("wraps the cursor list in a scrolled window that never shows the horizontal scrollbar", async () => {
        await renderDemo(cursorsDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        const [hpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(sw.getPropagateNaturalHeight()).toBe(true);
    });

    it("groups the cursor rows into six non-selectable list boxes", async () => {
        await renderDemo(cursorsDemo);
        const listBoxes = await screen.findAllByRole(Gtk.AccessibleRole.LIST);
        expect(listBoxes).toHaveLength(6);
        for (const lb of listBoxes) {
            expect(lb).toBeInstanceOf(Gtk.ListBox);
            if (lb instanceof Gtk.ListBox) {
                expect(lb.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
            }
        }
    });

    it("renders 38 non-activatable list rows in total", async () => {
        await renderDemo(cursorsDemo);
        const rows = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        expect(rows).toHaveLength(38);
        for (const row of rows) {
            expect((row as Gtk.ListBoxRow).getActivatable()).toBe(false);
        }
    });
});

describe("cursorsDemo cursor assignments and tooltips", () => {
    it("attaches the four named/image/fallback cursor variants to a named row's frames", async () => {
        await renderDemo(cursorsDemo);
        const frames = await rowFramesFor("pointer");
        expect(frames).toHaveLength(4);

        const cursors = frames.map((f) => f.getCursor());
        for (const cursor of cursors) {
            expect(cursor).toBeInstanceOf(Gdk.Cursor);
        }

        // named cursor
        expect(cursors[0]?.getName()).toBe("pointer");
        expect(cursors[0]?.getFallback()).toBeNull();
        // image cursor (no name)
        expect(cursors[1]?.getName()).toBeNull();
        // named cursor with an image fallback
        expect(cursors[2]?.getName()).toBe("pointer");
        expect(cursors[2]?.getFallback()?.getName()).toBeNull();
        // image cursor falling back to the named cursor
        expect(cursors[3]?.getName()).toBeNull();
        expect(cursors[3]?.getFallback()?.getName()).toBe("pointer");

        expect(frames.map((f) => f.getTooltipText())).toEqual([
            'The "pointer" named cursor',
            "An image cursor",
            'The "pointer" named cursor falling back to an image cursor',
            'An image cursor falling back to the "pointer" cursor',
        ]);

        for (const frame of frames) {
            expect(frame.getCssClasses()).toContain("cursorbg");
            expect(frame.getSizeRequest()).toEqual([32, 32]);
        }
    });

    it("uses the gtk-logo special-case variants and tooltips with a default fallback", async () => {
        await renderDemo(cursorsDemo);
        const frames = await rowFramesFor("gtk-logo");
        expect(frames).toHaveLength(4);

        const cursors = frames.map((f) => f.getCursor());
        expect(cursors[0]?.getName()).toBe("gtk-logo");
        expect(cursors[1]?.getName()).toBeNull();
        // both trailing variants are image cursors falling back to the "default" cursor
        expect(cursors[2]?.getName()).toBeNull();
        expect(cursors[2]?.getFallback()?.getName()).toBe("default");
        expect(cursors[3]?.getName()).toBeNull();
        expect(cursors[3]?.getFallback()?.getName()).toBe("default");

        expect(frames.map((f) => f.getTooltipText())).toEqual([
            'The "gtk-logo" named cursor',
            "An image cursor for the GTK logo",
            'An image cursor falling back to the "default" cursor',
            'An image cursor falling back to the "default" cursor',
        ]);
    });
});

describe("cursorsDemo previews", () => {
    it("renders 38 preview images backed by a Gdk.Texture paintable", async () => {
        await renderDemo(cursorsDemo);
        const images = await screen.findAllByRole(Gtk.AccessibleRole.IMG);
        expect(images).toHaveLength(38);
        for (const preview of images) {
            expect((preview as Gtk.Image).getPaintable()).toBeInstanceOf(Gdk.Texture);
        }
    });
});

describe("cursorsDemo css registration", () => {
    it("adds exactly one cursors CssProvider at user priority for the default display", async () => {
        const addSpy = vi.spyOn(Gtk.StyleContext, "addProviderForDisplay");
        try {
            await renderDemo(cursorsDemo);
            const userPriorityCalls = addSpy.mock.calls.filter(
                ([, , priority]) => priority === Gtk.STYLE_PROVIDER_PRIORITY_USER,
            );
            expect(userPriorityCalls).toHaveLength(1);
            expect(userPriorityCalls[0]?.[1]).toBeInstanceOf(Gtk.CssProvider);
        } finally {
            addSpy.mockRestore();
        }
    });
});
