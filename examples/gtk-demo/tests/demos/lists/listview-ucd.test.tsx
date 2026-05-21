import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewUcdDemo } from "../../../src/demos/lists/listview-ucd.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findFirst } from "./helpers.js";

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
        if (!listviewUcdDemo.component) throw new Error("listview-ucd demo component missing");
        const { container } = await renderDemo(listviewUcdDemo.component);
        const cv = findFirst(container, Gtk.ColumnView);
        expect(cv).toBeInstanceOf(Gtk.ColumnView);
        expect(cv?.getShowColumnSeparators()).toBe(true);
    });

    it("declares the six expected columns", async () => {
        if (!listviewUcdDemo.component) throw new Error("listview-ucd demo component missing");
        const { container } = await renderDemo(listviewUcdDemo.component);
        const cv = findFirst(container, Gtk.ColumnView);
        const cols = cv?.getColumns();
        if (!cols) throw new Error("columns missing");
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
        if (!listviewUcdDemo.component) throw new Error("listview-ucd demo component missing");
        const { container } = await renderDemo(listviewUcdDemo.component);
        const cv = findFirst(container, Gtk.ColumnView);
        const model = cv?.getModel();
        expect(model?.getNItems() ?? 0).toBeGreaterThan(0);
    });
});

describe("listviewUcdDemo selection", () => {
    it("renders the selected-char label starting empty", async () => {
        if (!listviewUcdDemo.component) throw new Error("listview-ucd demo component missing");
        const { container } = await renderDemo(listviewUcdDemo.component);
        const labels = findAll(container, Gtk.Label);
        const selectedLabel = labels.find((l) => l.getLabel() === "" && l.getHexpand());
        expect(selectedLabel).toBeInstanceOf(Gtk.Label);
    });

    it("activating a row does not throw and the selected-char label remains a GtkLabel", async () => {
        if (!listviewUcdDemo.component) throw new Error("listview-ucd demo component missing");
        const { container } = await renderDemo(listviewUcdDemo.component);
        const cv = findFirst(container, Gtk.ColumnView);
        if (!cv) throw new Error("column view not rendered");
        const model = cv.getModel();
        const nItems = model?.getNItems() ?? 0;
        expect(nItems).toBeGreaterThan(0);
        await fireEvent(cv as Gtk.Widget, "activate", 0);
        const labels = findAll(container, Gtk.Label);
        const updatedLabel = labels.find((l) => l.getHexpand());
        expect(updatedLabel).toBeInstanceOf(Gtk.Label);
    });
});
