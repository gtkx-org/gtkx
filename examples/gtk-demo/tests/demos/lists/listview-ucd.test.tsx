import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewUcdDemo } from "../../../src/demos/lists/listview-ucd.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("listviewUcdDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewUcdDemo, { id: "listview-ucd", title: "Lists/Characters" });
        expect(typeof listviewUcdDemo.sourceCode).toBe("string");
        expect(listviewUcdDemo.keywords).toContain("listview");
        expect(listviewUcdDemo.keywords).toContain("unicode");
        expect(listviewUcdDemo.defaultWidth).toBe(800);
        expect(listviewUcdDemo.defaultHeight).toBe(400);
        expect(listviewUcdDemo.component).toBeTypeOf("function");
    });
});

describe("listviewUcdDemo column view", () => {
    it("renders a GtkColumnView wrapped in a scrolled window", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        expect(cv).toBeInstanceOf(Gtk.ColumnView);
        expect(cv.getShowColumnSeparators()).toBe(true);
    });

    it("declares the six expected columns", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const cols = cv.getColumns();
        const titles: string[] = [];
        for (let i = 0; i < cols.getNItems(); i++) {
            const c = cols.getItem(i);
            if (c instanceof Gtk.ColumnViewColumn) {
                const t = c.getTitle();
                if (t) titles.push(t);
            }
        }
        expect(titles).toEqual(["Codepoint", "Char", "Name", "Type", "Break Type", "Combining Class"]);
    });

    it("populates the column view with the parsed unicode data", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const model = cv.getModel();
        expect(model?.getNItems() ?? 0).toBeGreaterThan(0);
    });
});

describe("listviewUcdDemo selection", () => {
    it("renders the selected-char label starting empty", async () => {
        const { container } = await renderDemo(listviewUcdDemo);
        const labels = findAllOfType(container, Gtk.Label);
        const selectedLabel = labels.find((l) => l.getLabel() === "" && l.getHexpand());
        expect(selectedLabel).toBeInstanceOf(Gtk.Label);
    });

    it("activating a row does not throw and the selected-char label remains a GtkLabel", async () => {
        const { container } = await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const model = cv.getModel();
        const nItems = model?.getNItems() ?? 0;
        expect(nItems).toBeGreaterThan(0);
        await fireEvent(cv, "activate", 0);
        const labels = findAllOfType(container, Gtk.Label);
        const updatedLabel = labels.find((l) => l.getHexpand());
        expect(updatedLabel).toBeInstanceOf(Gtk.Label);
    });
});
