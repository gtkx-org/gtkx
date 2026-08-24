import type {
    NavigationContainerRefWithCurrent,
    NavigationState,
    SplitViewScreenProps,
} from "@gtkx/navigation";
import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import {
    CommonActions,
    createNavigationContainerRef,
    createSplitViewNavigator,
    NavigationContainer,
    StackActions,
} from "@gtkx/navigation";
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
    navigationRef?: NavigationContainerRefWithCurrent<Params>;
    onStateChange?: (state: NavigationState | undefined) => void;
    tasksFirst?: boolean;
};

type ParameterizedParams = {
    Lists: { id: string };
    Tasks: undefined;
};

type KeyedParams = {
    Sidebar: { version: string };
    Content: undefined;
};

type ParameterizedAppProps = {
    navigationRef: NavigationContainerRefWithCurrent<ParameterizedParams>;
};

type KeyedAppProps = {
    navigationRef: NavigationContainerRefWithCurrent<KeyedParams>;
    version: string;
};

const ParameterizedSplit = createSplitViewNavigator<ParameterizedParams>();
const KeyedSplit = createSplitViewNavigator<KeyedParams>();

const ParameterizedSidebar = ({ route }: SplitViewScreenProps<ParameterizedParams, "Lists">): ReactNode => (
    <GtkLabel>{`Sidebar ${route.params.id}`}</GtkLabel>
);

const ParameterizedTasks = (): ReactNode => <GtkLabel>Parameterized Tasks</GtkLabel>;

const ParameterizedApp = ({ navigationRef }: ParameterizedAppProps): ReactNode => (
    <NavigationContainer<ParameterizedParams> ref={navigationRef}>
        <ParameterizedSplit.Navigator contentPlaceholder={<GtkLabel>Parameterized Placeholder</GtkLabel>}>
            <ParameterizedSplit.Screen
                name="Lists"
                component={ParameterizedSidebar}
                initialParams={{ id: "root" }}
                getId={({ params }) => params.id}
            />
            <ParameterizedSplit.Screen name="Tasks" component={ParameterizedTasks} />
        </ParameterizedSplit.Navigator>
    </NavigationContainer>
);

const KeyedSidebar = ({ route }: SplitViewScreenProps<KeyedParams, "Sidebar">): ReactNode => (
    <GtkLabel>{`Keyed Sidebar ${route.params.version}`}</GtkLabel>
);

const KeyedContent = (): ReactNode => <GtkLabel>Keyed Content</GtkLabel>;

const KeyedApp = ({ navigationRef, version }: KeyedAppProps): ReactNode => (
    <NavigationContainer<KeyedParams> ref={navigationRef}>
        <KeyedSplit.Navigator>
            <KeyedSplit.Screen
                name="Sidebar"
                component={KeyedSidebar}
                initialParams={{ version }}
                navigationKey={version}
            />
            <KeyedSplit.Screen name="Content" component={KeyedContent} />
        </KeyedSplit.Navigator>
    </NavigationContainer>
);

const GatedSplit = ({ hasLists, navigationRef, onStateChange, tasksFirst = false }: GatedSplitProps): ReactNode => {
    const lists = hasLists
        ? <Split.Screen key="lists" name="Lists" component={() => <GtkLabel>Lists Content</GtkLabel>} />
        : null;

    const tasks = <Split.Screen key="tasks" name="Tasks" component={() => <GtkLabel>Tasks Content</GtkLabel>} />;

    return (
        <NavigationContainer<Params> ref={navigationRef} onStateChange={onStateChange}>
            <Split.Navigator>
                {tasksFirst
                    ? (
                            <>
                                {tasks}
                                {lists}
                            </>
                        )
                    : (
                            <>
                                {lists}
                                {tasks}
                            </>
                        )}
            </Split.Navigator>
        </NavigationContainer>
    );
};

const rootKey = (state: NavigationState | undefined): string => {
    const key = state?.routes[0]?.key;

    if (key === undefined) {
        throw new Error("The split navigator has no root route");
    }

    return key;
};

describe("split view - router (1)", () => {
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
});

describe("split view - router (2)", () => {
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
});

describe("split view - router (3)", () => {
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
});

describe("split view - router (4)", () => {
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

describe("split view - router action normalization", () => {
    it.each([
        ["push", StackActions.push("Lists", { id: "pushed" }), "pushed"],
        ["navigate with pop false", CommonActions.navigate("Lists", { id: "navigated" }, { pop: false }), "navigated"],
        ["popTo with a new getId", StackActions.popTo("Lists", { id: "popped" }), "popped"],
        ["replace", StackActions.replace("Lists", { id: "replaced" }), "replaced"],
    ] as const)("selects one stable sidebar after %s", async (_label, action, id) => {
        const navigationRef = createNavigationContainerRef<ParameterizedParams>();
        await render(<ParameterizedApp navigationRef={navigationRef} />);
        await screen.findByText("Sidebar root");
        const initialKey = rootKey(navigationRef.getRootState());

        await act(() => {
            navigationRef.navigate("Tasks");
        });

        await screen.findByText("Parameterized Tasks");

        await act(() => {
            navigationRef.dispatch(action);
        });

        await screen.findByText(`Sidebar ${id}`);
        expect(screen.getByText("Parameterized Placeholder")).toBeVisible();
        expect(screen.queryByText("Parameterized Tasks")).toBeNull();
        expect(navigationRef.getRootState()?.routes).toHaveLength(1);

        expect(navigationRef.getRootState()).toMatchObject({
            index: 0,
            routes: [{ key: initialKey, name: "Lists", params: { id } }],
        });
    });
});

describe("split view - router state normalization", () => {
    it("collapses a reset containing duplicate sidebar routes into the updated canonical route", async () => {
        const navigationRef = createNavigationContainerRef<ParameterizedParams>();
        await render(<ParameterizedApp navigationRef={navigationRef} />);
        await screen.findByText("Sidebar root");
        const initialKey = rootKey(navigationRef.getRootState());

        await act(() => {
            navigationRef.dispatch(CommonActions.reset({
                index: 2,
                routes: [
                    { name: "Lists", params: { id: "root" } },
                    { name: "Tasks" },
                    { name: "Lists", params: { id: "reset" } },
                ],
            }));
        });

        await screen.findByText("Sidebar reset");
        expect(screen.getByText("Parameterized Placeholder")).toBeVisible();
        expect(navigationRef.getRootState()?.routes).toHaveLength(1);

        expect(navigationRef.getRootState()).toMatchObject({
            index: 0,
            routes: [{ key: initialKey, name: "Lists", params: { id: "reset" } }],
        });
    });

    it("drops a sidebar preload before it can become content", async () => {
        const navigationRef = createNavigationContainerRef<ParameterizedParams>();
        await render(<ParameterizedApp navigationRef={navigationRef} />);
        await screen.findByText("Sidebar root");
        const initialKey = rootKey(navigationRef.getRootState());

        await act(() => {
            navigationRef.navigate("Tasks");
        });

        await screen.findByText("Parameterized Tasks");

        await act(() => {
            navigationRef.dispatch(CommonActions.preload("Lists", { id: "preloaded" }));
        });

        expect(screen.getByText("Sidebar root")).toBeVisible();
        expect(screen.getByText("Parameterized Tasks")).toBeVisible();
        expect(navigationRef.getRootState()?.routes).toHaveLength(2);

        expect(navigationRef.getRootState()).toMatchObject({
            index: 1,
            preloadedRoutes: [],
            routes: [{ key: initialKey, name: "Lists" }, { name: "Tasks" }],
        });
    });
});

describe("split view - router reduction purity", () => {
    it("keeps canonical identity after a speculative sidebar selection is rejected", async () => {
        const navigationRef = createNavigationContainerRef<Params>();
        let preventions = 0;

        const onPrevent = (): void => {
            preventions += 1;
        };

        await renderSplit({ container: { ref: navigationRef }, spies: { onPrevent } });
        await clickButton("Open draft");
        await screen.findByText("Draft Content");
        const initialKey = rootKey(navigationRef.getRootState());
        const draftKey = navigationRef.getRootState()?.routes.find((route) => route.name === "Draft")?.key;

        if (draftKey === undefined) {
            throw new Error("The split navigator has no draft route");
        }

        const sidebarSelection = StackActions.push("Lists");

        await act(() => {
            navigationRef.dispatch(sidebarSelection);
        });

        expectVisible("Draft Content");
        expect(preventions).toBe(1);

        await act(() => {
            navigationRef.dispatch(sidebarSelection);
        });

        expectVisible("Draft Content");
        expect(preventions).toBe(2);

        await act(() => {
            navigationRef.dispatch({
                ...CommonActions.setParams({ marker: "after-rejection" }),
                source: draftKey,
            });
        });

        expectVisible("Draft Content");

        expect(navigationRef.getRootState()).toMatchObject({
            index: 1,
            routes: [{ key: initialKey, name: "Lists" }, { key: draftKey, name: "Draft" }],
        });
    });
});

describe("split view - router declaration changes", () => {
    it("remounts the canonical sidebar after its navigationKey changes while keeping content selected", async () => {
        const navigationRef = createNavigationContainerRef<KeyedParams>();
        const { rerender } = await render(<KeyedApp navigationRef={navigationRef} version="one" />);
        await screen.findByText("Keyed Sidebar one");

        await act(() => {
            navigationRef.navigate("Content");
        });

        await screen.findByText("Keyed Content");
        const previousState = navigationRef.getRootState();
        const previousSidebarKey = rootKey(previousState);
        const previousContentKey = previousState?.routes[1]?.key;

        if (previousContentKey === undefined) {
            throw new Error("The split navigator has no selected content route");
        }

        await rerender(<KeyedApp navigationRef={navigationRef} version="two" />);
        await screen.findByText("Keyed Sidebar two");
        expect(screen.queryByText("Keyed Sidebar one")).toBeNull();
        expect(screen.getByText("Keyed Content")).toBeVisible();
        expect(rootKey(navigationRef.getRootState())).not.toBe(previousSidebarKey);
        expect(navigationRef.getRootState()?.routes).toHaveLength(2);

        expect(navigationRef.getRootState()).toMatchObject({
            index: 1,
            routes: [
                { name: "Sidebar", params: { version: "two" } },
                { key: previousContentKey, name: "Content" },
            ],
        });
    });

    it("turns a selected content route into the sole sidebar when declarations are reordered", async () => {
        const navigationRef = createNavigationContainerRef<Params>();
        const { rerender } = await render(<GatedSplit hasLists navigationRef={navigationRef} />);
        await screen.findByText("Lists Content");

        await act(() => {
            navigationRef.navigate("Tasks", { listId: "selected" });
        });

        await screen.findByText("Tasks Content");
        await rerender(<GatedSplit hasLists navigationRef={navigationRef} tasksFirst />);
        expect(screen.getByText("Tasks Content")).toBeVisible();
        expect(screen.queryByText("Lists Content")).toBeNull();
        expect(navigationRef.getRootState()?.routes).toHaveLength(1);
        expect(navigationRef.getRootState()).toMatchObject({ index: 0, routes: [{ name: "Tasks" }] });
    });
});

describe("split view - router source actions", () => {
    it("replaces the selected content when replace is dispatched by the visible sidebar", async () => {
        const navigationRef = createNavigationContainerRef<Params>();
        await renderSplit({ container: { ref: navigationRef } });
        await screen.findByText("Nothing Selected");
        const initialKey = rootKey(navigationRef.getRootState());
        await clickButton("Open personal");
        await screen.findByText("Tasks personal");
        await clickButton("Replace selected with task");
        await screen.findByText("Task 6");
        expectHidden("Tasks personal");
        expect(navigationRef.getRootState()?.routes).toHaveLength(2);

        expect(navigationRef.getRootState()).toMatchObject({
            index: 1,
            routes: [{ key: initialKey, name: "Lists" }, { name: "Task", params: { id: "6" } }],
        });

        await clickButton("Go back");
        await screen.findByText("Nothing Selected");
        expect(navigationRef.getRootState()?.routes).toHaveLength(1);
        expect(navigationRef.getRootState()).toMatchObject({ index: 0, routes: [{ key: initialKey }] });
    });
});
