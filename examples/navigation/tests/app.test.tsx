import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, type RenderResult, screen, userEvent } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";

const FIRST_SUBJECT = "Quarterly planning";
const renderApp = createAppRenderer();

function createAppRenderer(): () => Promise<RenderResult> {
    let counter = 0;

    return async () => {
        const applicationId = `org.gtkx.navigationapp${String(counter)}`;
        counter += 1;

        return await render(<App applicationId={applicationId} />, { container: rootElement });
    };
}

const openFirstMessage = async (): Promise<Gtk.Widget> => {
    await renderApp();
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: FIRST_SUBJECT }));

    return await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Reply" });
};

const openReply = async (): Promise<Gtk.Widget> => {
    await userEvent.click(await openFirstMessage());

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
};

describe("App", () => {
    it("renders the main window titled 'GTKX Navigation'", async () => {
        await renderApp();

        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "GTKX Navigation",
            as: Adw.ApplicationWindow,
        });

        expect(window).toBeRooted();
        expect(window.getApplication()?.getApplicationId()).toMatch(/^org\.gtkx\.navigationapp\d+$/);
    });

    it("lists the inbox messages on the first page", async () => {
        await renderApp();
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: FIRST_SUBJECT })).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" })).toBeNull();
    });
});

describe("Inbox", () => {
    it("opens a message with its id and goes back", async () => {
        const reply = await openFirstMessage();
        expect(reply).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: FIRST_SUBJECT })).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: FIRST_SUBJECT })).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Reply" })).toBeNull();
    });

    it("asks before discarding a typed reply and pops after Discard", async () => {
        const entry = await openReply();
        await userEvent.type(entry, "Sounds good");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Reply" })).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX)).toBeNull();
    });

    it("keeps the reply when the dialog is dismissed", async () => {
        const entry = await openReply();
        await userEvent.type(entry, "Sounds good");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Keep Editing" }));
        expect(await screen.findByDisplayValue("Sounds good")).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Reply" })).toBeNull();
    });

    it("pops without asking when the reply is empty", async () => {
        await openReply();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Reply" })).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Discard" })).toBeNull();
    });
});

describe("Sidebar", () => {
    it("hides and shows the sidebar from the toggle in a nested screen's header", async () => {
        await renderApp();
        expect(await screen.findByText("Settings")).toBeVisible();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Toggle Sidebar" }));
        expect(screen.queryByText("Settings")).toBeNull();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Toggle Sidebar" }));
        expect(await screen.findByText("Settings")).toBeVisible();
    });
});

describe("Settings", () => {
    beforeEach(async () => {
        await act(() => {
            Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.FORCE_LIGHT);
        });
    });

    afterEach(async () => {
        await act(() => {
            Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.DEFAULT);
        });
    });

    it("switches to settings from the sidebar and opens the Appearance tab", async () => {
        await renderApp();
        await userEvent.click(await screen.findByText("Settings"));
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "About this app" })).toBeVisible();
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Appearance" }));
        expect(await screen.findByText("useTheme().dark is false")).toBeVisible();
        expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: FIRST_SUBJECT })).toBeNull();
    });

    it("follows the color scheme from the dark mode switch", async () => {
        await renderApp();
        await userEvent.click(await screen.findByText("Settings"));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Appearance" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.SWITCH, { name: "Dark mode" }));
        expect(await screen.findByText("useTheme().dark is true")).toBeVisible();
    });
});
