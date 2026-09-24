import type {
    EventListenerCallback,
    NavigationAction,
    NavigationContainerEventMap,
    NavigationState,
} from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    CommonActions,
    createNavigationContainerRef,
    NavigationContainer,
    NavigationIndependentTree,
    useNavigation,
    useNavigationContainerRef,
    useNavigationState,
} from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    Details,
    Home,
    InnerStack,
    NestedStack,
    type RootParams,
    RootStack,
    Stack,
    TabsWithStack,
} from "./helpers/container-fixtures.js";

const nestedInitialState = {
    index: 0,
    routes: [
        {
            name: "First",
            state: { index: 1, routes: [{ name: "Home" }, { name: "Details", params: { id: "7" } }] },
        },
        { name: "Second" },
    ],
};

const ImperativeApp = (): ReactNode => {
    const ref = useNavigationContainerRef<RootParams>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton
                label="Jump to details"
                onClicked={() => {
                    ref.navigate("Details", { id: "9" });
                }}
            />
            <NavigationContainer ref={ref}>
                <RootStack />
            </NavigationContainer>
        </GtkBox>
    );
};

const IndependentScreen = (): ReactNode => (
    <NavigationIndependentTree>
        <NavigationContainer>
            <NestedStack />
        </NavigationContainer>
    </NavigationIndependentTree>
);

const DependentScreen = (): ReactNode => (
    <NavigationContainer>
        <NestedStack />
    </NavigationContainer>
);

const Lost = (): ReactNode => {
    useNavigation();

    return <GtkLabel>Lost Content</GtkLabel>;
};

const StateReader = (): ReactNode => {
    const index = useNavigationState((state) => state.index);

    return <GtkLabel>{`Index ${String(index)}`}</GtkLabel>;
};

describe("container - callbacks", () => {
    it("calls onReady once after mount and not again on navigation", async () => {
        let readyEvents = 0;

        await render(
            <NavigationContainer
                onReady={() => {
                    readyEvents += 1;
                }}
            >
                <RootStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        expect(readyEvents).toBe(1);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 42");
        expect(readyEvents).toBe(1);
    });

    it("calls onStateChange with the root state on navigation but not on mount", async () => {
        const states: (NavigationState | undefined)[] = [];

        await render(
            <NavigationContainer
                onStateChange={(state) => {
                    states.push(state);
                }}
            >
                <RootStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        expect(states).toEqual([]);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 42");
        expect(states).toHaveLength(1);

        expect(states[0]).toEqual(
            expect.objectContaining({
                type: "stack",
                index: 1,
                routes: [
                    expect.objectContaining({ name: "Home" }),
                    expect.objectContaining({ name: "Details", params: { id: "42" } }),
                ],
            }),
        );
    });

    it("restores a nested stack inside a tab from initialState", async () => {
        await render(
            <NavigationContainer initialState={nestedInitialState}>
                <TabsWithStack />
            </NavigationContainer>,
        );

        await screen.findByText("Details 7");
        expect(screen.queryByText("Home Content")).toBeNull();
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "First Tab" });
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await screen.findByText("Home Content");
        expect(screen.queryByText("Details 7")).toBeNull();
    });
});

describe("container - ref", () => {
    it("drives navigation through a created ref", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        expect(ref.isReady()).toBe(false);

        await render(
            <NavigationContainer ref={ref}>
                <RootStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        expect(ref.isReady()).toBe(true);
        expect(ref.canGoBack()).toBe(false);
        expect(ref.getCurrentRoute()?.name).toBe("Home");

        await act(() => {
            ref.navigate("Details", { id: "3" });
        });

        await screen.findByText("Details 3");
        expect(ref.canGoBack()).toBe(true);
        expect(ref.getCurrentRoute()).toEqual(expect.objectContaining({ name: "Details", params: { id: "3" } }));
        expect(ref.getRootState()).toEqual(expect.objectContaining({ type: "stack", index: 1 }));

        await act(() => {
            ref.goBack();
        });

        await screen.findByText("Home Content");
        expect(ref.getCurrentRoute()?.name).toBe("Home");
    });

    it("navigates from outside the container through useNavigationContainerRef", async () => {
        await render(<ImperativeApp />);
        await screen.findByText("Home Content");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Jump to details" }));
        await screen.findByText("Details 9");
        expect(screen.queryByText("Home Content")).toBeNull();
    });

    it("notifies state listeners until they unsubscribe", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        const stateEvents: Parameters<EventListenerCallback<NavigationContainerEventMap, "state">>[0][] = [];
        const listener: EventListenerCallback<NavigationContainerEventMap, "state"> = (event) => {
            stateEvents.push(event);
        };

        await render(
            <NavigationContainer ref={ref}>
                <RootStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        const unsubscribe = ref.addListener("state", listener);

        await act(() => {
            ref.navigate("Details", { id: "1" });
        });

        await screen.findByText("Details 1");
        expect(stateEvents).toHaveLength(1);
        expect(stateEvents[0]?.data.state).toMatchObject({ type: "stack", index: 1 });
        unsubscribe();

        await act(() => {
            ref.goBack();
        });

        await screen.findByText("Home Content");
        expect(stateEvents).toHaveLength(1);
    });

    it("reports not ready again after unmount", async () => {
        const ref = createNavigationContainerRef<RootParams>();

        const { unmount } = await render(
            <NavigationContainer ref={ref}>
                <RootStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        expect(ref.isReady()).toBe(true);
        await unmount();
        expect(ref.isReady()).toBe(false);
    });
});

describe("container - unhandled actions", () => {
    it("calls onUnhandledAction when no navigator handles the action", async () => {
        const unhandledActions: NavigationAction[] = [];
        const ref = createNavigationContainerRef();

        await render(
            <NavigationContainer
                ref={ref}
                onUnhandledAction={(action) => {
                    unhandledActions.push(action);
                }}
            >
                <RootStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");

        await act(() => {
            ref.dispatch(CommonActions.navigate("Missing"));
        });

        expect(unhandledActions).toHaveLength(1);
        expect(unhandledActions[0]).toMatchObject({ type: "NAVIGATE", payload: { name: "Missing" } });
        await screen.findByText("Home Content");
    });

    it("does not call onUnhandledAction for handled actions", async () => {
        let unhandledActions = 0;

        await render(
            <NavigationContainer
                onUnhandledAction={() => {
                    unhandledActions += 1;
                }}
            >
                <RootStack />
            </NavigationContainer>,
        );

        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 42");
        expect(unhandledActions).toBe(0);
    });
});

describe("container - independent trees", () => {
    it("hosts an independent container inside a screen", async () => {
        let stateChanges = 0;

        await render(
            <NavigationContainer
                onStateChange={() => {
                    stateChanges += 1;
                }}
            >
                <Stack.Navigator>
                    <Stack.Screen name="Home" component={IndependentScreen} />
                    <Stack.Screen name="Details" component={Details} />
                </Stack.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Parent: none");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 42");
        expect(stateChanges).toBe(0);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await screen.findByText("Home Content");
    });
});

describe("container - errors", () => {
    it("throws when useNavigation runs outside a container", async () => {
        await expect(render(<Lost />)).rejects.toThrow();
    });

    it("throws when two navigators render directly inside one container", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Stack.Navigator>
                        <Stack.Screen name="Home" component={Home} />
                    </Stack.Navigator>
                    <InnerStack.Navigator>
                        <InnerStack.Screen name="Home" component={Home} />
                    </InnerStack.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when useNavigationState runs outside a navigator", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <StateReader />
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when a container is nested without NavigationIndependentTree", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Stack.Navigator>
                        <Stack.Screen name="Home" component={DependentScreen} />
                    </Stack.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });
});
