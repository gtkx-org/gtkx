import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cursorsDemo } from "../../../src/demos/gestures/cursors.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("cursorsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(cursorsDemo, { id: "cursors", title: "Cursors" });
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

    it("renders a non-selectable list box that contains a row for every cursor", async () => {
        const { container } = await renderDemo(cursorsDemo);
        const listBox = (await screen.findByName("cursor-list")) as Gtk.ListBox;
        expect(listBox.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
        const rows = findAllOfType(container, Gtk.ListBoxRow);
        expect(rows.length).toBe(36);
        for (const row of rows) {
            expect(row.getActivatable()).toBe(false);
        }
    });
});

describe("cursorsDemo previews", () => {
    it("labels every row with the cursor's name including default, pointer, grab and gtk-logo", async () => {
        const { container } = await renderDemo(cursorsDemo);
        const labels = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toEqual(
            expect.arrayContaining(["default", "pointer", "grab", "gtk-logo", "zoom-in", "zoom-out"]),
        );
    });

    it("attaches four GtkFrame previews per cursor row with tooltips describing each variant", async () => {
        const { container } = await renderDemo(cursorsDemo);
        const rows = findAllOfType(container, Gtk.ListBoxRow);
        const expectedVariants = ["named cursor", "image cursor"];
        for (const row of rows) {
            const frames = findAllOfType(row, Gtk.Frame);
            expect(frames).toHaveLength(4);
            const tooltips = frames.map((f) => f.getTooltipText() ?? "");
            const joined = tooltips.join(" | ");
            for (const variant of expectedVariants) expect(joined).toContain(variant);
            expect(joined).toContain("falling back");
        }
    });

    it("renders one cursor preview image per row alongside the cursor variants", async () => {
        const { container } = await renderDemo(cursorsDemo);
        const rows = findAllOfType(container, Gtk.ListBoxRow);
        for (const row of rows) {
            const image = findAllOfType(row, Gtk.Image);
            expect(image.length).toBeGreaterThanOrEqual(1);
        }
    });
});
