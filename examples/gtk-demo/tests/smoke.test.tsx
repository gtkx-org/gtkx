import * as Gtk from "@gtkx/gi/gtk";
import { configure, fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterEach, beforeAll, describe, expect, it, type MockInstance, vi } from "vitest";
import { parseTitle } from "../src/context/demo-context.js";
import { demos } from "../src/demos/index.js";
import { createAppRenderer } from "./render-app.js";
import { findButton, findWidget } from "./test-utils.js";

type PrintOperationRunSpy = MockInstance<Gtk.PrintOperation["run"]>;

type DialogHooks = {
    printRun: PrintOperationRunSpy;
    pageSetup: ReturnType<typeof vi.fn>;
};

type DemoTally = {
    windowDemosRun: number;
    dialogDemosRun: Set<string>;
};

type DemoSweep = {
    sidebar: Gtk.ListView;
    mainWindow: Gtk.ApplicationWindow;
    hooks: DialogHooks;
    dialogTitles: Set<string>;
    tally: DemoTally;
};

const renderApp = createAppRenderer("org.gtkx.gtkdemoe2e");

const toplevelWindows = async (): Promise<Gtk.Window[]> =>
    await screen.findAllByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });

const demoWindows = (): Gtk.Window[] => screen.queryAllByName("demo-window", { as: Gtk.Window });

const requireOnlyDemoWindow = (windows: Gtk.Window[], title: string): Gtk.Window => {
    const [win, ...rest] = windows;

    if (!win || rest.length > 0) {
        throw new Error(`expected exactly one demo window for "${title}", found ${String(windows.length)}`);
    }

    return win;
};

const getActionName = (widget: Gtk.Widget): string | null => {
    const getter: unknown = Reflect.get(widget, "getActionName");

    if (typeof getter !== "function") {
        return null;
    }

    return (getter as () => string | null).call(widget) ?? null;
};

const readWindowTitle = (window: Gtk.Window): string => window.getTitle() ?? "";

const submitPasswordDemo = async (window: Gtk.Window, passwordEntry: Gtk.Widget): Promise<void> => {
    const bound = within(window);
    await userEvent.type(passwordEntry, "hunter2");
    await userEvent.type((await bound.findByName("confirm-entry")), "hunter2");
    const done = await bound.findByRole(Gtk.AccessibleRole.BUTTON, { name: /Done/ });
    await userEvent.click(done);
};

const closeDemoWindow = async (window: Gtk.Window): Promise<void> => {
    const passwordEntry = within(window).queryByName("password-entry");

    if (passwordEntry) {
        await submitPasswordDemo(window, passwordEntry);

        return;
    }

    const closeButton = findWidget(window, Gtk.Widget, (w) => getActionName(w) === "window.close");

    if (closeButton) {
        await userEvent.click(closeButton);

        return;
    }

    await fireEvent(window, "close-request");
};

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

const waitForDemoWindows = async (title: string, expected: number, phase: string): Promise<void> => {
    await waitFor(() => {
        expect(demoWindows().length, `demo "${title}" ${phase}`).toBe(expected);
    });
};

const exerciseWindowDemo = async (title: string, run: Gtk.Button, mainWindow: Gtk.ApplicationWindow): Promise<void> => {
    await userEvent.click(run);
    await waitForDemoWindows(title, 1, "did not open a window");
    const win = requireOnlyDemoWindow(demoWindows(), title);

    await waitFor(() => {
        expect(win, `demo "${title}" window is not visible`).toBeVisible();
    });

    await waitFor(() => {
        expect(win.isActive(), `demo "${title}" window is not in the foreground`).toBe(true);
    });

    expect(win.getChild(), `demo "${title}" opened an empty window with no content`).not.toBeNull();
    await closeDemoWindow(win);
    await waitForDemoWindows(title, 0, "window did not close");
    expect(mainWindow, `closing demo "${title}" tore down the main window`).toBeVisible();
};

const exerciseErrorStatesDialog = async (): Promise<void> => {
    const dialog = await screen.findByRole(Gtk.AccessibleRole.DIALOG);
    const bound = within(dialog);
    await bound.findByRole(Gtk.AccessibleRole.SWITCH);
    expect(await bound.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveLength(2);
    await dismissDialog(dialog);
};

const exerciseDialogDemo = async (title: string, run: Gtk.Button, hooks: DialogHooks): Promise<void> => {
    const windowsBefore = await toplevelWindows();
    const baseline = windowsBefore.length;
    await userEvent.click(run);

    if (title === "Error States") {
        await exerciseErrorStatesDialog();

        return;
    }

    const spy = title === "Printing" ? hooks.printRun : hooks.pageSetup;

    await waitFor(() => {
        expect(spy, `"${title}" did not trigger its dialog`).toHaveBeenCalled();
    });

    const windowsAfter = await toplevelWindows();
    expect(windowsAfter.length, `"${title}" leaked a top-level window`).toBe(baseline);
};

const openMenuItem = async (menuButton: Gtk.MenuButton, name: string): Promise<void> => {
    await userEvent.click(menuButton);
    const item = await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name });
    await userEvent.click(item);
};

function emitPrintDone(printRun: PrintOperationRunSpy): Gtk.PrintOperationResult {
    const operation = printRun.mock.contexts.at(-1);

    if (operation instanceof Gtk.PrintOperation) {
        operation.emit("done", Gtk.PrintOperationResult.APPLY);
    }

    return Gtk.PrintOperationResult.APPLY;
}

function stubPrintOperationRun(): PrintOperationRunSpy {
    const printRun = vi.spyOn(Gtk.PrintOperation.prototype, "run");
    printRun.mockImplementation(() => emitPrintDone(printRun));

    return printRun;
}

function stubPageSetupDialog(): ReturnType<typeof vi.fn> {
    return vi
        .spyOn(Gtk, "printRunPageSetupDialogAsync")
        .mockImplementation((_parent, _pageSetup, _settings, done) => {
            done(new Gtk.PageSetup());
        });
}

function dialogOnlyTitles(): Set<string> {
    return new Set(demos.filter((d) => d.isDialogOnly).map((d) => parseTitle(d.title).displayTitle));
}

function countWindowDemos(): number {
    return demos.filter((d) => d.component && !d.isDialogOnly).length;
}

const exerciseSearchBar = async (model: Gtk.SelectionModel): Promise<void> => {
    const searchToggle = await screen.findByName("search-toggle", { as: Gtk.ToggleButton });
    const searchBar = await screen.findByName("sidebar-search-bar", { as: Gtk.SearchBar });
    const fullCount = model.getNItems();
    expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
    await userEvent.click(searchToggle);

    await waitFor(() => {
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
    });

    const searchEntry = await within(searchBar).findByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });
    await userEvent.type(searchEntry, "css");

    await waitFor(() => {
        expect(model.getNItems()).toBeLessThan(fullCount);
    });

    expect(model.getNItems()).toBeGreaterThan(0);
    await userEvent.clear(searchEntry);

    await waitFor(() => {
        expect(model).toHaveObjectProperty("nItems", fullCount);
    });

    await userEvent.click(searchToggle);

    await waitFor(() => {
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
    });
};

const exerciseDemoAtRow = async (sweep: DemoSweep, position: number, previousTitle: string): Promise<string> => {
    await userEvent.selectOptions(sweep.sidebar, position);
    const title = readWindowTitle(sweep.mainWindow);

    if (title === previousTitle) {
        return previousTitle;
    }

    const run = await findButton("Run");

    if (!run.getSensitive()) {
        return title;
    }

    if (sweep.dialogTitles.has(title)) {
        await exerciseDialogDemo(title, run, sweep.hooks);
        sweep.tally.dialogDemosRun.add(title);

        return title;
    }

    await exerciseWindowDemo(title, run, sweep.mainWindow);
    sweep.tally.windowDemosRun += 1;

    return title;
};

const exerciseEveryDemo = async (sweep: DemoSweep, model: Gtk.SelectionModel): Promise<void> => {
    const rowCount = model.getNItems();
    let previousTitle = readWindowTitle(sweep.mainWindow);

    for (let position = 0; position < rowCount; position++) {
        previousTitle = await exerciseDemoAtRow(sweep, position, previousTitle);
    }
};

const exerciseMainMenu = async (): Promise<void> => {
    const menuButton = await screen.findByName("menu-button", { as: Gtk.MenuButton });
    await openMenuItem(menuButton, "About GTK Demo");
    await dismissDialog(await screen.findByRole(Gtk.AccessibleRole.DIALOG));
    await openMenuItem(menuButton, "Keyboard Shortcuts Ctrl+?");
    const [shortcutLabel] = await screen.findAllByText("Search demos");
    expect(shortcutLabel).toBeRooted();
    await dismissDialog(await screen.findByRole(Gtk.AccessibleRole.DIALOG));
    const inspector = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation((): void => undefined);
    await openMenuItem(menuButton, "Inspector Shift+Ctrl+I");

    await waitFor(() => {
        expect(inspector).toHaveBeenCalledWith(true);
    });
};

describe("gtk-demo end-to-end", () => {
    beforeAll(() => {
        configure({ asyncUtilTimeout: 20_000 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("opens every demo, exercises the search bar, and invokes each main menu action", async () => {
        const hooks: DialogHooks = { printRun: stubPrintOperationRun(), pageSetup: stubPageSetupDialog() };
        await renderApp();
        const mainWindow = await screen.findByName("main-window", { as: Gtk.ApplicationWindow });
        const sidebar = await screen.findByName("sidebar-list", { as: Gtk.ListView });
        const model = sidebar.getModel() as Gtk.SelectionModel;
        await exerciseSearchBar(model);
        const dialogTitles = dialogOnlyTitles();
        const expectedWindowDemos = countWindowDemos();
        const tally: DemoTally = { windowDemosRun: 0, dialogDemosRun: new Set() };
        await exerciseEveryDemo({ sidebar, mainWindow, hooks, dialogTitles, tally }, model);
        expect(tally.windowDemosRun, "not every window demo was exercised").toBe(expectedWindowDemos);
        expect(tally.dialogDemosRun).toEqual(dialogTitles);
        await exerciseMainMenu();
    }, 180_000);
});
