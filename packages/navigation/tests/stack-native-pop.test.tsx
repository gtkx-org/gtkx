import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventLog,
    createPreventLog,
    createStateLog,
    expectHidden,
    expectRouteNames,
    expectVisible,
    getNavigationView,
    popToPage,
    renderStack,
} from "./helpers/stack-fixtures.js";

describe("stack - native pop", () => {
    it("animates the page out instead of dropping it when Back is clicked", async () => {
        await renderStack({ isAnimated: true });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Back");
        expectVisible("Details 1");

        await waitFor(() => {
            expectHidden("Details 1");
        });

        expectVisible("Home Content");
    });

    it("reports the transition of the page it pops", async () => {
        const eventLog = createEventLog();
        await renderStack({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        eventLog.events.length = 0;
        await clickButton("Back");

        await waitFor(() => {
            expect(eventLog.events).toContainEqual({
                type: "transitionEnd",
                route: "Details",
                isClosing: true,
            });
        });
    });

    it("reports the transition of a page popped from a screen", async () => {
        const eventLog = createEventLog();
        await renderStack({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        eventLog.events.length = 0;
        await clickButton("Go back");

        await waitFor(() => {
            expect(eventLog.events).toContainEqual({
                type: "transitionEnd",
                route: "Details",
                isClosing: true,
            });
        });
    });

    it("keeps the page when the prevent callback changes the route params", async () => {
        const preventLog = createPreventLog();
        const stateLog = createStateLog();
        await renderStack({
            isAnimated: true,
            callbacks: { onPrevent: preventLog.record },
            container: { onStateChange: stateLog.record },
        });
        await clickButton("Go to draft");
        await screen.findByText("Draft empty");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Draft unsaved");
        });

        expect(preventLog.actions).toHaveLength(1);
        expectRouteNames(stateLog, ["Home", "Draft"]);
    });

    it("restores the pages when a multi-page pop is prevented", async () => {
        const stateLog = createStateLog();
        await renderStack({ container: { onStateChange: stateLog.record } });
        await clickButton("Go to details");
        await clickButton("Push compose");
        await screen.findByText("Compose Content");
        const view = getNavigationView("Compose Content");
        await popToPage(view, 0);

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectRouteNames(stateLog, ["Home", "Details", "Compose"]);
    });

    it("follows the stack when the user pops several pages at once", async () => {
        const stateLog = createStateLog();
        await renderStack({ container: { onStateChange: stateLog.record } });
        await clickButton("Go to details");
        await clickButton("Push details");
        await screen.findByText("Details 2");
        const view = getNavigationView("Details 2");
        await popToPage(view, 0);

        await waitFor(() => {
            expectVisible("Home Content");
        });

        expectRouteNames(stateLog, ["Home"]);
    });
});
