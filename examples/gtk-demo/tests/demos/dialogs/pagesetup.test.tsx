import * as Gtk from "@gtkx/gi/gtk";
import { GtkPageSetup, GtkPrintSettings } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { createRef } from "react";
import { assert, describe, expect, it } from "vitest";
import { pageSetupDemo } from "../../../src/demos/dialogs/pagesetup.js";
import { findAddedWindow } from "../../native-dialogs.js";
import { createAppRenderer } from "../../render-app.js";
import { renderDemo } from "../../test-utils.js";

const renderApp = createAppRenderer("org.gtkx.pagesetupcallback");
const responses = ["Cancel", "Apply"];

describe("pageSetupDemo component lifecycle", () => {
    it.each(responses)("closes the native dialog and completes once after %s", async (response) => {
        let completions = 0;
        await renderDemo(pageSetupDemo, { onClose: () => {
            completions += 1;
        } });
        const parent = screen.getByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.ApplicationWindow });
        const dialog = await findAddedWindow(new Set([parent]));
        expect(dialog.getTransientFor()).toBe(parent);
        expect(completions).toBe(0);
        await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: response }));
        await waitFor(() => {
            expect(Gtk.Window.listToplevels()).not.toContain(dialog);
            expect(completions).toBe(1);
        });
        expect(parent).toBeVisible();
    });
});

describe.each([false, true])("PageSetup completion with initial setup %s", (hasInitialSetup) => {
    it.each(responses)("delivers the native result after %s", async (response) => {
        await renderApp();
        const settingsRef = createRef<Gtk.PrintSettings>();
        const setupRef = createRef<Gtk.PageSetup>();
        await render(
            <>
                <GtkPrintSettings ref={settingsRef} />
                {hasInitialSetup && <GtkPageSetup ref={setupRef} />}
            </>,
            { container: rootElement },
        );
        const settings = settingsRef.current;
        assert(settings !== null);
        const main = screen.getByName("main-window", { as: Gtk.Window });
        const initial = setupRef.current;
        expect(initial !== null).toBe(hasInitialSetup);
        const received: (Gtk.PageSetup | null)[] = [];
        const previous = new Set(Gtk.Window.listToplevels());
        await act(() => {
            Gtk.printRunPageSetupDialogAsync(main, initial, settings, (setup) => {
                received.push(setup);
            });
        });
        const dialog = await findAddedWindow(previous);
        expect(dialog.getTransientFor()).toBe(main);
        /* TODO: Restore ordinary orientation coverage once GTK stops initializing multiple controls as active.
         * https://github.com/gtkx-org/gtkx/issues/751
         */
        const reverseLandscape = within(dialog).getByRole(Gtk.AccessibleRole.RADIO, {
            name: "Reverse landscape", as: Gtk.CheckButton,
        });
        await userEvent.click(reverseLandscape);
        expect(reverseLandscape.getActive()).toBe(true);
        expect(received).toHaveLength(0);
        await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: response }));
        await waitFor(() => {
            expect(received).toHaveLength(1);
            expect(Gtk.Window.listToplevels()).not.toContain(dialog);
        });

        const orientations = received.map((setup) => setup === null ? null : setup.getOrientation());
        expect(orientations).toEqual([response === "Cancel" ? null : Gtk.PageOrientation.REVERSE_LANDSCAPE]);

        expect(main).toBeVisible();
    });
});
