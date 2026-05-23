import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cursorsDemo } from "../../../src/demos/gestures/cursors.js";
import { renderDemo, screen } from "../../test-utils.js";

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

    it("groups the cursor rows into six non-selectable list boxes summing to 38 rows", async () => {
        await renderDemo(cursorsDemo);
        const listBoxes = (await screen.findAllByRole(Gtk.AccessibleRole.LIST)) as Gtk.ListBox[];
        const cursorListBoxes = listBoxes.filter((lb) => lb instanceof Gtk.ListBox);
        expect(cursorListBoxes.length).toBe(6);
        let total = 0;
        for (const lb of cursorListBoxes) {
            expect(lb.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
            let row = lb.getFirstChild();
            while (row) {
                expect((row as Gtk.ListBoxRow).getActivatable()).toBe(false);
                total++;
                row = row.getNextSibling();
            }
        }
        expect(total).toBe(38);
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
