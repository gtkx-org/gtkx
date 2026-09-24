import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import logoResourcePath from "../data/icons/org.gtk.Demo4.svg?resource";
import { expectInspectorOpened } from "./native-dialogs.js";
import { createAppRenderer } from "./render-app.js";

const renderDemo = createAppRenderer("org.gtkx.gtkdemoint");

const renderMainWindowBody = async (): Promise<Gtk.Widget> => {
    await renderDemo();

    return await screen.findByName("main-window-body");
};

const expectDialogShown = async (): Promise<void> => {
    await waitFor(async () => {
        const [dialog] = await screen.findAllByRole(Gtk.AccessibleRole.DIALOG);
        expect(dialog).toBeVisible();
    });
};

const expectShortcutsDialogShown = async (): Promise<void> => {
    await expectDialogShown();
    const [shortcutLabel] = await screen.findAllByText("Search demos");
    expect(shortcutLabel).toBeRooted();
};

describe("App resources", () => {
    it("bundles the application icon into the GResource so AdwAboutDialog can resolve it", async () => {
        await renderDemo();
        const display = Gdk.Display.getDefault();
        expect(display, "no default display available").not.toBeNull();
        const logo = Gio.resourcesLookupData(logoResourcePath, Gio.ResourceLookupFlags.NONE).getData() ?? [];
        expect(Buffer.from(logo.slice(0, 64)).toString("utf8")).toContain("<svg");
    });
});

describe("App action accelerators", () => {
    it("opens the native Inspector when Ctrl+Shift+I is pressed", async () => {
        const body = await renderMainWindowBody();
        await expectInspectorOpened(async () => {
            await userEvent.keyboard(body, "{Control>}{Shift>}i{/Shift}{/Control}");
        });
        expect(screen.getByName("main-window")).toBeVisible();
    });

    it("opens the keyboard shortcuts dialog when Ctrl+? is pressed", async () => {
        const body = await renderMainWindowBody();
        await userEvent.keyboard(body, "{Control>}?{/Control}");
        await expectShortcutsDialogShown();
    });
});

describe("App global shortcuts", () => {
    it("toggles the search bar when Ctrl+F is pressed", async () => {
        const body = await renderMainWindowBody();
        const searchBar = await screen.findByName("sidebar-search-bar", { as: Gtk.SearchBar });
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
        await userEvent.keyboard(body, "{Control>}f{/Control}");

        await waitFor(() => {
            expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
        });
    });

    it("moves between pages from the header and keyboard", async () => {
        const body = await renderMainWindowBody();
        const info = await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Info" });
        const source = await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Source" });
        expect(info).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        await userEvent.click(source);
        await waitFor(() => {
            expect(source).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        });
        await userEvent.click(info);
        await waitFor(() => {
            expect(info).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        });
        await userEvent.keyboard(body, "{Control>}{PageDown}{/Control}");

        await waitFor(() => {
            expect(source).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        });

        await userEvent.keyboard(body, "{Control>}{PageUp}{/Control}");

        await waitFor(() => {
            expect(info).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        });
    });

    it("names shell navigation and icon-only controls", async () => {
        await renderDemo();
        expect(await screen.findByRole(Gtk.AccessibleRole.TAB_LIST, { name: "Demo pages" })).toBeVisible();
        expect(await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Search demos" })).toBeVisible();
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" })).toBeVisible();
    });
});
