import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listviewWordsDemo } from "../../../src/demos/lists/listview-words.js";
import wordsResourcePath from "../../fixtures/words.data?resource";
import { findButton, makeDialogDismissedError, renderDemo } from "../../test-utils.js";

const tempDirRef = { path: "" };

async function renderWords(isReactStrictMode = false) {
    await renderDemo(listviewWordsDemo, { isReactStrictMode });
    const openButton = await findButton("Open");
    await waitFor(() => {
        expect(openButton).toBeEnabled();
    });
}

async function renderDemoAndClickOpen() {
    await renderWords();
    const openButton = await findButton("Open");
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

describe("listviewWordsDemo layout", () => {
    it("installs a header bar with an Open button", async () => {
        await renderWords();
        const openButton = await findButton("Open");
        expect(openButton).toHaveObjectProperty("useUnderline", true);
    });

    it("renders a GtkSearchEntry with the configured placeholder", async () => {
        await renderWords();
        expect(await screen.findByPlaceholderText("Search words…")).toBe(await findSearchEntry());
    });

    it("keeps its selection empty when a visible word is clicked", async () => {
        await renderWords();
        const lv = await findListView();
        const row = within(lv).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)[0] as Gtk.Widget;
        await userEvent.click(row);
        expect(within(lv).queryByRole(Gtk.AccessibleRole.LIST_ITEM, { selected: true })).toBeNull();
    });

    it("populates the list view from the loaded word list", async () => {
        await renderWords();
        const lv = await findListView();
        expect(within(lv).getAllByRole(Gtk.AccessibleRole.LIST_ITEM).length).toBeGreaterThan(0);
    });

    it("updates the host window title to reflect the line count", async () => {
        await renderWords();
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: /^\d+ lines$/,
            as: Gtk.Window,
        });
        expect(window).toHaveAccessibleName(/^\d+ lines$/);
    });
});

describe("listviewWordsDemo search interactions", () => {
    it("updates the search entry text when text is typed", async () => {
        await renderWords();
        const entry = await findSearchEntry();
        await userEvent.type(entry, "lorem");
        expect(await screen.findByDisplayValue("lorem")).toBe(entry);
    });

    it("renders each loaded word and filters by a case-insensitive substring", async () => {
        const dialogSpy = vi
            .spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForPath(wordsFile(["alpha", "beta", "gamma", "delta"])));

        try {
            await renderDemoAndClickOpen();
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "4 lines" });

            for (const word of ["alpha", "beta", "gamma", "delta"]) {
                await screen.findByText(word);
            }

            const entry = await findSearchEntry();
            await userEvent.type(entry, "AMM");

            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "1 line" });
            await screen.findByText("gamma");
            expect(screen.queryByText("alpha")).toBeNull();
        } finally {
            dialogSpy.mockRestore();
        }
    });
});

describe("listviewWordsDemo search filtering", () => {
    it("filters the list view to zero matches when the search text matches nothing", async () => {
        await renderWords();
        const lv = await findListView();
        const entry = await findSearchEntry();
        await userEvent.type(entry, "qqqzzz");

        await waitFor(() => {
            expect(within(lv).queryAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(0);
        });
        await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "0 lines" });
    });

    it("clears the search entry when cleared", async () => {
        await renderWords();
        const entry = await findSearchEntry();
        await userEvent.type(entry, "abc");
        await userEvent.clear(entry);
        expect(screen.queryByDisplayValue("abc")).toBeNull();
    });

    it("restores the full word count when the search entry is cleared after filtering", async () => {
        await renderWords();
        const entry = await findSearchEntry();
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: /^\d+ lines$/,
            as: Gtk.Window,
        });
        const initialTitle = window.getTitle();

        if (initialTitle === null) {
            throw new Error("the demo window has no title");
        }

        await userEvent.type(entry, "qqqzzz");
        expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "0 lines" })).toBeVisible();

        await userEvent.clear(entry);
        expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: initialTitle })).toBe(window);
    });

    it("shows filtering progress and replaces a large word list with a small one", async () => {
        const words = Array.from({ length: 10_000 }, (_, index) => `word-${String(index)}`);
        const filePath = wordsFile(words);
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForPath(filePath));

        try {
            await renderWords();
            const openButton = await findButton("Open");
            await userEvent.click(openButton);
            await waitFor(() => {
                expect(openButton).toBeEnabled();
            });
            const progress = screen.findByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.ProgressBar });
            await userEvent.type(await findSearchEntry(), "not-present");
            const progressBar = await progress;
            expect(progressBar).toBeVisible();

            writeFileSync(filePath, "compact\nreplacement");
            await userEvent.click(openButton);
            expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "2 lines" })).toBeVisible();
            expect(await screen.findByText("compact")).toBeVisible();
            expect(await screen.findByText("replacement")).toBeVisible();
        } finally {
            dialogSpy.mockRestore();
        }
    });
});

describe("listviewWordsDemo Open button", () => {
    it("loads a resource URI without a local path", async () => {
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValue(Gio.File.newForUri(`resource://${wordsResourcePath}`));

        try {
            await renderDemoAndClickOpen();
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "3 lines" });

            for (const word of ["resource", "naïve", "東京"]) {
                expect(await screen.findByText(word)).toBeVisible();
            }
        } finally {
            dialogSpy.mockRestore();
        }
    });

    it("preserves duplicate lines while filtering and clearing the search", async () => {
        const file = Gio.File.newForPath(wordsFile(["alpha", "beta", "alpha"]));
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(file);

        try {
            await renderDemoAndClickOpen();
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "3 lines" });
            expect(await screen.findAllByText("alpha")).toHaveLength(2);
            const entry = await findSearchEntry();
            await userEvent.type(entry, "alpha");
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "2 lines" });
            expect(screen.getAllByText("alpha")).toHaveLength(2);
            await userEvent.clear(entry);
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "3 lines" });
            expect(screen.getAllByText("alpha")).toHaveLength(2);
            expect(await screen.findByText("beta")).toBeVisible();
        } finally {
            dialogSpy.mockRestore();
        }
    });

    it("loads words and re-titles the window to the new line count", async () => {
        const file = Gio.File.newForPath(wordsFile(["alpha", "beta", "gamma", "delta"]));
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open").mockResolvedValue(file);

        try {
            await renderDemoAndClickOpen();
            expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "4 lines" })).toBeVisible();
            const entry = await findSearchEntry();
            await userEvent.type(entry, "gamma");
            expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "1 line" })).toBeVisible();
        } finally {
            dialogSpy.mockRestore();
        }
    });
});

describe("listviewWordsDemo Open button failures", () => {
    it("preserves the filtered list after a read error and accepts an empty replacement", async () => {
        const missingFile = Gio.File.newForPath(join(tempDirRef.path, "does-not-exist.txt"));
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open")
            .mockResolvedValueOnce(Gio.File.newForUri(`resource://${wordsResourcePath}`))
            .mockResolvedValueOnce(missingFile)
            .mockResolvedValueOnce(Gio.File.newForPath(wordsFile([" ", "", "\t"])));

        try {
            await renderDemoAndClickOpen();
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "3 lines" });
            const entry = await findSearchEntry();
            await userEvent.type(entry, "naïve");
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "1 line" });
            await userEvent.click(await findButton("Open"));
            const alert = await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG);
            expect(screen.getByText("naïve")).toBeVisible();
            expect(entry).toHaveDisplayValue("naïve");
            await userEvent.click(within(alert).getByRole(Gtk.AccessibleRole.BUTTON, { name: "OK" }));
            await waitFor(() => {
                expect(screen.queryByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeNull();
            });
            await userEvent.click(await findButton("Open"));
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "0 lines" });
            expect(entry).toHaveDisplayValue("");
            expect(within(await findListView()).queryAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(0);
        } finally {
            dialogSpy.mockRestore();
        }
    });

    it("allows a new file after cancelling the picker in Strict Mode", async () => {
        const dialogSpy = vi.spyOn(Gtk.FileDialog.prototype, "open")
            .mockRejectedValueOnce(makeDialogDismissedError())
            .mockResolvedValueOnce(Gio.File.newForUri(`resource://${wordsResourcePath}`));

        try {
            await renderWords(true);
            const openButton = await findButton("Open");
            await userEvent.click(openButton);
            await waitFor(() => {
                expect(openButton).toBeEnabled();
            });
            expect(screen.queryByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeNull();
            await userEvent.click(openButton);
            await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "3 lines" });
            expect(await screen.findByText("東京")).toBeVisible();
        } finally {
            dialogSpy.mockRestore();
        }
    });
});
