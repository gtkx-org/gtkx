import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listviewMinesweeperDemo } from "../../../src/demos/games/listview-minesweeper.js";
import { renderDemo } from "../../test-utils.js";

const MINE = "\u{1F4A3}";

const collectLabels = (widget: Gtk.Widget, out: Gtk.Label[] = []): Gtk.Label[] => {
    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        if (child instanceof Gtk.Label) out.push(child);
        collectLabels(child, out);
    }
    return out;
};

const collectImages = (widget: Gtk.Widget, out: Gtk.Image[] = []): Gtk.Image[] => {
    for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) {
        if (child instanceof Gtk.Image) out.push(child);
        collectImages(child, out);
    }
    return out;
};

const cellTexts = (gridView: Gtk.Widget): string[] => collectLabels(gridView).map((label) => label.getLabel());

const mockMinesAt = (indices: number[]): void => {
    const values = indices.map((index) => (index + 0.5) / 64);
    let call = 0;
    vi.spyOn(Math, "random").mockImplementation(() => values[call++ % values.length] ?? 0);
};

beforeEach(() => {
    vi.spyOn(Gtk.MediaFile.prototype, "play").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("listviewMinesweeperDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewMinesweeperDemo.id).toBe("listview-minesweeper");
        expect(listviewMinesweeperDemo.title).toBe("Lists/Minesweeper");
        expect(listviewMinesweeperDemo.description.length).toBeGreaterThan(0);
        expect(listviewMinesweeperDemo.keywords).toEqual(expect.arrayContaining(["GtkGridView", "GListModel", "game"]));
        expect(typeof listviewMinesweeperDemo.sourceCode).toBe("string");
        expect(listviewMinesweeperDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(listviewMinesweeperDemo.component).toBeTypeOf("function");
    });
});

describe("listviewMinesweeperDemo rendering", () => {
    it("renders the New Game button and a fresh 8x8 board of unrevealed cells", async () => {
        await renderDemo(listviewMinesweeperDemo);
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game" });
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        expect(gridView.getModel()?.getNItems()).toBe(64);
        const texts = cellTexts(gridView);
        expect(texts).toHaveLength(64);
        expect(texts.every((text) => text === "?")).toBe(true);
    });

    it("starts with no trophy in the header (title widget is null while playing)", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const header = await screen.findByName("minesweeper-header");
        expect(collectImages(header).some((image) => image.getIconName() === "trophy-gold")).toBe(false);
    });
});

describe("listviewMinesweeperDemo gameplay", () => {
    it("reveals the focused cell on a single-press activation (keyboard Enter)", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        gridView.grabFocus();
        await userEvent.keyboard(gridView, "{Enter}");
        await waitFor(() => {
            const texts = cellTexts(gridView);
            expect(texts[0]).not.toBe("?");
            expect(texts.filter((text) => text === "?")).toHaveLength(63);
        });
    });

    it("restores the revealed cell to '?' after pressing New Game", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        await fireEvent(gridView, "activate", 0);
        await waitFor(() => expect(cellTexts(gridView)[0]).not.toBe("?"));

        const newGameButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game" })) as Gtk.Button;
        await userEvent.click(newGameButton);
        await waitFor(() => {
            const texts = cellTexts(gridView);
            expect(texts).toHaveLength(64);
            expect(texts.every((text) => text === "?")).toBe(true);
        });
    });

    it("loses when a mine is activated and locks the board against further reveals", async () => {
        mockMinesAt([0, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;

        await fireEvent(gridView, "activate", 0);
        await waitFor(() => expect(cellTexts(gridView)[0]).toBe(MINE));

        await fireEvent(gridView, "activate", 1);
        await waitFor(() => Promise.resolve());
        const texts = cellTexts(gridView);
        expect(texts[1]).toBe("?");
        expect(texts.filter((text) => text === "?")).toHaveLength(63);
    });

    it("wins when every safe cell is revealed and swaps in the trophy title widget", async () => {
        mockMinesAt([54, 55, 56, 57, 58, 59, 60, 61, 62, 63]);
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        const header = await screen.findByName("minesweeper-header");

        for (let position = 0; position < 54; position++) {
            await fireEvent(gridView, "activate", position);
        }

        await waitFor(() => {
            expect(collectImages(header).some((image) => image.getIconName() === "trophy-gold")).toBe(true);
        });

        const texts = cellTexts(gridView);
        expect(texts[0]).toBe("");
        expect(texts.slice(0, 54).some((text) => /^[1-8]$/.test(text))).toBe(true);
        expect(texts.slice(54).every((text) => text === "?")).toBe(true);
    });
});
