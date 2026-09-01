import type { NavigationState } from "@gtkx/navigation";
import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createNavigationContainerRef, NavigationContainer, StackActions } from "@gtkx/navigation";
import { act, render, screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    clickButton,
    createStateSpy,
    expectHidden,
    expectRouteNames,
    expectVisible,
    type Params,
    pressKeys,
    renderSplit,
    Split,
} from "./helpers/split-view-fixtures.js";

type GatedSplitProps = {
    hasLists: boolean;
    onStateChange: (state: NavigationState | undefined) => void;
};

const GatedSplit = ({ hasLists, onStateChange }: GatedSplitProps): ReactNode => (
    <NavigationContainer onStateChange={onStateChange}>
        <Split.Navigator>
            {hasLists ? <Split.Screen name="Lists" component={() => <GtkLabel>Lists Content</GtkLabel>} /> : null}
            <Split.Screen name="Tasks" component={() => <GtkLabel>Tasks Content</GtkLabel>} />
        </Split.Navigator>
    </NavigationContainer>
);

describe("split view - router", () => {
    it("keeps the sidebar at the root when a replace targets the first content route", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Replace with task");
        await screen.findByText("Task 9");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists", "Task"]);
    });

    it("puts the sidebar back when a replace targets the sidebar route itself", async () => {
        const ref = createNavigationContainerRef<Params>();
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange, ref } });
        await screen.findByText("Nothing Selected");

        await act(() => {
            ref.dispatch(StackActions.replace("Task", { id: "4" }));
        });

        await screen.findByText("Task 4");
        expectHidden("Nothing Selected");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists", "Task"]);
    });

    it("keeps the sidebar usable after a reset that omits it", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await clickButton("Reset to task");
        await screen.findByText("Task 3");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists", "Task"]);
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        await clickButton("Open work");
        await screen.findByText("Tasks work");
        expectRouteNames(onStateChange, ["Lists", "Tasks"]);
    });

    it("leaves only the sidebar on the stack after popToTop", async () => {
        const ref = createNavigationContainerRef<Params>();
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange, ref } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");

        await act(() => {
            ref.dispatch(StackActions.popToTop());
        });

        await screen.findByText("Nothing Selected");
        expectHidden("Task 7");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists"]);
    });

    it("ignores goBack and Escape while only the sidebar is on the stack", async () => {
        const ref = createNavigationContainerRef<Params>();
        const onUnhandledAction = vi.fn();
        await renderSplit({ container: { onUnhandledAction, ref } });
        await screen.findByText("Nothing Selected");
        expect(ref.canGoBack()).toBe(false);
        await pressKeys("Nothing Selected", "{Escape}");

        await act(() => {
            ref.goBack();
        });

        expectVisible("Nothing Selected");
        expectVisible("Lists Content");
        expect(onUnhandledAction).toHaveBeenCalledTimes(1);
    });

    it("restores the sidebar under an initialState that omits it", async () => {
        const onStateChange = createStateSpy();
        const initialState = { index: 0, routes: [{ name: "Task", params: { id: "3" } }] };
        await renderSplit({ container: { initialState, onStateChange } });
        await screen.findByText("Task 3");
        expectVisible("Lists Content");
        expectHidden("Nothing Selected");
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists"]);
    });

    it("takes a new sidebar route when the first screen is swapped out", async () => {
        const onStateChange = createStateSpy();
        const { rerender } = await render(<GatedSplit hasLists onStateChange={onStateChange} />);
        await screen.findByText("Lists Content");
        await rerender(<GatedSplit hasLists={false} onStateChange={onStateChange} />);
        await screen.findByText("Tasks Content");
        expectHidden("Lists Content");
        expectRouteNames(onStateChange, ["Tasks"]);
    });
});
