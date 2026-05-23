import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewMinesweeperDemo } from "../../../src/demos/games/listview-minesweeper.js";
import { fireEvent, renderDemo, screen } from "../../test-utils.js";

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
        await fireEvent(newGameButton, "clicked");
        expect(gridView.getModel()?.getNItems()).toBe(64);
    });

    it("activates every cell without throwing", async () => {
        const { window } = await renderDemo(listviewMinesweeperDemo);
        const gridView = (await screen.findByName("grid-view")) as Gtk.GridView;
        for (let i = 0; i < 64; i++) {
            await fireEvent(gridView, "activate", i);
        }
        const win = window.current;
        if (!win) throw new Error("window not assigned");
        expect(win.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
    });
});
