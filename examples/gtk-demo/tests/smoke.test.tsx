import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { configure, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Demo } from "../src/app.js";
import { parseTitle } from "../src/context/demo-context.js";
import { demos } from "../src/demos/index.js";

let nextAppId = 0;

const renderApp = () =>
    render(
        <GtkApplication applicationId={`org.gtkx.gtkdemoe2e${nextAppId++}`} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Demo />
        </GtkApplication>,
        { container: rootElement },
    );

const toplevelWindows = async (): Promise<Gtk.Window[]> =>
    (await screen.findAllByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window[];

const demoWindows = (): Gtk.Window[] => screen.queryAllByName("demo-window") as Gtk.Window[];

const findRun = async (): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;

const requireOnlyDemoWindow = (windows: Gtk.Window[], title: string): Gtk.Window => {
    const [win, ...rest] = windows;
    if (!win || rest.length > 0)
        throw new Error(`expected exactly one demo window for "${title}", found ${windows.length}`);
    return win;
};

const firstMatching = (root: Gtk.Widget, predicate: (w: Gtk.Widget) => boolean): Gtk.Widget | null => {
    if (predicate(root)) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = firstMatching(child, predicate);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

const actionNameOf = (widget: Gtk.Widget): string | null => {
    const getter = Reflect.get(widget, "getActionName");
    return typeof getter === "function" ? ((getter as () => string | null).call(widget) ?? null) : null;
};

// Close a window the way a user would: the title-bar close button. A
// non-deletable window has none, so the user completes its form and clicks the
// default button instead (the password demo enables Done once the fields match).
const clickWindowClose = async (window: Gtk.Window): Promise<void> => {
    const closeButton = firstMatching(window, (w) => actionNameOf(w) === "window.close");
    if (closeButton) {
        await userEvent.click(closeButton);
        return;
    }
    const bound = within(window);
    await userEvent.type((await bound.findByName("password-entry")) as Gtk.Editable, "hunter2");
    await userEvent.type((await bound.findByName("confirm-entry")) as Gtk.Editable, "hunter2");
    const done = await bound.findByRole(Gtk.AccessibleRole.BUTTON, { name: /Done/ });
    await userEvent.click(done);
};

const dismissDialog = async (dialog: Gtk.Widget): Promise<void> => {
    const close = firstMatching(dialog, (w) => w.getCssClasses().includes("close"));
    if (!close) throw new Error("dialog has no close button");
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByRole(Gtk.AccessibleRole.DIALOG)).toBeNull());
};

const exerciseWindowDemo = async (title: string, run: Gtk.Button, mainWindow: Gtk.ApplicationWindow): Promise<void> => {
    await userEvent.click(run);

    await waitFor(() => expect(demoWindows().length, `demo "${title}" did not open a window`).toBe(1));
    const win = requireOnlyDemoWindow(demoWindows(), title);

    await waitFor(() => expect(win.getVisible(), `demo "${title}" window is not visible`).toBe(true));
    await waitFor(() => expect(win.isActive(), `demo "${title}" window is not in the foreground`).toBe(true));
    expect(win.getChild(), `demo "${title}" opened an empty window with no content`).not.toBeNull();

    await clickWindowClose(win);
    await waitFor(() => expect(demoWindows().length, `demo "${title}" window did not close`).toBe(0));
    expect(mainWindow.getVisible(), `closing demo "${title}" tore down the main window`).toBe(true);
};

interface DialogHooks {
    printRun: ReturnType<typeof vi.fn>;
    pageSetup: ReturnType<typeof vi.fn>;
}

const exerciseDialogDemo = async (title: string, run: Gtk.Button, hooks: DialogHooks): Promise<void> => {
    const baseline = (await toplevelWindows()).length;
    await userEvent.click(run);

    if (title === "Error States") {
        const dialog = await screen.findByRole(Gtk.AccessibleRole.DIALOG);
        const bound = within(dialog);
        expect(await bound.findByRole(Gtk.AccessibleRole.SWITCH)).toBeInstanceOf(Gtk.Switch);
        expect((await bound.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)).length).toBeGreaterThanOrEqual(2);
        await dismissDialog(dialog);
        return;
    }

    const spy = title === "Printing" ? hooks.printRun : hooks.pageSetup;
    await waitFor(() => expect(spy, `"${title}" did not trigger its dialog`).toHaveBeenCalled());
    expect((await toplevelWindows()).length, `"${title}" leaked a top-level window`).toBe(baseline);
};

const openMenuItem = async (menuButton: Gtk.MenuButton, name: string): Promise<void> => {
    await userEvent.click(menuButton);
    const item = await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name });
    await userEvent.click(item);
};

describe("gtk-demo end-to-end", () => {
    beforeAll(() => {
        configure({ asyncUtilTimeout: 20000 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("opens every demo, exercises the search bar, and invokes each main menu action", async () => {
        const printRun = vi.spyOn(Gtk.PrintOperation.prototype, "run").mockImplementation(function mockedRun(
            this: Gtk.PrintOperation,
        ) {
            this.emit("done", Gtk.PrintOperationResult.APPLY);
            return Gtk.PrintOperationResult.APPLY;
        });
        const pageSetup = vi
            .spyOn(Gtk, "printRunPageSetupDialogAsync")
            .mockImplementation((_parent, _pageSetup, _settings, done) => done(new Gtk.PageSetup()));

        await renderApp();
        const mainWindow = (await screen.findByName("main-window")) as Gtk.ApplicationWindow;
        const sidebar = (await screen.findByName("sidebar-list")) as Gtk.ListView;
        const model = sidebar.getModel() as Gtk.SelectionModel;

        // --- Search bar ------------------------------------------------------
        const searchToggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        const fullCount = model.getNItems();

        expect(searchBar.getSearchMode()).toBe(false);
        await userEvent.click(searchToggle);
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));

        const searchEntry = (await within(searchBar).findByRole(Gtk.AccessibleRole.SEARCH_BOX)) as Gtk.SearchEntry;
        await userEvent.type(searchEntry, "css");
        await waitFor(() => expect(model.getNItems()).toBeLessThan(fullCount));
        expect(model.getNItems()).toBeGreaterThan(0);
        await userEvent.clear(searchEntry);
        await waitFor(() => expect(model.getNItems()).toBe(fullCount));

        await userEvent.click(searchToggle);
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(false));

        // --- Every demo ------------------------------------------------------
        const dialogTitles = new Set(demos.filter((d) => d.dialogOnly).map((d) => parseTitle(d.title).displayTitle));
        const expectedWindowDemos = demos.filter((d) => d.component && !d.dialogOnly).length;

        let previousTitle = mainWindow.getTitle() ?? "";
        let windowDemosRun = 0;
        const dialogDemosRun = new Set<string>();
        const rowCount = model.getNItems();

        for (let position = 0; position < rowCount; position++) {
            await userEvent.selectOptions(sidebar, position);
            const title = mainWindow.getTitle() ?? "";
            if (title === previousTitle) continue; // category row: selection did not change the demo
            previousTitle = title;

            const run = await findRun();
            if (!run.getSensitive()) continue; // intro demo has no runnable component

            if (dialogTitles.has(title)) {
                await exerciseDialogDemo(title, run, { printRun, pageSetup });
                dialogDemosRun.add(title);
            } else {
                await exerciseWindowDemo(title, run, mainWindow);
                windowDemosRun++;
            }
        }

        expect(windowDemosRun, "not every window demo was exercised").toBe(expectedWindowDemos);
        expect(dialogDemosRun).toEqual(dialogTitles);

        // --- Main menu actions ----------------------------------------------
        const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;

        await openMenuItem(menuButton, "About GTK Demo");
        await dismissDialog(await screen.findByRole(Gtk.AccessibleRole.DIALOG));

        await openMenuItem(menuButton, "Keyboard Shortcuts");
        expect((await screen.findAllByText("Search demos")).length).toBeGreaterThan(0);
        await dismissDialog(await screen.findByRole(Gtk.AccessibleRole.DIALOG));

        const inspector = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation(() => {});
        await openMenuItem(menuButton, "Inspector");
        await waitFor(() => expect(inspector).toHaveBeenCalledWith(true));
    }, 180000);
});
