import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listviewMinesweeperDemo } from "../../../src/demos/games/listview-minesweeper.js";
import { collectWidgets, renderDemo } from "../../test-utils.js";

const MINE = "\u{1F4A3}";

const cellTexts = (gridView: Gtk.Widget): string[] =>
    collectWidgets(gridView, Gtk.Label).map((label) => label.getLabel());

const hasTrophy = (header: Gtk.Widget): boolean =>
    collectWidgets(header, Gtk.Image).some((image) => image.getIconName() === "trophy-gold");

const renderGridView = async (): Promise<Gtk.GridView> => {
    await renderDemo(listviewMinesweeperDemo);

    return await screen.findByName("grid-view", { as: Gtk.GridView });
};

beforeEach(() => {
    vi.spyOn(Gtk.MediaFile.prototype, "play").mockImplementation((): void => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("listviewMinesweeperDemo rendering", () => {
    it("renders the New Game button and a fresh 8x8 board of unrevealed cells", async () => {
        await renderDemo(listviewMinesweeperDemo);
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game" });
        const gridView = await screen.findByName("grid-view", { as: Gtk.GridView });
        expect(gridView.getModel()).toHaveObjectProperty("nItems", 64);
        const texts = cellTexts(gridView);
        expect(texts).toHaveLength(64);
        expect(texts.every((text) => text === "?")).toBe(true);
    });

    it("starts with no trophy in the header (title widget is null while playing)", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const header = await screen.findByName("minesweeper-header");
        expect(hasTrophy(header)).toBe(false);
    });
});

describe("listviewMinesweeperDemo gameplay", () => {
    it("reveals the focused cell on a single-press activation (keyboard Enter)", async () => {
        const gridView = await renderGridView();
        gridView.grabFocus();
        await userEvent.keyboard(gridView, "{Enter}");

        await waitFor(() => {
            const texts = cellTexts(gridView);
            expect(texts[0]).not.toBe("?");
            expect(texts.filter((text) => text === "?")).toHaveLength(63);
        });
    });

    it("restores the revealed cell to '?' after pressing New Game", async () => {
        const gridView = await renderGridView();
        await fireEvent(gridView, "activate", 0);

        await waitFor(() => {
            expect(cellTexts(gridView)[0]).not.toBe("?");
        });

        const newGameButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game", as: Gtk.Button });
        await userEvent.click(newGameButton);

        await waitFor(() => {
            const texts = cellTexts(gridView);
            expect(texts).toHaveLength(64);
            expect(texts.every((text) => text === "?")).toBe(true);
        });
    });
});

describe("listviewMinesweeperDemo outcomes", () => {
    it("loses when a mine is activated and locks the board against further reveals", async () => {
        const gridView = await renderGridView();
        let mineIndex = -1;

        for (let position = 0; position < 64; position++) {
            await fireEvent(gridView, "activate", position);
            await waitFor(() => {
                expect(cellTexts(gridView)[position]).not.toBe("?");
            });

            if (cellTexts(gridView)[position] === MINE) {
                mineIndex = position;
                break;
            }
        }

        expect(mineIndex).toBeGreaterThanOrEqual(0);
        const hiddenIndex = cellTexts(gridView).indexOf("?");
        expect(hiddenIndex).toBeGreaterThanOrEqual(0);

        await fireEvent(gridView, "activate", hiddenIndex);
        expect(cellTexts(gridView)[hiddenIndex]).toBe("?");
    });
});
