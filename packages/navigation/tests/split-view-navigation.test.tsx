import type { NavigationContainerProps, NavigationState, SplitViewScreenProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createNavigationContainerRef, NavigationContainer } from "@gtkx/navigation";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createStateSpy,
    expectHidden,
    expectRouteNames,
    expectVisible,
    type Params,
    renderSplit,
    Split,
} from "./helpers/split-view-fixtures.js";

type ContainerProps = Partial<NavigationContainerProps<Params>>;

const InitialSidebar = (): ReactNode => <GtkLabel>Lists Content</GtkLabel>;

const InitialTasks = ({ navigation, route }: SplitViewScreenProps<Params, "Tasks">): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`Tasks ${route.params.listId}`}</GtkLabel>
        <GtkButton
            label="Go back"
            onClicked={() => {
                navigation.goBack();
            }}
        />
    </GtkBox>
);

const initialApp = (container: ContainerProps): ReactNode => (
    <NavigationContainer {...container}>
        <Split.Navigator initialRouteName="Tasks" contentPlaceholder={<GtkLabel>Nothing Selected</GtkLabel>}>
            <Split.Screen name="Lists" component={InitialSidebar} options={{ title: "Lists" }} />
            <Split.Screen name="Tasks" component={InitialTasks} initialParams={{ listId: "personal" }} />
        </Split.Navigator>
    </NavigationContainer>
);

const expectStateRouteNames = (state: NavigationState | undefined, names: string[]): void => {
    expect(state?.routes.map((route) => route.name)).toEqual(names);
};

describe("split view - navigation", () => {
    it("fills the content pane and hides the placeholder when a list is selected", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await screen.findByText("Nothing Selected");
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        expectHidden("Nothing Selected");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists", "Tasks"]);
    });

    it("keeps the sidebar visible while a detail covers the list", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists", "Tasks", "Task"]);
    });

    it("returns from the detail to the list with goBack", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        await clickButton("Go back");
        await screen.findByText("Tasks personal");
        expectHidden("Task 7");
        expectRouteNames(onStateChange, ["Lists", "Tasks"]);
    });

    it("returns from the list to the placeholder with the sidebar still visible", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists"]);
    });

    it("replaces the content and drops the detail when the sidebar reopens the same route", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await clickButton("Open task");
        await screen.findByText("Task 7");
        await clickButton("Open work");
        await screen.findByText("Tasks work");
        expectHidden("Task 7");
        expectHidden("Tasks personal");
        expectRouteNames(onStateChange, ["Lists", "Tasks"]);
    });

    it("clears the content pane back to the placeholder with popToTop", async () => {
        const onStateChange = createStateSpy();
        await renderSplit({ container: { onStateChange } });
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Pop to top");
        await screen.findByText("Nothing Selected");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists"]);
    });

    it("opens on the content route named by initialRouteName with the sidebar pinned below it", async () => {
        const ref = createNavigationContainerRef<Params>();
        await render(initialApp({ ref }));
        await screen.findByText("Tasks personal");
        expectVisible("Lists Content");
        expectHidden("Nothing Selected");
        expectStateRouteNames(ref.getRootState(), ["Lists", "Tasks"]);
    });

    it("pops the route named by initialRouteName back to the placeholder", async () => {
        const onStateChange = createStateSpy();
        await render(initialApp({ onStateChange }));
        await screen.findByText("Tasks personal");
        expect(onStateChange).not.toHaveBeenCalled();
        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        expectHidden("Tasks personal");
        expectVisible("Lists Content");
        expectRouteNames(onStateChange, ["Lists"]);
    });
});
