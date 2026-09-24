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
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createSplitViewNavigator, NavigationContainer, usePreventRemove } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { createContext, useContext, useEffect } from "react";
import { expect } from "vitest";

import { getAncestor } from "./widget-ancestors.js";

type Params = {
    Lists: undefined;
    Tasks: { listId: string };
    Task: { id: string };
    Draft: undefined;
};

type SplitEvent = { type: string; route: string; isClosing?: boolean };
type StateLog = {
    states: (NavigationState | undefined)[];
    record: (state: NavigationState | undefined) => void;
};
type EventLog = {
    events: SplitEvent[];
    record: (event: SplitEvent) => void;
};
type PreventLog = {
    actions: NavigationAction[];
    record: (data: { action: NavigationAction }) => void;
};
type NavigatorProps = Partial<Omit<ComponentProps<typeof Split.Navigator>, "children">>;
type Callbacks = {
    onEvent?: (event: SplitEvent) => void;
    onPrevent?: (data: { action: NavigationAction }) => void;
};

type SplitOptions = {
    navigator?: NavigatorProps;
    lists?: SplitViewNavigationOptions;
    tasks?: SplitViewNavigationOptions;
    container?: Partial<NavigationContainerProps<Params>>;
    isAnimated?: boolean;
    callbacks?: Callbacks;
};

const Split = createSplitViewNavigator<Params>();
const CallbackContext = createContext<Callbacks>({});

const useEventRecorder = <RouteName extends keyof Params>(
    navigation: SplitViewNavigationProp<Params, RouteName>,
    route: string,
): void => {
    const { onEvent } = useContext(CallbackContext);

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
    const { onPrevent } = useContext(CallbackContext);
    useEventRecorder(navigation, route.name);

    usePreventRemove(true, ({ data }) => {
        onPrevent?.(data);
    });

    return <GtkLabel>Draft Content</GtkLabel>;
};

const buildSplit = (options: SplitOptions = {}): ReactNode => (
    <CallbackContext value={options.callbacks ?? {}}>
        <NavigationContainer {...options.container}>
            <Split.Navigator contentPlaceholder={<GtkLabel>Nothing Selected</GtkLabel>} {...options.navigator}>
                <Split.Screen name="Lists" component={Lists} options={{ title: "Lists", ...options.lists }} />
                <Split.Screen name="Tasks" component={Tasks} options={options.tasks} />
                <Split.Screen name="Task" component={Task} options={{ title: "Task Page" }} />
                <Split.Screen name="Draft" component={Draft} />
            </Split.Navigator>
        </NavigationContainer>
    </CallbackContext>
);

const renderSplit = (options: SplitOptions = {}): Promise<RenderResult> =>
    render(buildSplit(options), { areAnimationsEnabled: options.isAnimated });

const splitView = (): Adw.NavigationSplitView =>
    getAncestor(screen.getByText("Lists Content"), Adw.NavigationSplitView);

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const pressKeys = async (text: string, keys: string): Promise<void> => {
    await userEvent.keyboard(await screen.findByText(text), keys);
};

const createStateLog = (): StateLog => {
    const states: (NavigationState | undefined)[] = [];

    return {
        states,
        record: (state) => {
            states.push(state);
        },
    };
};

const createEventLog = (): EventLog => {
    const events: SplitEvent[] = [];

    return {
        events,
        record: (event) => {
            events.push(event);
        },
    };
};

const createPreventLog = (): PreventLog => {
    const actions: NavigationAction[] = [];

    return {
        actions,
        record: ({ action }) => {
            actions.push(action);
        },
    };
};
const getRouteNames = (state: NavigationState | undefined): string[] => state?.routes.map((route) => route.name) ?? [];

const expectRouteNames = (stateLog: StateLog, names: string[]): void => {
    expect(getRouteNames(stateLog.states.at(-1))).toEqual(names);
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
    createEventLog,
    createPreventLog,
    createStateLog,
    expectHidden,
    expectRouteNames,
    expectVisible,
    type Params,
    pressKeys,
    renderSplit,
    Split,
    splitView,
};

export { getAncestor } from "./widget-ancestors.js";
