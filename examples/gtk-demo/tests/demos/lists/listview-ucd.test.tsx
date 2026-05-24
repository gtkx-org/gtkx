import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it, vi } from "vitest";
import { listviewUcdDemo } from "../../../src/demos/lists/listview-ucd.js";
import { fireEvent, renderDemo, screen } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

describe("listviewUcdDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewUcdDemo.id).toBe("listview-ucd");
        expect(listviewUcdDemo.title).toBe("Lists/Characters");
        expect(listviewUcdDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewUcdDemo.keywords)).toBe(true);
        expect(typeof listviewUcdDemo.sourceCode).toBe("string");
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
    it("activating a row does not throw", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const model = cv.getModel();
        const nItems = model?.getNItems() ?? 0;
        expect(nItems).toBeGreaterThan(0);
        await fireEvent(cv, "activate", 0);
    });
});
