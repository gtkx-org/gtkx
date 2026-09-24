import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventLog,
    createStateLog,
    expectHidden,
    expectRouteNames,
    getPreloadedKeys,
    getRouteKeys,
    renderStack,
} from "./helpers/stack-fixtures.js";

describe("stack - preload", () => {
    it("shows a preloaded page on navigate", async () => {
        const stateLog = createStateLog();
        await renderStack({ container: { onStateChange: stateLog.record } });
        await clickButton("Preload details");
        expectHidden("Details 7");
        const preloadedKey = getPreloadedKeys(stateLog.states.at(-1))[0];
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expectRouteNames(stateLog, ["Home", "Details"]);
        expect(getRouteKeys(stateLog.states.at(-1))[1]).toBe(preloadedKey);
    });

    it("emits transition events to a preloaded page when it is pushed", async () => {
        const eventLog = createEventLog();
        await renderStack({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Preload details");
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        expect(eventLog.events).toContainEqual({ type: "transitionStart", route: "Details", isClosing: false });
        expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: false });
    });
});
