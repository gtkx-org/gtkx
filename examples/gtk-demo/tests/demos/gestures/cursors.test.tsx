import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cursorsDemo } from "../../../src/demos/gestures/cursors.js";
import { renderDemo } from "../../test-utils.js";

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
        const cursorListBoxes = listBoxes.filter((widget) => widget instanceof Gtk.ListBox);
        expect(cursorListBoxes).toHaveLength(6);
        for (const lb of cursorListBoxes) {
            expect(lb.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
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

describe("cursorsDemo previews", () => {
    it("labels rows with the cursor names including default, pointer, grab and gtk-logo", async () => {
        await renderDemo(cursorsDemo);
        expect(await screen.findByText("default")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("pointer")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("grab")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("gtk-logo")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("zoom-in")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("zoom-out")).toBeInstanceOf(Gtk.Widget);
    });
});
