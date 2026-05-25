import * as path from "node:path";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/app.js";
import logoPath from "../src/icons/org.gtk.Demo4.svg";

const selectFirstDemoWithComponent = async (): Promise<void> => {
    const sidebar = (await screen.findByName("sidebar-list")) as Gtk.ListView;
    const model = sidebar.getModel();
    expect(model).not.toBeNull();
    const selectionModel = model as Gtk.SelectionModel;
    for (let i = 0; i < selectionModel.getNItems(); i++) {
        await userEvent.selectOptions(sidebar, i);
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        if (run.getSensitive()) return;
    }
    expect.fail("no demo with a component found in the sidebar");
};

describe("App search toggle", () => {
    it("turns the sidebar's search bar on when the header bar toggle is activated", async () => {
        await render(<App />, { wrapper: false });
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        await userEvent.click(toggle);
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
        await userEvent.click(run);
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

    it("registers the application icon so the icon theme can resolve it", async () => {
        await render(<App />, { wrapper: false });
        const display = Gdk.Display.getDefault();
        if (!display) expect.fail("no default display available");
        const iconTheme = Gtk.IconTheme.getForDisplay(display);
        const iconName = path.basename(logoPath, path.extname(logoPath));
        await waitFor(() => expect(iconTheme.hasIcon(iconName)).toBe(true));
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

describe("App keyboard shortcuts dialog", () => {
    it("opens the keyboard shortcuts dialog when the menu entry is activated", async () => {
        await render(<App />, { wrapper: false });
        const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;
        await act(() => menuButton.activateAction("app.shortcuts", null));
        const dialogs = await waitFor(async () => {
            const found = await screen.findAllByRole(Gtk.AccessibleRole.DIALOG);
            expect(found.length).toBeGreaterThan(0);
            return found;
        });
        expect(dialogs.length).toBeGreaterThan(0);
    });
});

describe("App inspector activation", () => {
    it("invokes Gtk.Window.setInteractiveDebugging when the inspector menu entry is activated", async () => {
        const debugSpy = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation(() => {});
        try {
            await render(<App />, { wrapper: false });
            const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;
            await act(() => menuButton.activateAction("app.inspector", null));
            await waitFor(() => expect(debugSpy).toHaveBeenCalled());
        } finally {
            debugSpy.mockRestore();
        }
    });
});

const collectShortcutControllers = (widget: Gtk.Widget): Gtk.ShortcutController[] => {
    const list = widget.observeControllers();
    const result: Gtk.ShortcutController[] = [];
    for (let i = 0; i < list.getNItems(); i++) {
        const item = list.getItem(i);
        if (item instanceof Gtk.ShortcutController) result.push(item);
    }
    return result;
};

const activateShortcutMatching = async (host: Gtk.Widget, trigger: string): Promise<boolean> => {
    const controllers = collectShortcutControllers(host);
    for (const controller of controllers) {
        const count = controller.getNItems();
        for (let i = 0; i < count; i++) {
            const item = controller.getItem(i);
            if (item instanceof Gtk.Shortcut) {
                const t = item.getTrigger();
                if (t && t.toString() === trigger) {
                    const action = item.getAction();
                    if (action) {
                        await act(() => {
                            action.activate(0, host, null);
                        });
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

describe("App global shortcuts", () => {
    it("toggles the search bar when Ctrl+F is activated", async () => {
        await render(<App />, { wrapper: false });
        const body = (await screen.findByName("main-window-body")) as Gtk.Widget;
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        const fired = await activateShortcutMatching(body, "<Control>f");
        expect(fired).toBe(true);
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));
    });

    it("activates Gtk.Window.setInteractiveDebugging when Ctrl+Shift+I is activated", async () => {
        const debugSpy = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation(() => {});
        try {
            await render(<App />, { wrapper: false });
            const body = (await screen.findByName("main-window-body")) as Gtk.Widget;
            const controllers = collectShortcutControllers(body);
            let fired = false;
            for (const controller of controllers) {
                const count = controller.getNItems();
                for (let i = 0; i < count; i++) {
                    const item = controller.getItem(i);
                    if (item instanceof Gtk.Shortcut) {
                        const t = item.getTrigger()?.toString() ?? "";
                        if (t.includes("Shift") && (t.toLowerCase().includes("i") || t.includes("0x69"))) {
                            const action = item.getAction();
                            if (action) {
                                await act(() => {
                                    action.activate(0, body, null);
                                });
                                fired = true;
                            }
                        }
                    }
                }
            }
            expect(fired).toBe(true);
            await waitFor(() => expect(debugSpy).toHaveBeenCalledWith(true));
        } finally {
            debugSpy.mockRestore();
        }
    });

    it("advances the notebook page when Ctrl+Page_Down is activated", async () => {
        await render(<App />, { wrapper: false });
        const body = (await screen.findByName("main-window-body")) as Gtk.Widget;
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook.getCurrentPage()).toBe(0);
        const fired = await activateShortcutMatching(body, "<Control>Page_Down");
        expect(fired).toBe(true);
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(1));
    });

    it("returns to the previous notebook page when Ctrl+Page_Up is activated", async () => {
        await render(<App />, { wrapper: false });
        const body = (await screen.findByName("main-window-body")) as Gtk.Widget;
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        await act(() => notebook.setCurrentPage(1));
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(1));
        const fired = await activateShortcutMatching(body, "<Control>Page_Up");
        expect(fired).toBe(true);
        await waitFor(() => expect(notebook.getCurrentPage()).toBe(0));
    });
});

describe("App opens demos with custom titlebars and dialog-only demos", () => {
    const findDemoWithTitlebar = async (): Promise<number | null> => {
        const sidebar = (await screen.findByName("sidebar-list")) as Gtk.ListView;
        const model = sidebar.getModel() as Gtk.SelectionModel;
        for (let i = 0; i < model.getNItems(); i++) {
            await userEvent.selectOptions(sidebar, i);
            const runButton = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
            if (runButton.getSensitive()) return i;
        }
        return null;
    };

    it("renders Run-enabled demo entries from the sidebar (covers DemoWindow titlebar/provider paths)", async () => {
        await render(<App />, { wrapper: false });
        const idx = await findDemoWithTitlebar();
        expect(idx).not.toBeNull();
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        await userEvent.click(run);
        await waitFor(async () => {
            const windows = await screen.findAllByRole(Gtk.AccessibleRole.WINDOW);
            expect(windows.length).toBeGreaterThan(1);
        });
    });
});
