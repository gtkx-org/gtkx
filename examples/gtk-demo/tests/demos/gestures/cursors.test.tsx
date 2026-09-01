import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cursorsDemo } from "../../../src/demos/gestures/cursors.js";
import { collectWidgets, renderDemo } from "../../test-utils.js";

const rowFramesFor = async (name: string): Promise<Gtk.Frame[]> => {
    const label = await screen.findByText(name);
    let row: Gtk.Widget | null = label;

    while (row && !(row instanceof Gtk.ListBoxRow)) {
        row = row.getParent();
    }

    return row ? collectWidgets(row, Gtk.Frame) : [];
};

describe("cursorsDemo list structure", () => {
    it("wraps the cursor list in a scrolled window that never shows the horizontal scrollbar", async () => {
        await renderDemo(cursorsDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const [hpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(sw).toHaveObjectProperty("propagateNaturalHeight", true);
    });

    it("groups the cursor rows into six non-selectable list boxes", async () => {
        await renderDemo(cursorsDemo);
        const listBoxes = await screen.findAllByRole(Gtk.AccessibleRole.LIST, { as: Gtk.ListBox });
        expect(listBoxes).toHaveLength(6);

        expect(listBoxes.map((listBox) => listBox.getSelectionMode())).toEqual(
            listBoxes.map(() => Gtk.SelectionMode.NONE),
        );
    });

    it("renders 38 non-activatable list rows in total", async () => {
        await renderDemo(cursorsDemo);
        const rows = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, { as: Gtk.ListBoxRow });
        expect(rows).toHaveLength(38);
        expect(rows.map((row) => row.getActivatable())).toEqual(rows.map(() => false));
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

        expect(cursors[0]?.getName()).toBe("pointer");
        expect(cursors[0]?.getFallback()).toBeNull();
        expect(cursors[1]?.getName()).toBeNull();
        expect(cursors[2]?.getName()).toBe("pointer");
        expect(cursors[2]?.getFallback()?.getName()).toBeNull();
        expect(cursors[3]?.getName()).toBeNull();
        expect(cursors[3]?.getFallback()?.getName()).toBe("pointer");

        expect(frames.map((f) => f.getTooltipText())).toEqual([
            'The "pointer" named cursor',
            "An image cursor",
            'The "pointer" named cursor falling back to an image cursor',
            'An image cursor falling back to the "pointer" cursor',
        ]);

        for (const frame of frames) {
            expect(frame).toHaveClass("cursorbg");
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
    it("loads the cursors stylesheet into one user-priority provider for the default display", async () => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addSpy = vi.spyOn(Gtk.StyleContext, "addProviderForDisplay");
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");

        try {
            await renderDemo(cursorsDemo);

            const userPriorityCalls = addSpy.mock.calls.filter(
                (call) => call[2] === Gtk.STYLE_PROVIDER_PRIORITY_USER,
            );

            expect(userPriorityCalls).toHaveLength(1);
            expect(userPriorityCalls[0]?.[0]).toBe(Gdk.DisplayManager.get().getDefaultDisplay());
            expect(loadSpy).toHaveBeenCalledTimes(1);
            expect(loadSpy.mock.instances[0]).toBe(userPriorityCalls[0]?.[1]);
        } finally {
            loadSpy.mockRestore();
            addSpy.mockRestore();
        }
    });
});
