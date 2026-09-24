import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventLog,
    createPreventLog,
    expectHidden,
    expectVisible,
    pressKeys,
    renderStack,
} from "./helpers/stack-fixtures.js";

describe("stack - events", () => {
    it("emits transition events to the outgoing page and ends the incoming one", async () => {
        const eventLog = createEventLog();
        await renderStack({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        eventLog.events.length = 0;
        await clickButton("Go to details");
        await screen.findByText("Details 1");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        expect(eventLog.events).toContainEqual({ type: "transitionStart", route: "Home", isClosing: true });
        expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Home", isClosing: true });
        expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: false });
    });

    it("emits transitionStart with closing false to the incoming page", async () => {
        const eventLog = createEventLog();
        await renderStack({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        expect(eventLog.events).toContainEqual({ type: "transitionStart", route: "Details", isClosing: false });
    });

    it("removes the popped page after the transition", async () => {
        const eventLog = createEventLog();
        await renderStack({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        eventLog.events.length = 0;
        await clickButton("Back");
        await screen.findByText("Home Content");

        await waitFor(() => {
            expectHidden("Details 1");
        });

        expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: true });
    });

    it("emits focus and blur on push and pop", async () => {
        const eventLog = createEventLog();
        await renderStack({ callbacks: { onEvent: eventLog.record } });
        eventLog.events.length = 0;
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
        const focusEvents = eventLog.events.filter(({ type }) => type === "focus" || type === "blur");

        expect(focusEvents).toEqual([
            { type: "blur", route: "Home", isClosing: undefined },
            { type: "focus", route: "Details", isClosing: undefined },
            { type: "blur", route: "Details", isClosing: undefined },
            { type: "focus", route: "Home", isClosing: undefined },
        ]);
    });

    it("pushes without animating when animation is none", async () => {
        await renderStack({ isAnimated: true, details: { animation: "none" } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expectHidden("Home Content");
    });

    it("keeps the page visible when usePreventRemove prevents Back", async () => {
        const preventLog = createPreventLog();
        await renderStack({ callbacks: { onPrevent: preventLog.record } });
        await clickButton("Go to compose");
        await screen.findByText("Compose Content");
        await clickButton("Back");
        await screen.findByText("Compose Content");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
        expect(preventLog.actions).toHaveLength(1);
        expect(preventLog.actions[0]?.type).toBe("POP");
    });

    it("keeps the page visible when usePreventRemove prevents Escape", async () => {
        const preventLog = createPreventLog();
        await renderStack({ callbacks: { onPrevent: preventLog.record } });
        await clickButton("Go to compose");
        await pressKeys("Compose Content", "{Escape}");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
        expect(preventLog.actions).toHaveLength(1);
    });

    it("pops once the prevented action is dispatched again", async () => {
        const preventLog = createPreventLog();
        await renderStack({ callbacks: { onPrevent: preventLog.record } });
        await clickButton("Go to compose");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        await clickButton("Discard");
        await screen.findByText("Home Content");
        expectHidden("Compose Content");
        expect(preventLog.actions).toHaveLength(1);
    });

    it("pops without animating when animation is none", async () => {
        await renderStack({ isAnimated: true, details: { animation: "none" } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Push settings");
        await screen.findByText("Settings Content");
        await clickButton("Back");
        await screen.findByText("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });
});
