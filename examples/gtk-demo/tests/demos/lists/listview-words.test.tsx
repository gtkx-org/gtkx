import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewWordsDemo } from "../../../src/demos/lists/listview-words.js";
import { fireEvent, renderDemo, screen } from "../../test-utils.js";

describe("listviewWordsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(listviewWordsDemo.id).toBe("listview-words");
        expect(listviewWordsDemo.title).toBe("Lists/Words");
        expect(listviewWordsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewWordsDemo.keywords)).toBe(true);
        expect(typeof listviewWordsDemo.sourceCode).toBe("string");
        expect(listviewWordsDemo.defaultWidth).toBe(400);
        expect(listviewWordsDemo.defaultHeight).toBe(600);
        expect(listviewWordsDemo.component).toBeTypeOf("function");
    });

    it("installs a header bar with an Open button", async () => {
        await renderDemo(listviewWordsDemo);
        const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
        expect(openButton.getUseUnderline()).toBe(true);
    });

    it("renders a GtkSearchEntry with the configured placeholder", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        expect(entry.getPlaceholderText()).toBe("Search words...");
    });

    it("renders a GtkListView with NONE selection", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        expect(lv.getModel()).toBeInstanceOf(Gtk.NoSelection);
    });

    it("populates the list view from the loaded word list", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        expect(lv.getModel()?.getNItems() ?? 0).toBeGreaterThan(0);
    });

    it("displays the line count in the header label", async () => {
        await renderDemo(listviewWordsDemo);
        await screen.findByText(/\blines$/);
    });

    it("updates the search entry text when text is typed", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        entry.setText("lorem");
        await fireEvent(entry, "search-changed");
        expect(entry.getText()).toBe("lorem");
    });
});
