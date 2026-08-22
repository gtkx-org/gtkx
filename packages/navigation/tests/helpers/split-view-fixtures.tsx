import type {
    NavigationAction,
    NavigationContainerProps,
    NavigationState,
    SplitViewNavigationOptions,
    SplitViewNavigationProp,
    SplitViewScreenProps,
} from "@gtkx/navigation";
import type { RenderResult } from "@gtkx/testing";
import type { ComponentProps, ReactNode } from "react";
import type { Mock } from "vitest";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createSplitViewNavigator, NavigationContainer, usePreventRemove } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { createContext, useContext, useEffect } from "react";
import { expect, vi } from "vitest";

type Params = {
    Lists: undefined;
    Tasks: { listId: string };
    Task: { id: string };
    Draft: undefined;
};

type SplitEvent = { type: string; route: string; isClosing?: boolean };
type EventSpy = Mock<(event: SplitEvent) => void>;
type PreventSpy = Mock<(data: { action: NavigationAction }) => void>;
type StateSpy = Mock<(state: NavigationState | undefined) => void>;
type WidgetClass<T> = abstract new (...args: never[]) => T;
type NavigatorProps = Partial<Omit<ComponentProps<typeof Split.Navigator>, "children">>;
type Spies = { onEvent?: EventSpy; onPrevent?: PreventSpy };

type SplitOptions = {
    navigator?: NavigatorProps;
    lists?: SplitViewNavigationOptions;
    tasks?: SplitViewNavigationOptions;
    container?: Partial<NavigationContainerProps<Params>>;
    isAnimated?: boolean;
    spies?: Spies;
};

const Split = createSplitViewNavigator<Params>();
const SpyContext = createContext<Spies>({});

const useEventRecorder = <RouteName extends keyof Params>(
    navigation: SplitViewNavigationProp<Params, RouteName>,
    route: string,
): void => {
    const { onEvent } = useContext(SpyContext);

    useEffect(() => {
        if (onEvent === undefined) {
            return;
        }

        const unsubscribes = [
            navigation.addListener("transitionStart", (event) => {
                onEvent({ type: "transitionStart", route, isClosing: event.data.closing });
            }),
            navigation.addListener("transitionEnd", (event) => {
                onEvent({ type: "transitionEnd", route, isClosing: event.data.closing });
            }),
        ];

        return () => {
            for (const unsubscribe of unsubscribes) {
                unsubscribe();
            }
        };
    }, [navigation, onEvent, route]);
};

const Lists = ({ navigation, route }: SplitViewScreenProps<Params, "Lists">): ReactNode => {
    useEventRecorder(navigation, route.name);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Lists Content</GtkLabel>
            <GtkButton
                label="Open personal"
                onClicked={() => {
                    navigation.navigate("Tasks", { listId: "personal" });
                }}
            />
            <GtkButton
                label="Open work"
                onClicked={() => {
                    navigation.navigate("Tasks", { listId: "work" });
                }}
            />
            <GtkButton
                label="Open draft"
                onClicked={() => {
                    navigation.navigate("Draft");
                }}
            />
        </GtkBox>
    );
};

const Tasks = ({ navigation, route }: SplitViewScreenProps<Params, "Tasks">): ReactNode => {
    useEventRecorder(navigation, route.name);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`Tasks ${route.params.listId}`}</GtkLabel>
            <GtkButton
                label="Open task"
                onClicked={() => {
                    navigation.navigate("Task", { id: "7" });
                }}
            />
            <GtkButton
                label="Go back"
                onClicked={() => {
                    navigation.goBack();
                }}
            />
            <GtkButton
                label="Pop to top"
                onClicked={() => {
                    navigation.popToTop();
                }}
            />
            <GtkButton
                label="Replace with task"
                onClicked={() => {
                    navigation.replace("Task", { id: "9" });
                }}
            />
            <GtkButton
                label="Reset to task"
                onClicked={() => {
                    navigation.reset({ index: 0, routes: [{ name: "Task", params: { id: "3" } }] });
                }}
            />
        </GtkBox>
    );
};

const Task = ({ navigation, route }: SplitViewScreenProps<Params, "Task">): ReactNode => {
    useEventRecorder(navigation, route.name);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`Task ${route.params.id}`}</GtkLabel>
            <GtkButton
                label="Go back"
                onClicked={() => {
                    navigation.goBack();
                }}
            />
        </GtkBox>
    );
};

const Draft = ({ navigation, route }: SplitViewScreenProps<Params, "Draft">): ReactNode => {
    const { onPrevent } = useContext(SpyContext);
    useEventRecorder(navigation, route.name);

    usePreventRemove(true, ({ data }) => {
        onPrevent?.(data);
    });

    return <GtkLabel>Draft Content</GtkLabel>;
};

const buildSplit = (options: SplitOptions = {}): ReactNode => (
    <SpyContext value={options.spies ?? {}}>
        <NavigationContainer {...options.container}>
            <Split.Navigator contentPlaceholder={<GtkLabel>Nothing Selected</GtkLabel>} {...options.navigator}>
                <Split.Screen name="Lists" component={Lists} options={{ title: "Lists", ...options.lists }} />
                <Split.Screen name="Tasks" component={Tasks} options={options.tasks} />
                <Split.Screen name="Task" component={Task} options={{ title: "Task Page" }} />
                <Split.Screen name="Draft" component={Draft} />
            </Split.Navigator>
        </NavigationContainer>
    </SpyContext>
);

const renderSplit = (options: SplitOptions = {}): Promise<RenderResult> =>
    render(buildSplit(options), { areAnimationsEnabled: options.isAnimated });

const getAncestor = <T,>(widget: Gtk.Widget, type: WidgetClass<T>): T => {
    let current: Gtk.Widget | null = widget;

    while (current !== null) {
        if (current instanceof type) {
            return current;
        }

        current = current.getParent();
    }

    throw new Error("The widget has no ancestor of the requested type");
};

const splitView = (): Adw.NavigationSplitView =>
    getAncestor(screen.getByText("Lists Content"), Adw.NavigationSplitView);

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const pressKeys = async (text: string, keys: string): Promise<void> => {
    await userEvent.keyboard(await screen.findByText(text), keys);
};

const createStateSpy = (): StateSpy => vi.fn<(state: NavigationState | undefined) => void>();
const createEventSpy = (): EventSpy => vi.fn<(event: SplitEvent) => void>();
const createPreventSpy = (): PreventSpy => vi.fn<(data: { action: NavigationAction }) => void>();
const getRouteNames = (state: NavigationState | undefined): string[] => state?.routes.map((route) => route.name) ?? [];

const expectRouteNames = (onStateChange: StateSpy, names: string[]): void => {
    expect(getRouteNames(onStateChange.mock.lastCall?.[0])).toEqual(names);
};

const expectVisible = (text: string): void => {
    expect(screen.getByText(text)).toBeVisible();
};

const expectHidden = (text: string): void => {
    expect(screen.queryByText(text)).toBeNull();
};

export {
    buildSplit,
    clickButton,
    createEventSpy,
    createPreventSpy,
    createStateSpy,
    expectHidden,
    expectRouteNames,
    expectVisible,
    getAncestor,
    type Params,
    pressKeys,
    renderSplit,
    Split,
    type SplitEvent,
    splitView,
};
