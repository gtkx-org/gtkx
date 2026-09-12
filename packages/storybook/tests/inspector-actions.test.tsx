import type { Meta } from "@gtkx/storybook";
import { action } from "@gtkx/storybook";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { EventFixture, showInspector } from "./fixtures/inspector.js";

const eventMeta = {
    title: "Events",
    component: EventFixture,
    args: { onEvent: action("Explicit event") },
    argTypes: { onConfigured: { action: "Configured event" } },
} satisfies Meta<typeof EventFixture>;

describe("native story actions", () => {
    it("records explicit actions and argTypes callbacks through native widget events", async () => {
        await showInspector({ default: eventMeta, Default: {} });
        await userEvent.click(screen.getByText("Trigger event"));
        await userEvent.click(screen.getByText("Trigger configured event"));

        expect(screen.getAllByName(/^storybook-action-/)).toHaveLength(2);
        expect(screen.getByName("storybook-action-0")).toHaveTextContent("Explicit event");
        expect(screen.getByName("storybook-action-1")).toHaveTextContent("Configured event");
        await userEvent.click(screen.getByText("Clear actions"));
        expect(screen.queryAllByName(/^storybook-action-/)).toHaveLength(0);
    });

    it("preserves the original event callback and its return value when recording an action", async () => {
        await showInspector({
            default: {
                ...eventMeta,
                args: { onEvent: () => "Callback invoked" },
                argTypes: { onEvent: { action: "Wrapped event" } },
            },
            Default: {},
        });
        await userEvent.click(screen.getByText("Trigger event"));

        expect(screen.getByName("inspector-result")).toHaveTextContent(/^Callback invoked$/);
        expect(screen.getAllByName(/^storybook-action-/)).toHaveLength(1);
    });

    it("formats native and circular payloads without disrupting the story", async () => {
        await showInspector({ default: eventMeta, Default: {} });
        await userEvent.click(screen.getByText("Send complex payload"));
        await userEvent.click(screen.getByText("Trigger event"));

        expect(screen.getAllByName(/^storybook-action-/)).toHaveLength(2);
        expect(screen.getByName("inspector-result")).toBeVisible();
        await userEvent.click(screen.getByText("Clear actions"));
        expect(screen.queryAllByName(/^storybook-action-/)).toHaveLength(0);
        await userEvent.click(screen.getByText("Trigger event"));
        expect(screen.getAllByName(/^storybook-action-/)).toHaveLength(1);
    });

    it("bounds history to the newest hundred events and clears it on reset and selection", async () => {
        await showInspector({ default: eventMeta, Default: {}, Alternate: {} });
        await userEvent.click(screen.getByText("Send event burst"));

        expect(screen.getAllByName(/^storybook-action-/)).toHaveLength(100);
        expect(screen.queryByName("storybook-action-0")).toBeNull();
        expect(screen.getByName("storybook-action-104")).toBeRooted();
        await userEvent.click(screen.getByText("Reset story"));
        expect(screen.queryAllByName(/^storybook-action-/)).toHaveLength(0);
        await userEvent.click(screen.getByText("Trigger event"));
        await userEvent.click(screen.getByName("storybook-story-events--alternate"));
        expect(screen.queryAllByName(/^storybook-action-/)).toHaveLength(0);
    });

    it.each([
        () => {
            throw new Error("Synchronous event failure");
        },
        () => Promise.reject(new Error("Asynchronous event failure")),
    ])("recovers through reset and selection after an event callback fails", async (onEvent) => {
        await showInspector({
            default: {
                ...eventMeta,
                args: { onEvent },
            },
            Default: {},
            Healthy: { args: { onEvent: () => "Healthy callback" } },
        });
        await userEvent.click(screen.getByText("Trigger event"));
        await waitFor(() => {
            expect(screen.queryByName("inspector-result")).toBeNull();
        });
        await userEvent.click(screen.getByText("Reset story"));
        expect(screen.getByName("inspector-result")).toBeVisible();
        await userEvent.click(screen.getByName("storybook-story-events--healthy"));
        await userEvent.click(screen.getByText("Trigger event"));
        expect(screen.getByName("inspector-result")).toHaveTextContent(/^Healthy callback$/);
    });

    it.each(["reset", "select"])("ignores an old pending callback after %s", async (operation) => {
        const pending = Promise.withResolvers<undefined>();
        await showInspector({
            default: { ...eventMeta, args: { onEvent: () => pending.promise } },
            Default: {},
            Healthy: { args: { onEvent: () => "Healthy callback" } },
        });
        await userEvent.click(screen.getByText("Trigger event"));

        if (operation === "reset") {
            await userEvent.click(screen.getByText("Reset story"));
        } else {
            await userEvent.click(screen.getByName("storybook-story-events--healthy"));
        }

        await act(() => {
            pending.reject(new Error("Old callback failure"));
        });

        expect(screen.getByName("inspector-result")).toBeVisible();
        expect(screen.queryAllByName(/^storybook-action-/)).toHaveLength(0);
        await userEvent.click(screen.getByName("storybook-story-events--healthy"));
        await userEvent.click(screen.getByText("Trigger event"));
        expect(screen.getByName("inspector-result")).toHaveTextContent(/^Healthy callback$/);
    });
});
