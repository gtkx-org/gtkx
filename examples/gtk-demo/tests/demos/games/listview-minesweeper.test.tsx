import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewMinesweeperDemo } from "../../../src/demos/games/listview-minesweeper.js";
import { renderDemo } from "../../test-utils.js";

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
    it("renders the New Game button and the grid view", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const newGameButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game" })) as Gtk.Button;
        expect(newGameButton).toBeInstanceOf(Gtk.Button);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        expect(gridView).toBeInstanceOf(Gtk.GridView);
        expect(gridView.getMinColumns()).toBe(8);
        expect(gridView.getMaxColumns()).toBe(8);
        expect(gridView.getSingleClickActivate()).toBe(true);
    });

    it("backs the grid view with a 64-item model on first render", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        const model = gridView.getModel();
        expect(model?.getNItems()).toBe(64);
    });
});

describe("listviewMinesweeperDemo gameplay", () => {
    it("dispatches the activate signal for each cell without ending the game prematurely", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        await fireEvent(gridView, "activate", 0);
        expect(gridView.getModel()?.getNItems()).toBe(64);
    });

    it("preserves the 64-item model after pressing New Game", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        await fireEvent(gridView, "activate", 0);
        const newGameButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game" })) as Gtk.Button;
        await userEvent.click(newGameButton);
        expect(gridView.getModel()?.getNItems()).toBe(64);
    });

    it("activates every cell and either wins or hides cells without losing the model", async () => {
        await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        for (let i = 0; i < 64; i++) {
            await fireEvent(gridView, "activate", i);
        }
        expect(gridView.getModel()?.getNItems()).toBe(64);
        const header = (await screen.findByName("minesweeper-header")) as Gtk.HeaderBar;
        const newGame = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Game" })) as Gtk.Button;
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        expect(newGame.getSensitive()).toBe(true);
    });
});
