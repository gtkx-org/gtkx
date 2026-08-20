import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, type RenderResult, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { demos } from "../src/demos/index.js";

const renderApp = createAppRenderer();

function createAppRenderer(): () => Promise<RenderResult> {
    let counter = 0;

    return async () => {
        const applicationId = `org.gtkx.animationsapp${String(counter)}`;
        counter += 1;

        return await render(<App applicationId={applicationId} />, { container: rootElement });
    };
}

describe("App", () => {
    it("renders the main window titled 'GTKX Animations'", async () => {
        await renderApp();

        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "GTKX Animations",
            as: Gtk.ApplicationWindow,
        });

        expect(window).toBeRooted();
        expect(window.getApplication()?.getApplicationId()).toMatch(/^org\.gtkx\.animationsapp\d+$/);
    });

    it("lists every demo in the sidebar", async () => {
        await renderApp();
        const sidebar = await screen.findByName("sidebar", { as: Gtk.StackSidebar });

        for (const { title } of demos) {
            expect(sidebar).toContainOneByText(title);
        }
    });

    it("shows the first demo page's content", async () => {
        await renderApp();
        const card = await screen.findByName("springs-label", { as: Gtk.Label });
        expect(card).toBeVisible();
        expect(await screen.findByName("springs-toggle", { as: Gtk.ToggleButton })).toBeVisible();
    });
});
