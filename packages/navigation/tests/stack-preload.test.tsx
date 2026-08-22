import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventSpy,
    createStateSpy,
    expectHidden,
    expectRouteNames,
    getPreloadedKeys,
    getRouteKeys,
    renderStack,
    type StackEvent,
} from "./helpers/stack-fixtures.js";

const getEvents = (onEvent: ReturnType<typeof createEventSpy>): StackEvent[] =>
    onEvent.mock.calls.map(([event]) => event);

describe("stack - preload", () => {
    it("shows a preloaded page on navigate", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Preload details");
        expectHidden("Details 7");
        const preloadedKey = getPreloadedKeys(onStateChange.mock.lastCall?.[0])[0];
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expectRouteNames(onStateChange, ["Home", "Details"]);
        expect(getRouteKeys(onStateChange.mock.lastCall?.[0])[1]).toBe(preloadedKey);
    });

    it("emits transition events to a preloaded page when it is pushed", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Preload details");
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        const events = getEvents(onEvent);
        expect(events).toContainEqual({ type: "transitionStart", route: "Details", isClosing: false });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: false });
    });
});
