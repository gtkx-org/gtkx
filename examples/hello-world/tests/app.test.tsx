import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";

describe("App", () => {
    it("increments the counter and quits when its window closes", async () => {
        await render(<App />, { container: rootElement });

        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "Hello GTKX",
            as: Adw.ApplicationWindow,
        });
        expect(
            await screen.findByRole(Gtk.AccessibleRole.HEADING, { name: "Welcome to GTKX!", level: 1 }),
        ).toBeVisible();
        expect(await screen.findByRole(Gtk.AccessibleRole.STATUS, { name: "Count: 0" })).toBeVisible();

        const increment = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" });
        await userEvent.click(increment);
        await userEvent.click(increment);
        expect(await screen.findByRole(Gtk.AccessibleRole.STATUS, { name: "Count: 2" })).toBeVisible();

        const application = window.getApplication();
        if (!application) {
            throw new Error("the window has no application");
        }

        let shutdownCount = 0;
        application.on("shutdown", () => {
            shutdownCount += 1;
        });

        await act(() => {
            window.close();
        });

        await waitFor(() => {
            expect(shutdownCount).toBe(1);
        });
    });
});
