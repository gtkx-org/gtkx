import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const demoWindows = async (): Promise<Gtk.Window[]> =>
    (await toplevelWindows()).filter((w) => !(w instanceof Gtk.ApplicationWindow));

const findRun = async (): Promise<Gtk.Button> =>
    (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;

const requireMainWindow = (windows: Gtk.Window[]): Gtk.ApplicationWindow => {
    const main = windows.find((w): w is Gtk.ApplicationWindow => w instanceof Gtk.ApplicationWindow);
    if (!main) throw new Error("main application window not found");
    return main;
};

const requireOnlyDemoWindow = (windows: Gtk.Window[], title: string): Gtk.Window => {
    const [win, ...rest] = windows;
    if (!win || rest.length > 0)
        throw new Error(`expected exactly one demo window for "${title}", found ${windows.length}`);
    return win;
};

const adwDialogAncestor = (widget: Gtk.Widget): Adw.Dialog => {
    let current: Gtk.Widget | null = widget;
    while (current && !(current instanceof Adw.Dialog)) current = current.getParent();
    if (!(current instanceof Adw.Dialog)) throw new Error("no AdwDialog ancestor found");
    return current;
};

const exerciseWindowDemo = async (title: string, run: Gtk.Button, mainWindow: Gtk.ApplicationWindow): Promise<void> => {
    await userEvent.click(run);

    await waitFor(async () => expect((await demoWindows()).length).toBe(1));
    const win = requireOnlyDemoWindow(await demoWindows(), title);

    await waitFor(() => expect(win.getVisible(), `demo "${title}" window is not visible`).toBe(true));
    await waitFor(() => expect(win.isActive(), `demo "${title}" window is not in the foreground`).toBe(true));
    expect(win.getChild(), `demo "${title}" opened an empty window with no content`).not.toBeNull();

    await act(() => {
        win.close();
    });
    await waitFor(async () => expect((await demoWindows()).length, `demo "${title}" window did not close`).toBe(0));
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
        const modeSwitch = (await screen.findByRole(Gtk.AccessibleRole.SWITCH)) as Gtk.Switch;
        expect(modeSwitch).toBeInstanceOf(Gtk.Switch);
        const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(entries.length, "Error States dialog is missing its input fields").toBeGreaterThanOrEqual(2);
        const dialog = adwDialogAncestor(modeSwitch);
        await act(() => {
            dialog.close();
        });
        await waitFor(() => expect(screen.queryByRole(Gtk.AccessibleRole.SWITCH)).toBeNull());
        return;
    }

    const spy = title === "Printing" ? hooks.printRun : hooks.pageSetup;
    await waitFor(() => expect(spy, `"${title}" did not trigger its dialog`).toHaveBeenCalled());
    expect((await toplevelWindows()).length, `"${title}" leaked a top-level window`).toBe(baseline);
};

const closeVisibleDialog = async (): Promise<void> => {
    const dialog = (await screen.findByRole(Gtk.AccessibleRole.DIALOG)) as Gtk.Widget;
    if (!(dialog instanceof Adw.Dialog)) throw new Error("expected an AdwDialog");
    await act(() => {
        dialog.close();
    });
    await waitFor(() => expect(screen.queryByRole(Gtk.AccessibleRole.DIALOG)).toBeNull());
};

describe("gtk-demo end-to-end", () => {
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
        const mainWindow = requireMainWindow(await toplevelWindows());
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

        await act(() => menuButton.activateAction("win.about", null));
        await waitFor(async () =>
            expect((await screen.findAllByRole(Gtk.AccessibleRole.DIALOG)).length).toBeGreaterThan(0),
        );
        await closeVisibleDialog();

        await act(() => menuButton.activateAction("win.shortcuts", null));
        await waitFor(async () => expect((await screen.findAllByText("Search demos")).length).toBeGreaterThan(0));
        await closeVisibleDialog();

        const inspector = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation(() => {});
        await act(() => menuButton.activateAction("win.inspector", null));
        await waitFor(() => expect(inspector).toHaveBeenCalledWith(true));
    }, 180000);
});
