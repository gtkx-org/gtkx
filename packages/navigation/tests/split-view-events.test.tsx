import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventLog,
    createPreventLog,
    expectHidden,
    expectVisible,
    pressKeys,
    renderSplit,
} from "./helpers/split-view-fixtures.js";

describe("split view - events", () => {
    it("reports no transition when the first content route fills an empty pane", async () => {
        const eventLog = createEventLog();
        await renderSplit({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await screen.findByText("Lists Content");
        eventLog.events.length = 0;
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expect(eventLog.events).toEqual([]);
    });

    it("emits transition events for both routes when navigating between content routes", async () => {
        const eventLog = createEventLog();
        await renderSplit({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        eventLog.events.length = 0;
        await clickButton("Open task");
        await screen.findByText("Task 7");

        await waitFor(() => {
            expectHidden("Tasks personal");
        });

        expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Task", isClosing: false });
        expect(eventLog.events).toContainEqual({ type: "transitionStart", route: "Tasks", isClosing: true });
        expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Tasks", isClosing: true });
    });

    it("emits closing events to the route popped from the content stack", async () => {
        const eventLog = createEventLog();
        await renderSplit({ isAnimated: true, callbacks: { onEvent: eventLog.record } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        eventLog.events.length = 0;
        await clickButton("Back");
        await screen.findByText("Tasks personal");

        await waitFor(() => {
            expect(eventLog.events).toContainEqual({ type: "transitionEnd", route: "Task", isClosing: true });
        });

        expect(eventLog.events).toContainEqual({ type: "transitionStart", route: "Task", isClosing: true });
    });

    it("keeps the content page when usePreventRemove prevents a collapsed Back press", async () => {
        const preventLog = createPreventLog();
        await renderSplit({ navigator: { collapsed: true }, callbacks: { onPrevent: preventLog.record } });
        await clickButton("Open draft");
        await screen.findByText("Draft Content");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Draft Content");
        });

        expectHidden("Lists Content");
        expect(preventLog.actions).toHaveLength(1);
    });

    it("keeps the content page when usePreventRemove prevents a collapsed Escape press", async () => {
        const preventLog = createPreventLog();
        await renderSplit({ navigator: { collapsed: true }, callbacks: { onPrevent: preventLog.record } });
        await clickButton("Open draft");
        await pressKeys("Draft Content", "{Escape}");

        await waitFor(() => {
            expectVisible("Draft Content");
        });

        expectHidden("Lists Content");
        expect(preventLog.actions).toHaveLength(1);
    });
});
