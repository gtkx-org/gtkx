import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { path as logoResourcePath } from "#data/icons/org.gtk.Demo4.svg";
import { Demo } from "../src/app.js";

let nextAppId = 0;

const renderDemo = () =>
    render(
        <GtkApplication applicationId={`org.gtkx.gtkdemoint${nextAppId++}`} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Demo />
        </GtkApplication>,
        { container: rootElement },
    );

const selectFirstDemoWithComponent = async (): Promise<void> => {
    const sidebar = (await screen.findByName("sidebar-list")) as Gtk.ListView;
    const selectionModel = sidebar.getModel() as Gtk.SelectionModel;
    expect(selectionModel).not.toBeNull();
    let selectedIndex: number | null = null;
    for (let i = 0; i < selectionModel.getNItems(); i++) {
        await userEvent.selectOptions(sidebar, i);
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        if (run.getSensitive()) {
            selectedIndex = i;
            break;
        }
    }
    expect(selectedIndex, "no demo with a runnable component found in the sidebar").not.toBeNull();
};

const openMenuItem = async (name: string): Promise<void> => {
    const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;
    await userEvent.click(menuButton);
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name }));
};

describe("App search toggle", () => {
    it("turns the sidebar's search bar on when the header bar toggle is activated", async () => {
        await renderDemo();
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        await userEvent.click(toggle);
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));
    });
});

describe("App run button", () => {
    it("enables the Run button after a demo with a component is selected", async () => {
        await renderDemo();
        await selectFirstDemoWithComponent();
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        expect(run.getSensitive()).toBe(true);
    });

    it("opens a demo window when Run is clicked", async () => {
        await renderDemo();
        await selectFirstDemoWithComponent();
        const beforeCount = (await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)).length;
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        await userEvent.click(run);
        await waitFor(async () => {
            const after = (await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)).length;
            expect(after).toBeGreaterThan(beforeCount);
        });
    });
});

describe("App about menu", () => {
    it("renders the about dialog after the About menu entry is activated", async () => {
        await renderDemo();
        await openMenuItem("About GTK Demo");
        await waitFor(async () => {
            const dialogs = await screen.findAllByRole(Gtk.AccessibleRole.DIALOG);
            expect(dialogs.length).toBeGreaterThan(0);
        });
    });

    it("bundles the application icon into the GResource so AdwAboutDialog can resolve it", async () => {
        await renderDemo();
        const display = Gdk.Display.getDefault();
        expect(display, "no default display available").not.toBeNull();
        expect(() => Gio.resourcesLookupData(logoResourcePath, Gio.ResourceLookupFlags.NONE)).not.toThrow();
    });
});

describe("App notebook", () => {
    it("renders the Info and Source tabs", async () => {
        await renderDemo();
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Info" });
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Source" });
    });

    it("advances the page when the notebook page is set", async () => {
        await renderDemo();
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook.getCurrentPage()).toBe(0);
        await act(() => notebook.setCurrentPage(1));
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(1));
    });
});

describe("App keyboard shortcuts dialog", () => {
    it("opens the keyboard shortcuts dialog when the menu entry is activated", async () => {
        await renderDemo();
        await openMenuItem("Keyboard Shortcuts");
        await waitFor(async () => {
            const dialogs = await screen.findAllByRole(Gtk.AccessibleRole.DIALOG);
            expect(dialogs.length).toBeGreaterThan(0);
        });
        expect((await screen.findAllByText("Search demos")).length).toBeGreaterThan(0);
    });
});

describe("App inspector activation", () => {
    it("invokes Gtk.Window.setInteractiveDebugging when the inspector menu entry is activated", async () => {
        const debugSpy = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation(() => {});
        try {
            await renderDemo();
            await openMenuItem("Inspector");
            await waitFor(() => expect(debugSpy).toHaveBeenCalled());
        } finally {
            debugSpy.mockRestore();
        }
    });
});

describe("App global shortcuts", () => {
    it("toggles the search bar when Ctrl+F is pressed", async () => {
        await renderDemo();
        const body = await screen.findByName("main-window-body");
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        await userEvent.keyboard(body, "{Control>}f{/Control}");
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));
    });

    it("activates Gtk.Window.setInteractiveDebugging when Ctrl+Shift+I is pressed", async () => {
        const debugSpy = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation(() => {});
        try {
            await renderDemo();
            const body = await screen.findByName("main-window-body");
            await userEvent.keyboard(body, "{Control>}{Shift>}i{/Shift}{/Control}");
            await waitFor(() => expect(debugSpy).toHaveBeenCalledWith(true));
        } finally {
            debugSpy.mockRestore();
        }
    });

    it("advances the notebook page when Ctrl+Page_Down is pressed", async () => {
        await renderDemo();
        const body = await screen.findByName("main-window-body");
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook.getCurrentPage()).toBe(0);
        await userEvent.keyboard(body, "{Control>}{PageDown}{/Control}");
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(1));
    });

    it("returns to the previous notebook page when Ctrl+Page_Up is pressed", async () => {
        await renderDemo();
        const body = await screen.findByName("main-window-body");
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        await userEvent.keyboard(body, "{Control>}{PageDown}{/Control}");
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(1));
        await userEvent.keyboard(body, "{Control>}{PageUp}{/Control}");
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(0));
    });
});

describe("App opens demos with custom titlebars and dialog-only demos", () => {
    it("renders Run-enabled demo entries from the sidebar (covers DemoWindow titlebar/provider paths)", async () => {
        await renderDemo();
        await selectFirstDemoWithComponent();
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        await userEvent.click(run);
        await waitFor(async () => {
            const windows = await screen.findAllByRole(Gtk.AccessibleRole.WINDOW);
            expect(windows.length).toBeGreaterThan(1);
        });
    });
});
