import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import logoResourcePath from "../data/icons/org.gtk.Demo4.svg?resource";
import { createAppRenderer } from "./render-app.js";

const renderDemo = createAppRenderer("org.gtkx.gtkdemoint");

const renderMainWindowBody = async (): Promise<Gtk.Widget> => {
    await renderDemo();

    return await screen.findByName("main-window-body");
};

const findNotebook = async (): Promise<Gtk.Notebook> => await screen.findByName("notebook", { as: Gtk.Notebook });

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

const expectInteractiveDebugging = async (activate: () => Promise<void>): Promise<void> => {
    const debugSpy = vi.spyOn(Gtk.Window, "setInteractiveDebugging").mockImplementation((): void => undefined);

    try {
        await activate();

        await waitFor(() => {
            expect(debugSpy).toHaveBeenCalledWith(true);
        });
    } finally {
        debugSpy.mockRestore();
    }
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
    it("activates Gtk.Window.setInteractiveDebugging when Ctrl+Shift+I is pressed", async () => {
        await expectInteractiveDebugging(async () => {
            const body = await renderMainWindowBody();
            await userEvent.keyboard(body, "{Control>}{Shift>}i{/Shift}{/Control}");
        });
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

    it("moves between notebook pages with Ctrl+Page_Down and Ctrl+Page_Up", async () => {
        const body = await renderMainWindowBody();
        const notebook = await findNotebook();
        await userEvent.keyboard(body, "{Control>}{PageDown}{/Control}");

        await waitFor(() => {
            expect(notebook).toHaveObjectProperty("page", 1);
        });

        await userEvent.keyboard(body, "{Control>}{PageUp}{/Control}");

        await waitFor(() => {
            expect(notebook).toHaveObjectProperty("page", 0);
        });
    });
});
