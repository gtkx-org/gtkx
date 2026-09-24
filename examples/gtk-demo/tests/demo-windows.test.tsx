import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { assert, expect, it } from "vitest";
import { createAppRenderer } from "./render-app.js";

const renderApp = createAppRenderer("org.gtkx.demowindows");

const selectDemo = async (title: string): Promise<void> => {
    const searchBar = screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar });
    const search = within(searchBar).getByRole(Gtk.AccessibleRole.SEARCH_BOX);
    await userEvent.clear(search);
    await userEvent.type(search, title);
    const sidebar = screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
    await userEvent.click(await within(sidebar).findByText(title));
    expect(screen.getByName("main-window", { as: Gtk.Window }).getTitle()).toBe(title);
};

const openSelectedDemo = async (): Promise<Gtk.Window> => {
    const previous = new Set(screen.queryAllByName("demo-window", { as: Gtk.Window }));
    const mainWindow = screen.getByName("main-window", { as: Gtk.Window });
    await userEvent.click(within(mainWindow).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" }));

    return await waitFor(() => {
        const added = screen.getAllByName("demo-window", { as: Gtk.Window }).filter((window) => !previous.has(window));
        expect(added).toHaveLength(1);
        const [window] = added;
        assert(window !== undefined);

        return window;
    });
};

const activeEntry = (window: Gtk.Window): Gtk.Entry => {
    const entry = within(window).getAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry })
        .find((candidate) => candidate.isSensitive());
    assert(entry !== undefined);

    return entry;
};

it("keeps open demo contents and state while selecting and opening other demos", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Search demos" }));
    await selectDemo("Spinner");
    const spinnerWindow = await openSelectedDemo();
    const entry = activeEntry(spinnerWindow);
    await userEvent.type(entry, "Retained draft");
    await userEvent.click(within(spinnerWindow).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Stop" }));
    const spinners = within(spinnerWindow).getAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
    expect(spinners).toHaveLength(2);

    await selectDemo("Expander");
    expect(spinnerWindow.getTitle()).toBe("Spinner");
    expect(activeEntry(spinnerWindow)).toBe(entry);
    expect(entry).toHaveDisplayValue("Retained draft");
    const expanderWindow = await openSelectedDemo();
    expect(expanderWindow).not.toBe(spinnerWindow);
    expect(expanderWindow.getTitle()).toBe("Expander");
    const expander = within(expanderWindow).getByName("expander", { as: Gtk.Expander });
    await userEvent.click(expander);
    expect(expander.getExpanded()).toBe(true);

    await selectDemo("GTK Demo");
    const mainWindow = screen.getByName("main-window", { as: Gtk.Window });
    expect(within(mainWindow).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })).toBeDisabled();
    expect(screen.getAllByName("demo-window")).toHaveLength(2);
    expect(activeEntry(spinnerWindow)).toBe(entry);
    expect(within(expanderWindow).getByName("expander")).toBe(expander);
    expect(expander.getExpanded()).toBe(true);
    expect(within(spinnerWindow).getAllByRole(Gtk.AccessibleRole.PROGRESS_BAR)).toEqual(spinners);
    expect(spinners.every((spinner) => !spinner.getSpinning())).toBe(true);
});

it("gives repeated password demos independent default buttons and close actions", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Search demos" }));
    await selectDemo("Password Entry");
    const first = await openSelectedDemo();
    const firstDone = within(first).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Done" });
    expect(first.getDefaultWidget()).toBe(firstDone);
    const second = await openSelectedDemo();
    const secondDone = within(second).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Done" });
    expect(secondDone).not.toBe(firstDone);
    expect(first.getDefaultWidget()).toBe(firstDone);
    expect(second.getDefaultWidget()).toBe(secondDone);
    expect(firstDone).toBeDisabled();
    expect(secondDone).toBeDisabled();

    await userEvent.type(within(first).getByName("password-entry"), "first password");
    const firstConfirmation = within(first).getByName("confirm-entry");
    await userEvent.type(firstConfirmation, "different password");
    expect(firstDone).toBeDisabled();
    await userEvent.clear(firstConfirmation);
    await userEvent.type(firstConfirmation, "first password");
    expect(firstDone).toBeEnabled();
    expect(secondDone).toBeDisabled();
    await userEvent.keyboard(firstConfirmation, "{Enter}");
    await waitFor(() => {
        expect(screen.getByName("demo-window")).toBe(second);
    });
    expect(second.getDefaultWidget()).toBe(secondDone);

    await userEvent.type(within(second).getByName("password-entry"), "second password");
    const secondConfirmation = within(second).getByName("confirm-entry");
    await userEvent.type(secondConfirmation, "second password");
    expect(secondDone).toBeEnabled();
    await userEvent.keyboard(secondConfirmation, "{Enter}");
    await waitFor(() => {
        expect(screen.queryAllByName("demo-window")).toHaveLength(0);
    });
    expect(screen.getByName("main-window")).toBeVisible();
});

it("clears a hidden search and opens a demo by double-clicking its row", async () => {
    await renderApp();
    const searchToggle = screen.getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
        name: "Search demos",
        as: Gtk.ToggleButton,
    });
    await userEvent.click(searchToggle);
    const searchBar = screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar });
    const search = within(searchBar).getByRole(Gtk.AccessibleRole.SEARCH_BOX);
    await userEvent.type(search, "Spinner");
    const sidebar = screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
    await waitFor(() => {
        expect(within(sidebar).queryByText("Themes")).toBeNull();
    });

    await userEvent.click(searchToggle);
    await waitFor(() => {
        expect(within(searchBar).queryByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeNull();
        expect(within(sidebar).getByText("Themes")).toBeVisible();
    });

    await userEvent.click(searchToggle);
    const reopenedSearch = within(searchBar).getByRole(Gtk.AccessibleRole.SEARCH_BOX);
    expect(reopenedSearch).toHaveDisplayValue("");
    await userEvent.type(reopenedSearch, "Spinner");
    await within(sidebar).findByText("Spinner");
    const spinnerRow = within(sidebar).getByRole(Gtk.AccessibleRole.LIST_ITEM);
    await userEvent.dblClick(spinnerRow);
    const window = await screen.findByName("demo-window", { as: Gtk.Window });
    expect(window).toHaveAccessibleName("Spinner");
});
