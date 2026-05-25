import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewUcdDemo } from "../../../src/demos/lists/listview-ucd.js";
import { renderDemo } from "../../test-utils.js";

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
        expect(model).not.toBeNull();
        expect((model as Gtk.SelectionModel).getNItems()).toBeGreaterThan(0);
    });
});

describe("listviewUcdDemo selection", () => {
    it("updates the selected-character preview label when a row is activated", async () => {
        await renderDemo(listviewUcdDemo);
        const cv = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const preview = (await screen.findByName("selected-char")) as Gtk.Label;
        expect(preview.getLabel()).toBe("");
        await fireEvent(cv, "activate", 0);
        await waitFor(() => expect(preview.getLabel().length).toBeGreaterThan(0));
    });
});
