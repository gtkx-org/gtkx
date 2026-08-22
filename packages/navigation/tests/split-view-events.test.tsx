import type { Mock } from "vitest";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventSpy,
    createPreventSpy,
    expectHidden,
    expectVisible,
    pressKeys,
    renderSplit,
    type SplitEvent,
} from "./helpers/split-view-fixtures.js";

const getEvents = (onEvent: Mock<(event: SplitEvent) => void>): SplitEvent[] =>
    onEvent.mock.calls.map(([event]) => event);

describe("split view - events (1)", () => {
    it("reports no transition when the first content route fills an empty pane", async () => {
        const onEvent = createEventSpy();
        await renderSplit({ isAnimated: true, spies: { onEvent } });
        await screen.findByText("Lists Content");
        onEvent.mockClear();
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expect(getEvents(onEvent)).toEqual([]);
    });

    it("emits transition events for both routes when navigating between content routes", async () => {
        const onEvent = createEventSpy();
        await renderSplit({ isAnimated: true, spies: { onEvent } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        onEvent.mockClear();
        await clickButton("Open task");
        await screen.findByText("Task 7");

        await waitFor(() => {
            expectHidden("Tasks personal");
        });

        const events = getEvents(onEvent);
        expect(events).toContainEqual({ type: "transitionEnd", route: "Task", isClosing: false });
        expect(events).toContainEqual({ type: "transitionStart", route: "Tasks", isClosing: true });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Tasks", isClosing: true });
    });

    it("emits closing events to the route popped from the content stack", async () => {
        const onEvent = createEventSpy();
        await renderSplit({ isAnimated: true, spies: { onEvent } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        onEvent.mockClear();
        await clickButton("Back");
        await screen.findByText("Tasks personal");

        await waitFor(() => {
            expect(getEvents(onEvent)).toContainEqual({ type: "transitionEnd", route: "Task", isClosing: true });
        });

        expect(getEvents(onEvent)).toContainEqual({ type: "transitionStart", route: "Task", isClosing: true });
    });
});

describe("split view - events (2)", () => {
    it("keeps the content page when usePreventRemove prevents a collapsed Back press", async () => {
        const onPrevent = createPreventSpy();
        await renderSplit({ navigator: { collapsed: true }, spies: { onPrevent } });
        await clickButton("Open draft");
        await screen.findByText("Draft Content");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Draft Content");
        });

        expectHidden("Lists Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
    });

    it("keeps the content page when usePreventRemove prevents a collapsed Escape press", async () => {
        const onPrevent = createPreventSpy();
        await renderSplit({ navigator: { collapsed: true }, spies: { onPrevent } });
        await clickButton("Open draft");
        await pressKeys("Draft Content", "{Escape}");

        await waitFor(() => {
            expectVisible("Draft Content");
        });

        expectHidden("Lists Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
    });
});
