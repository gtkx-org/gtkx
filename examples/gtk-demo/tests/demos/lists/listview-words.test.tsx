import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listviewWordsDemo } from "../../../src/demos/lists/listview-words.js";
import { findOpenButton, renderDemo } from "../../test-utils.js";

const tempDirRef = { path: "" };

async function renderDemoAndClickOpen() {
    await renderDemo(listviewWordsDemo);
    const openButton = await findOpenButton();
    await userEvent.click(openButton);
}

const findListView = async (): Promise<Gtk.ListView> => await screen.findByName("list-view", { as: Gtk.ListView });

const findSearchEntry = async (): Promise<Gtk.SearchEntry> =>
    await screen.findByName("search-entry", { as: Gtk.SearchEntry });

const wordsFile = (words: string[]): string => {
    const wordsPath = join(tempDirRef.path, "words.txt");
    writeFileSync(wordsPath, words.join("\n"));

    return wordsPath;
};

beforeEach(() => {
    tempDirRef.path = mkdtempSync(join(tmpdir(), "listview-words-"));
});

afterEach(() => {
    rmSync(tempDirRef.path, { recursive: true, force: true });
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
        const openButton = await findOpenButton();
        expect(openButton).toHaveObjectProperty("useUnderline", true);
    });

    it("renders a GtkSearchEntry with the configured placeholder", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = await screen.findByPlaceholderText("Search words...");
        expect(entry).toBeInstanceOf(Gtk.SearchEntry);
    });

    it("renders a GtkListView with NONE selection", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = await findListView();
        expect(lv.getModel()).toBeInstanceOf(Gtk.NoSelection);
    });

    it("populates the list view from the loaded word list", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = await findListView();
        expect((lv.getModel() as Gtk.SelectionModel).getNItems()).toBeGreaterThan(0);
    });

    it("updates the host window title to reflect the line count", async () => {
        await renderDemo(listviewWordsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: /^\d+ lines$/ });
        expect(window).toHaveAccessibleName(/^\d+ lines$/);
    });
});

describe("listviewWordsDemo search interactions", () => {
    it("updates the search entry text when text is typed", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = await findSearchEntry();
        await userEvent.type(entry, "lorem");
        expect(await screen.findByDisplayValue("lorem")).toBe(entry);
    });

    it("renders each loaded word as list-item content and filters it down to the match", async () => {
        const dialogSpy = vi
            .spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForPath(wordsFile(["alpha", "beta", "gamma", "delta"])));

        try {
            await renderDemoAndClickOpen();
            const lv = await findListView();

            await waitFor(() => {
                expect(lv.getModel()).toHaveObjectProperty("nItems", 4);
            });

            for (const word of ["alpha", "beta", "gamma", "delta"]) {
                await screen.findByText(word);
            }

            const entry = await findSearchEntry();
            await userEvent.type(entry, "gamma");

            await waitFor(() => {
                expect(lv.getModel()).toHaveObjectProperty("nItems", 1);
            });

            await screen.findByText("gamma");
            expect(screen.queryByText("alpha")).toBeNull();
        } finally {
            dialogSpy.mockRestore();
        }
    });
});

describe("listviewWordsDemo search filtering", () => {
    it("filters the list view to zero matches when the search text matches nothing", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = await findListView();
        const entry = await findSearchEntry();
        await userEvent.type(entry, "qqqzzz");

        await waitFor(() => {
            expect(lv.getModel()).toHaveObjectProperty("nItems", 0);
        });
    });

    it("clears the search entry when cleared", async () => {
        await renderDemo(listviewWordsDemo);
        const entry = await findSearchEntry();
        await userEvent.type(entry, "abc");
        await userEvent.clear(entry);
        expect(screen.queryByDisplayValue("abc")).toBeNull();
    });

    it("restores the full word count when the search entry is cleared after filtering", async () => {
        await renderDemo(listviewWordsDemo);
        const lv = await findListView();
        const entry = await findSearchEntry();
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
    it("loads words and re-titles the window to the new line count", async () => {
        const file = Gio.File.newForPath(wordsFile(["alpha", "beta", "gamma", "delta"]));
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(file);

        try {
            await renderDemoAndClickOpen();

            await waitFor(() => {
                expect(dialogSpy).toHaveBeenCalled();
            });

            const lv = await findListView();

            await waitFor(() => {
                expect(lv.getModel()).toHaveObjectProperty("nItems", 4);
            });

            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "4 lines" });
            const entry = await findSearchEntry();
            await userEvent.type(entry, "gamma");

            await waitFor(() => {
                expect(lv.getModel()).toHaveObjectProperty("nItems", 1);
            });

            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "1 lines" });
        } finally {
            dialogSpy.mockRestore();
        }
    });
});

describe("listviewWordsDemo Open button failures", () => {
    it("logs an error when the file dialog rejects", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation((): void => undefined);
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockRejectedValue(new Error("user cancelled"));

        try {
            await renderDemoAndClickOpen();

            await waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith("user cancelled");
            });
        } finally {
            dialogSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    it("shows an alert dialog when the selected file cannot be read", async () => {
        const missingFile = Gio.File.newForPath(join(tempDirRef.path, "does-not-exist.txt"));
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(missingFile);
        const alertShowSpy = vi.spyOn(Gtk.AlertDialog.prototype, "show").mockImplementation((): void => undefined);
        const setMessageSpy = vi.spyOn(Gtk.AlertDialog.prototype, "setMessage");

        try {
            await renderDemoAndClickOpen();

            await waitFor(() => {
                expect(alertShowSpy).toHaveBeenCalled();
            });

            expect(setMessageSpy).toHaveBeenCalledWith(expect.stringMatching(/Failure reading words/));
        } finally {
            dialogSpy.mockRestore();
            alertShowSpy.mockRestore();
            setMessageSpy.mockRestore();
        }
    });
});
