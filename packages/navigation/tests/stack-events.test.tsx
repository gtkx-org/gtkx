import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventSpy,
    createPreventSpy,
    expectHidden,
    expectVisible,
    pressKeys,
    renderStack,
    type StackEvent,
} from "./helpers/stack-fixtures.js";

const getEvents = (onEvent: ReturnType<typeof createEventSpy>): StackEvent[] =>
    onEvent.mock.calls.map(([event]) => event);

describe("stack - events (1)", () => {
    it("emits transition events to the outgoing page and ends the incoming one", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        onEvent.mockClear();
        await clickButton("Go to details");
        await screen.findByText("Details 1");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        const events = getEvents(onEvent);
        expect(events).toContainEqual({ type: "transitionStart", route: "Home", isClosing: true });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Home", isClosing: true });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: false });
    });

    it("emits transitionStart with closing false to the incoming page", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        expect(getEvents(onEvent)).toContainEqual({ type: "transitionStart", route: "Details", isClosing: false });
    });

    it("removes the popped page after the transition", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        onEvent.mockClear();
        await clickButton("Back");
        await screen.findByText("Home Content");

        await waitFor(() => {
            expectHidden("Details 1");
        });

        expect(getEvents(onEvent)).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: true });
    });
});

describe("stack - events (2)", () => {
    it("emits focus and blur on push and pop", async () => {
        const onEvent = createEventSpy();
        await renderStack({ spies: { onEvent } });
        onEvent.mockClear();
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
        const focusEvents = getEvents(onEvent).filter(({ type }) => type === "focus" || type === "blur");

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
        const onPrevent = createPreventSpy();
        await renderStack({ spies: { onPrevent } });
        await clickButton("Go to compose");
        await screen.findByText("Compose Content");
        await clickButton("Back");
        await screen.findByText("Compose Content");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
        expect(onPrevent.mock.calls[0]?.[0].action.type).toBe("POP");
    });
});

describe("stack - events (3)", () => {
    it("keeps the page visible when usePreventRemove prevents Escape", async () => {
        const onPrevent = createPreventSpy();
        await renderStack({ spies: { onPrevent } });
        await clickButton("Go to compose");
        await pressKeys("Compose Content", "{Escape}");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
    });

    it("pops once the prevented action is dispatched again", async () => {
        const onPrevent = createPreventSpy();
        await renderStack({ spies: { onPrevent } });
        await clickButton("Go to compose");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        await clickButton("Discard");
        await screen.findByText("Home Content");
        expectHidden("Compose Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
    });
});
