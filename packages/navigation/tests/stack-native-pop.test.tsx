import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventSpy,
    createPreventSpy,
    createStateSpy,
    expectHidden,
    expectRouteNames,
    expectVisible,
    getNavigationView,
    popToPage,
    renderStack,
} from "./helpers/stack-fixtures.js";

describe("stack - native pop (1)", () => {
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
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        onEvent.mockClear();
        await clickButton("Back");

        await waitFor(() => {
            expect(onEvent.mock.calls.flat()).toContainEqual({
                type: "transitionEnd",
                route: "Details",
                isClosing: true,
            });
        });
    });

    it("reports the transition of a page popped from a screen", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        onEvent.mockClear();
        await clickButton("Go back");

        await waitFor(() => {
            expect(onEvent.mock.calls.flat()).toContainEqual({
                type: "transitionEnd",
                route: "Details",
                isClosing: true,
            });
        });
    });
});

describe("stack - native pop (2)", () => {
    it("keeps the page when the prevent callback changes the route params", async () => {
        const onPrevent = createPreventSpy();
        const onStateChange = createStateSpy();
        await renderStack({ isAnimated: true, spies: { onPrevent }, container: { onStateChange } });
        await clickButton("Go to draft");
        await screen.findByText("Draft empty");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Draft unsaved");
        });

        expect(onPrevent).toHaveBeenCalledTimes(1);
        expectRouteNames(onStateChange, ["Home", "Draft"]);
    });

    it("restores the pages when a multi-page pop is prevented", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Push compose");
        await screen.findByText("Compose Content");
        const view = getNavigationView("Compose Content");
        await popToPage(view, 0);

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectRouteNames(onStateChange, ["Home", "Details", "Compose"]);
    });

    it("follows the stack when the user pops several pages at once", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Push details");
        await screen.findByText("Details 2");
        const view = getNavigationView("Details 2");
        await popToPage(view, 0);

        await waitFor(() => {
            expectVisible("Home Content");
        });

        expectRouteNames(onStateChange, ["Home"]);
    });
});
