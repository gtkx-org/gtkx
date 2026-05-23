import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { act, fireEvent, render, screen, waitFor } from "./test-utils.js";

const selectFirstDemoWithComponent = async (): Promise<void> => {
    const sidebar = (await screen.findByName("sidebar-list")) as Gtk.ListView;
    const model = sidebar.getModel();
    if (!model) throw new Error("sidebar has no model");
    for (let i = 0; i < model.getNItems(); i++) {
        await act(() => model.selectItem(i, true));
        await fireEvent(sidebar, "activate", i);
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        if (run.getSensitive()) return;
    }
    throw new Error("no demo with a component found in the sidebar");
};

describe("App search toggle", () => {
    it("turns the sidebar's search bar on when the header bar toggle is activated", async () => {
        await render(<App />, { wrapper: false });
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        await act(() => toggle.setActive(true));
        await fireEvent(toggle, "toggled");
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));
    });
});

describe("App run button", () => {
    it("enables the Run button after a demo with a component is selected", async () => {
        await render(<App />, { wrapper: false });
        await selectFirstDemoWithComponent();
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        expect(run.getSensitive()).toBe(true);
    });

    it("opens a demo window when Run is clicked", async () => {
        await render(<App />, { wrapper: false });
        await selectFirstDemoWithComponent();
        const beforeCount = (await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)).length;
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        await fireEvent(run, "clicked");
        await waitFor(async () => {
            const after = (await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)).length;
            expect(after).toBeGreaterThan(beforeCount);
        });
    });
});

describe("App about menu", () => {
    it("renders the about dialog after the About menu entry is activated", async () => {
        await render(<App />, { wrapper: false });
        const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;
        await act(() => menuButton.activateAction("app.about", null));
        await waitFor(async () => {
            const dialogs = await screen.findAllByRole(Gtk.AccessibleRole.DIALOG);
            expect(dialogs.length).toBeGreaterThan(0);
        });
    });
});

describe("App notebook", () => {
    it("renders the Info and Source tabs", async () => {
        await render(<App />, { wrapper: false });
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook.getNPages()).toBe(2);
    });

    it("advances the page when the notebook page is set", async () => {
        await render(<App />, { wrapper: false });
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook.getCurrentPage()).toBe(0);
        await act(() => notebook.setCurrentPage(1));
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(1));
    });
});
