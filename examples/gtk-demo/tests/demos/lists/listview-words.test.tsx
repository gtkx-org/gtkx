import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewWordsDemo } from "../../../src/demos/lists/listview-words.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findApplicationWindow, findFirst } from "./helpers.js";

describe("listviewWordsDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewWordsDemo, { id: "listview-words", title: "Lists/Words" });
        expect(typeof listviewWordsDemo.sourceCode).toBe("string");
        expect(listviewWordsDemo.keywords).toContain("listview");
        expect(listviewWordsDemo.keywords).toContain("words");
        expect(listviewWordsDemo.defaultWidth).toBe(400);
        expect(listviewWordsDemo.defaultHeight).toBe(600);
        expect(listviewWordsDemo.component).toBeTypeOf("function");
    });

    it("installs a header bar with an Open button", async () => {
        const { container } = await renderDemo(listviewWordsDemo);
        const window = findApplicationWindow(container);
        expect(window?.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
        const openButton = findAll(window as Gtk.Widget, Gtk.Button).find((b) => b.getLabel() === "_Open");
        expect(openButton).toBeInstanceOf(Gtk.Button);
        expect(openButton?.getUseUnderline()).toBe(true);
    });

    it("renders a GtkSearchEntry with the configured placeholder", async () => {
        const { container } = await renderDemo(listviewWordsDemo);
        const entry = findFirst(container, Gtk.SearchEntry);
        expect(entry).toBeInstanceOf(Gtk.SearchEntry);
        expect(entry?.getPlaceholderText()).toBe("Search words...");
    });

    it("renders a GtkListView with NONE selection", async () => {
        const { container } = await renderDemo(listviewWordsDemo);
        const lv = findFirst(container, Gtk.ListView);
        expect(lv).toBeInstanceOf(Gtk.ListView);
        expect(lv?.getModel()).toBeInstanceOf(Gtk.NoSelection);
    });

    it("populates the list view from the loaded word list", async () => {
        const { container } = await renderDemo(listviewWordsDemo);
        const lv = findFirst(container, Gtk.ListView);
        expect(lv?.getModel()?.getNItems() ?? 0).toBeGreaterThan(0);
    });

    it("displays the line count in the header label", async () => {
        const { container } = await renderDemo(listviewWordsDemo);
        const window = findApplicationWindow(container);
        const labels = findAll(window as Gtk.Widget, Gtk.Label);
        const titleLabel = labels.find((l) => /\bline(s)?$/.test(l.getLabel()));
        expect(titleLabel).toBeInstanceOf(Gtk.Label);
    });

    it("updates the search entry text when text is typed", async () => {
        const { container } = await renderDemo(listviewWordsDemo);
        const entry = findFirst(container, Gtk.SearchEntry);
        if (!entry) throw new Error("search entry not found");
        entry.setText("lorem");
        await fireEvent(entry as Gtk.Widget, "search-changed");
        expect(findFirst(container, Gtk.SearchEntry)?.getText()).toBe("lorem");
    });
});
