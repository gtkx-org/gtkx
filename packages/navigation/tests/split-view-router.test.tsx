import type { NavigationState } from "@gtkx/navigation";
import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createNavigationContainerRef, NavigationContainer, StackActions } from "@gtkx/navigation";
import { act, render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createStateLog,
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

const ListsContent = (): ReactNode => <GtkLabel>Lists Content</GtkLabel>;
const TasksContent = (): ReactNode => <GtkLabel>Tasks Content</GtkLabel>;

const GatedSplit = ({ hasLists, onStateChange }: GatedSplitProps): ReactNode => (
    <NavigationContainer onStateChange={onStateChange}>
        <Split.Navigator>
            {hasLists ? <Split.Screen name="Lists" component={ListsContent} /> : null}
            <Split.Screen name="Tasks" component={TasksContent} />
        </Split.Navigator>
    </NavigationContainer>
);

describe("split view - router", () => {
    it("keeps the sidebar at the root when a replace targets the first content route", async () => {
        const stateLog = createStateLog();
        await renderSplit({ container: { onStateChange: stateLog.record } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Replace with task");
        await screen.findByText("Task 9");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(stateLog, ["Lists", "Task"]);
    });

    it("puts the sidebar back when a replace targets the sidebar route itself", async () => {
        const ref = createNavigationContainerRef<Params>();
        const stateLog = createStateLog();
        await renderSplit({ container: { onStateChange: stateLog.record, ref } });
        await screen.findByText("Nothing Selected");

        await act(() => {
            ref.dispatch(StackActions.replace("Task", { id: "4" }));
        });

        await screen.findByText("Task 4");
        expectHidden("Nothing Selected");
        expectVisible("Lists Content");
        expectRouteNames(stateLog, ["Lists", "Task"]);
    });

    it("keeps the sidebar usable after a reset that omits it", async () => {
        const stateLog = createStateLog();
        await renderSplit({ container: { onStateChange: stateLog.record } });
        await clickButton("Open personal");
        await clickButton("Reset to task");
        await screen.findByText("Task 3");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(stateLog, ["Lists", "Task"]);
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        await clickButton("Open work");
        await screen.findByText("Tasks work");
        expectRouteNames(stateLog, ["Lists", "Tasks"]);
    });

    it("leaves only the sidebar on the stack after popToTop", async () => {
        const ref = createNavigationContainerRef<Params>();
        const stateLog = createStateLog();
        await renderSplit({ container: { onStateChange: stateLog.record, ref } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");

        await act(() => {
            ref.dispatch(StackActions.popToTop());
        });

        await screen.findByText("Nothing Selected");
        expectHidden("Task 7");
        expectVisible("Lists Content");
        expectRouteNames(stateLog, ["Lists"]);
    });

    it("ignores goBack and Escape while only the sidebar is on the stack", async () => {
        const ref = createNavigationContainerRef<Params>();
        let unhandledActions = 0;
        const onUnhandledAction = (): void => {
            unhandledActions += 1;
        };
        await renderSplit({ container: { onUnhandledAction, ref } });
        await screen.findByText("Nothing Selected");
        expect(ref.canGoBack()).toBe(false);
        await pressKeys("Nothing Selected", "{Escape}");

        await act(() => {
            ref.goBack();
        });

        expectVisible("Nothing Selected");
        expectVisible("Lists Content");
        expect(unhandledActions).toBe(1);
    });

    it("restores the sidebar under an initialState that omits it", async () => {
        const stateLog = createStateLog();
        const initialState = { index: 0, routes: [{ name: "Task", params: { id: "3" } }] };
        await renderSplit({ container: { initialState, onStateChange: stateLog.record } });
        await screen.findByText("Task 3");
        expectVisible("Lists Content");
        expectHidden("Nothing Selected");
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        expectVisible("Lists Content");
        expectRouteNames(stateLog, ["Lists"]);
    });

    it("takes a new sidebar route when the first screen is swapped out", async () => {
        const stateLog = createStateLog();
        const { rerender } = await render(<GatedSplit hasLists onStateChange={stateLog.record} />);
        await screen.findByText("Lists Content");
        await rerender(<GatedSplit hasLists={false} onStateChange={stateLog.record} />);
        await screen.findByText("Tasks Content");
        expectHidden("Lists Content");
        expectRouteNames(stateLog, ["Tasks"]);
    });
});
