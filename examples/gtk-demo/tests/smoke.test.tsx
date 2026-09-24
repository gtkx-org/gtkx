import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { configure, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { beforeAll, describe, expect, it } from "vitest";
import { expectInspectorOpened } from "./native-dialogs.js";
import { createAppRenderer } from "./render-app.js";
import { findButton, findWidget } from "./test-utils.js";

const renderApp = createAppRenderer("org.gtkx.gtkdemoe2e");

const demoWindows = (): Gtk.Window[] => screen.queryAllByName("demo-window", { as: Gtk.Window });

const requireOnlyDemoWindow = (windows: Gtk.Window[], title: string): Gtk.Window => {
    const [win, ...rest] = windows;

    if (!win || rest.length > 0) {
        throw new Error(`expected exactly one demo window for "${title}", found ${String(windows.length)}`);
    }

    return win;
};

const readWindowTitle = (window: Gtk.Window): string => window.getTitle() ?? "";

const dismissDialog = async (dialog: Gtk.Widget): Promise<void> => {
    const close = findWidget(dialog, Gtk.Widget, (w) => w.getCssClasses().includes("close"));

    if (!close) {
        throw new Error("dialog has no close button");
    }

    await userEvent.click(close);

    await waitFor(() => {
        expect(screen.queryByRole(Gtk.AccessibleRole.DIALOG)).toBeNull();
    });
};

const waitForDemoWindows = async (expected: number): Promise<void> => {
    await waitFor(() => {
        expect(demoWindows()).toHaveLength(expected);
    });
};

const exerciseWindowDemo = async (run: Gtk.Button, mainWindow: Gtk.ApplicationWindow): Promise<void> => {
    await userEvent.click(run);
    await waitForDemoWindows(1);
    const win = requireOnlyDemoWindow(demoWindows(), "Password Entry");

    await waitFor(() => {
        expect(win).toBeVisible();
    });

    await waitFor(() => {
        expect(win.isActive()).toBe(true);
    });

    expect(win.getTitle()).toBe("Choose a Password");
    expect(win.getChild()).not.toBeNull();
    await userEvent.type(within(win).getByName("password-entry"), "hunter2");
    await userEvent.type(within(win).getByName("confirm-entry"), "hunter2");
    await userEvent.click(within(win).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Done" }));
    await waitForDemoWindows(0);
    expect(mainWindow).toBeVisible();
};

const openMenuItem = async (menuButton: Gtk.MenuButton, name: string): Promise<void> => {
    await userEvent.click(menuButton);
    const item = await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name });
    await userEvent.click(item);
};

const exerciseSearchBar = async (sidebar: Gtk.ListView): Promise<void> => {
    const searchToggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
        name: "Search demos",
        as: Gtk.ToggleButton,
    });
    const searchBar = await screen.findByName("sidebar-search-bar", { as: Gtk.SearchBar });
    const rows = within(sidebar);
    expect(rows.getByText("Themes")).toBeVisible();
    expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
    await userEvent.click(searchToggle);

    await waitFor(() => {
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
    });

    const searchEntry = await within(searchBar).findByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });
    await userEvent.type(searchEntry, "css");

    await waitFor(() => {
        expect(rows.queryByText("Themes")).toBeNull();
    });

    expect(rows.getByText("CSS Basics")).toBeVisible();
    await userEvent.clear(searchEntry);

    await waitFor(() => {
        expect(rows.getByText("Themes")).toBeVisible();
    });

    await userEvent.click(searchToggle);

    await waitFor(() => {
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
    });
};

const selectPasswordEntry = async (mainWindow: Gtk.ApplicationWindow): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Search demos" }));
    const searchBar = screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar });
    const searchEntry = within(searchBar).getByRole(Gtk.AccessibleRole.SEARCH_BOX);
    await userEvent.type(searchEntry, "Password Entry");
    const sidebar = screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
    await userEvent.click(await within(sidebar).findByText("Password Entry"));

    await waitFor(() => {
        expect(readWindowTitle(mainWindow)).toBe("Password Entry");
    });
};

const exerciseMainMenu = async (): Promise<void> => {
    const menuButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu", as: Gtk.MenuButton });
    await openMenuItem(menuButton, "About GTK Demo");
    const about = await screen.findByRole(Gtk.AccessibleRole.DIALOG);
    const gtkVersion = [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()].join(".");
    expect(within(about).getByText(gtkVersion)).toBeVisible();
    await dismissDialog(about);
    await openMenuItem(menuButton, "Keyboard Shortcuts Ctrl+?");
    const [shortcutLabel] = await screen.findAllByText("Search demos");
    expect(shortcutLabel).toBeRooted();
    await dismissDialog(await screen.findByRole(Gtk.AccessibleRole.DIALOG));
    await expectInspectorOpened(async () => {
        await openMenuItem(menuButton, "Inspector Shift+Ctrl+I");
    });
    expect(screen.getByName("main-window")).toBeVisible();
};

describe("gtk-demo end-to-end", () => {
    beforeAll(() => {
        configure({ asyncUtilTimeout: 20_000 });
    });

    it("searches, runs a demo, and invokes each main menu action", async () => {
        await renderApp();
        const mainWindow = await screen.findByName("main-window", { as: Adw.ApplicationWindow });
        expect(mainWindow).toBeVisible();
        const sidebar = await screen.findByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
        await exerciseSearchBar(sidebar);
        await selectPasswordEntry(mainWindow);
        await exerciseWindowDemo(await findButton("Run"), mainWindow);
        await exerciseMainMenu();
    });
});
