import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listviewWordsDemo } from "../../../src/demos/lists/listview-words.js";
import { renderDemo } from "../../test-utils.js";

let tempDir: string;

beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "listview-words-"));
});

afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
});

describe("listviewWordsDemo metadata", () => {
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
});

describe("listviewWordsDemo layout", () => {
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
        const model = lv.getModel();
        expect(model).not.toBeNull();
        expect((model as Gtk.SelectionModel).getNItems()).toBeGreaterThan(0);
    });

    it("updates the host window title to reflect the line count", async () => {
        await renderDemo(listviewWordsDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        await waitFor(() => {
            expect(window.getTitle()).toMatch(/\d+ lines$/);
        });
    });
});

describe("listviewWordsDemo search interactions", () => {
    it("updates the search entry text when text is typed", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await userEvent.type(entry, "lorem");
        expect(entry.getText()).toBe("lorem");
    });

    it("filters the list view to a single matching word as the search entry text changes", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await userEvent.type(entry, "lorem");
        await waitFor(() => {
            const filteredCount = (lv.getModel() as Gtk.SelectionModel).getNItems();
            expect(filteredCount).toBe(1);
        });
    });

    it("filters the list view to zero matches when the search text matches nothing", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await userEvent.type(entry, "qqqzzz");
        await waitFor(() => {
            const filteredCount = (lv.getModel() as Gtk.SelectionModel).getNItems();
            expect(filteredCount).toBe(0);
        });
    });

    it("clears the search entry when cleared", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await userEvent.type(entry, "abc");
        await userEvent.clear(entry);
        expect(entry.getText()).toBe("");
    });

    it("restores the full word count when the search entry is cleared after filtering", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = (await screen.findByName("list-view")) as Gtk.ListView;
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        const initial = (lv.getModel() as Gtk.SelectionModel).getNItems();
        await userEvent.type(entry, "z");
        await waitFor(() => {
            const filteredCount = (lv.getModel() as Gtk.SelectionModel).getNItems();
            expect(filteredCount).toBeLessThanOrEqual(initial);
        });
        await userEvent.clear(entry);
        await waitFor(() => {
            const restored = (lv.getModel() as Gtk.SelectionModel).getNItems();
            expect(restored).toBe(initial);
        });
    });
});

describe("listviewWordsDemo Open button", () => {
    it("loads words from the selected file when the dialog returns a valid path", async () => {
        const wordsPath = join(tempDir, "words.txt");
        writeFileSync(wordsPath, ["alpha", "beta", "gamma", "delta"].join("\n"));
        const file = Gio.fileNewForPath(wordsPath);
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(file);
        try {
            await renderDemo(listviewWordsDemo);
            const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(dialogSpy).toHaveBeenCalled());
            const lv = (await screen.findByName("list-view")) as Gtk.ListView;
            await waitFor(() => {
                const count = (lv.getModel() as Gtk.SelectionModel).getNItems();
                expect(count).toBe(4);
            });
        } finally {
            dialogSpy.mockRestore();
        }
    });

    it("logs an error when the file dialog rejects", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockRejectedValue(new Error("user cancelled"));
        try {
            await renderDemo(listviewWordsDemo);
            const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(errorSpy).toHaveBeenCalledWith("user cancelled"));
        } finally {
            dialogSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    it("shows an alert dialog when the selected file cannot be read", async () => {
        const missingFile = Gio.fileNewForPath(join(tempDir, "does-not-exist.txt"));
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(missingFile);
        const alertShowSpy = vi.spyOn(Gtk.AlertDialog.prototype, "show").mockImplementation(() => {});
        const setMessageSpy = vi.spyOn(Gtk.AlertDialog.prototype, "setMessage");
        try {
            await renderDemo(listviewWordsDemo);
            const openButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Open" })) as Gtk.Button;
            await userEvent.click(openButton);
            await waitFor(() => expect(alertShowSpy).toHaveBeenCalled());
            expect(setMessageSpy).toHaveBeenCalledWith(expect.stringMatching(/Failure reading words/));
        } finally {
            dialogSpy.mockRestore();
            alertShowSpy.mockRestore();
            setMessageSpy.mockRestore();
        }
    });
});
