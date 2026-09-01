import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, type RenderResult, screen, userEvent, waitFor, within } from "@gtkx/testing";
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

    it("opens every demo from the sidebar", async () => {
        await renderApp();
        const sidebar = await screen.findByName("sidebar", { as: Gtk.StackSidebar });
        const stack = sidebar.getStack();

        if (!stack) {
            throw new Error("the sidebar has no stack");
        }

        for (const { id, title } of demos) {
            await userEvent.click(await within(sidebar).findByText(title));

            await waitFor(() => {
                expect(stack).toHaveObjectProperty("visibleChildName", id);
            });

            const page = stack.getVisibleChild();
            if (!page) {
                throw new Error(`the ${title} page is not visible`);
            }

            expect(await within(page).findByText(title)).toBeVisible();
        }
    });
});
