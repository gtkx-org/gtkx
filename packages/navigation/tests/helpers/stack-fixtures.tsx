import type {
    NavigationAction,
    NavigationContainerProps,
    NavigationState,
    ParamListBase,
    StackHeaderProps,
    StackNavigationOptions,
    StackNavigationProp,
    StackNavigationState,
    StackScreenProps,
} from "@gtkx/navigation";
import type { RenderResult } from "@gtkx/testing";
import type { ComponentProps, ReactNode } from "react";
import type { Mock } from "vitest";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createStackNavigator,
    NavigationContainer,
    useNavigationContainerRef,
    usePreventRemove,
    useRoute,
} from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createContext, useContext, useEffect, useState } from "react";
import { expect, vi } from "vitest";

type RootParams = {
    Home: undefined;
    Details: { id: string };
    Settings: undefined;
    Compose: undefined;
    Draft: { text: string };
};

type WidgetClass<T> = abstract new (...args: never[]) => T;
type StackEvent = { type: string; route: string; isClosing?: boolean };
type EventSpy = Mock<(event: StackEvent) => void>;
type PreventSpy = Mock<(data: { action: NavigationAction }) => void>;
type StateSpy = Mock<(state: NavigationState | undefined) => void>;

type Spies = {
    onEvent?: EventSpy;
    onPrevent?: PreventSpy;
};

type NavigatorProps = Partial<Omit<ComponentProps<typeof Stack.Navigator>, "children">>;

type StackOptions = {
    navigator?: NavigatorProps;
    home?: StackNavigationOptions;
    details?: StackNavigationOptions;
    settings?: StackNavigationOptions;
    container?: Partial<NavigationContainerProps<RootParams>>;
    isAnimated?: boolean;
    spies?: Spies;
};

type Actions = [string, () => void][];

const Stack = createStackNavigator<RootParams>();
const SpyContext = createContext<Spies>({});

const useEventRecorder = <RouteName extends keyof RootParams>(
    navigation: StackNavigationProp<RootParams, RouteName>,
    route: string,
): void => {
    const { onEvent } = useContext(SpyContext);

    useEffect(() => {
        if (onEvent === undefined) {
            return;
        }

        const record = (type: string, isClosing?: boolean): void => {
            onEvent({ type, route, isClosing });
        };

        const unsubscribes = [
            navigation.addListener("transitionStart", (event) => {
                record("transitionStart", event.data.closing);
            }),
            navigation.addListener("transitionEnd", (event) => {
                record("transitionEnd", event.data.closing);
            }),
            navigation.addListener("focus", () => {
                record("focus");
            }),
            navigation.addListener("blur", () => {
                record("blur");
            }),
        ];

        return () => {
            for (const unsubscribe of unsubscribes) {
                unsubscribe();
            }
        };
    }, [navigation, onEvent, route]);
};

const Actions = ({ actions }: { actions: Actions }): ReactNode =>
    actions.map(([label, onClicked]) => <GtkButton key={label} label={label} onClicked={onClicked} />);

const homeActions = (navigation: StackNavigationProp<RootParams, "Home">): Actions => [
    ["Go to details", () => {
        navigation.navigate("Details", { id: "1" });
    }],
    ["Push details", () => {
        navigation.push("Details", { id: "1" });
    }],
    ["Replace with details", () => {
        navigation.replace("Details", { id: "1" });
    }],
    ["Preload details", () => {
        navigation.preload("Details", { id: "7" });
    }],
    ["Go to compose", () => {
        navigation.navigate("Compose");
    }],
    ["Go to draft", () => {
        navigation.navigate("Draft", { text: "empty" });
    }],
    ["Go back", () => {
        navigation.goBack();
    }],
];

const detailsActions = (navigation: StackNavigationProp<RootParams, "Details">, id: string): Actions => [
    ["Push details", () => {
        navigation.push("Details", { id: String(Number(id) + 1) });
    }],
    ["Navigate to details", () => {
        navigation.navigate("Details", { id: "5" });
    }],
    ["Pop to top", () => {
        navigation.popToTop();
    }],
    ["Go back", () => {
        navigation.goBack();
    }],
    ["Set params", () => {
        navigation.setParams({ id: "99" });
    }],
    ["Push compose", () => {
        navigation.navigate("Compose");
    }],
    ["Push settings", () => {
        navigation.navigate("Settings");
    }],
    ["Reset to settings", () => {
        navigation.reset({ index: 0, routes: [{ name: "Settings" }] });
    }],
];

const Home = ({ navigation, route }: StackScreenProps<RootParams, "Home">): ReactNode => {
    useEventRecorder(navigation, route.name);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Home Content</GtkLabel>
            <Actions actions={homeActions(navigation)} />
        </GtkBox>
    );
};

const Details = ({ navigation, route }: StackScreenProps<RootParams, "Details">): ReactNode => {
    useEventRecorder(navigation, route.name);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`Details ${route.params.id}`}</GtkLabel>
            <Actions actions={detailsActions(navigation, route.params.id)} />
        </GtkBox>
    );
};

const Settings = ({ navigation, route }: StackScreenProps<RootParams, "Settings">): ReactNode => {
    useEventRecorder(navigation, route.name);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Settings Content</GtkLabel>
            <GtkButton
                label="Go back"
                onClicked={() => {
                    navigation.goBack();
                }}
            />
        </GtkBox>
    );
};

const Compose = ({ navigation, route }: StackScreenProps<RootParams, "Compose">): ReactNode => {
    const { onPrevent } = useContext(SpyContext);
    const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
    useEventRecorder(navigation, route.name);

    usePreventRemove(true, ({ data }) => {
        onPrevent?.(data);
        setPendingAction(data.action);
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Compose Content</GtkLabel>
            <GtkButton
                label="Discard"
                onClicked={() => {
                    if (pendingAction !== null) {
                        navigation.dispatch(pendingAction);
                    }
                }}
            />
        </GtkBox>
    );
};

const Draft = ({ navigation, route }: StackScreenProps<RootParams, "Draft">): ReactNode => {
    const { onPrevent } = useContext(SpyContext);
    useEventRecorder(navigation, route.name);

    usePreventRemove(true, ({ data }) => {
        onPrevent?.(data);
        navigation.setParams({ text: "unsaved" });
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`Draft ${route.params.text}`}</GtkLabel>
        </GtkBox>
    );
};

const CustomHeader = ({ route, options, back, navigation }: StackHeaderProps): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
        <GtkLabel>{`Header ${options.title ?? route.name}`}</GtkLabel>
        {back === undefined
            ? null
            : (
                    <GtkButton
                        label={`Back to ${back.title}`}
                        onClicked={() => {
                            navigation.goBack();
                        }}
                    />
                )}
    </GtkBox>
);

const Orphan = (): ReactNode => {
    const route = useRoute();

    return <GtkLabel>{route.name}</GtkLabel>;
};

const buildStack = (options: StackOptions = {}): ReactNode => (
    <SpyContext value={options.spies ?? {}}>
        <NavigationContainer {...options.container}>
            <Stack.Navigator {...options.navigator}>
                <Stack.Screen name="Home" component={Home} options={options.home} />
                <Stack.Screen
                    name="Details"
                    component={Details}
                    options={{ title: "Details Page", ...options.details }}
                />
                <Stack.Screen name="Settings" component={Settings} options={options.settings} />
                <Stack.Screen name="Compose" component={Compose} />
                <Stack.Screen name="Draft" component={Draft} />
            </Stack.Navigator>
        </NavigationContainer>
    </SpyContext>
);

const renderStack = (options: StackOptions = {}): Promise<RenderResult> =>
    render(buildStack(options), { areAnimationsEnabled: options.isAnimated });

const RefApp = (): ReactNode => {
    const ref = useNavigationContainerRef<RootParams>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkButton
                label="Navigate through ref"
                onClicked={() => {
                    ref.navigate("Details", { id: "9" });
                }}
            />
            {buildStack({ container: { ref } })}
        </GtkBox>
    );
};

const createStateSpy = (): StateSpy => vi.fn<(state: NavigationState | undefined) => void>();
const createEventSpy = (): EventSpy => vi.fn<(event: StackEvent) => void>();
const createPreventSpy = (): PreventSpy => vi.fn<(data: { action: NavigationAction }) => void>();

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const doubleClickButton = async (name: string): Promise<void> => {
    await userEvent.dblClick(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const pressKeys = async (text: string, keys: string): Promise<void> => {
    await userEvent.keyboard(await screen.findByText(text), keys);
};

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

const getNavigationView = (text: string): Adw.NavigationView =>
    getAncestor(screen.getByText(text), Adw.NavigationView);

const countPages = (view: Adw.NavigationView): number => {
    let count = 0;

    for (let child = view.getFirstChild(); child !== null; child = child.getNextSibling()) {
        if (child instanceof Adw.NavigationPage) {
            count += 1;
        }
    }

    return count;
};

const getStackPage = (view: Adw.NavigationView, index: number): Adw.NavigationPage => {
    const page = view.getNavigationStack().getItem(index);

    if (!(page instanceof Adw.NavigationPage)) {
        throw new TypeError(`The navigation stack has no page at index ${String(index)}`);
    }

    return page;
};

const popToPage = async (view: Adw.NavigationView, index: number): Promise<void> => {
    await act(async () => {
        view.popToPage(getStackPage(view, index));
        await Promise.resolve();
    });
};

const getHeaderBar = (): Gtk.Widget => screen.getByRole(Gtk.AccessibleRole.GROUP, { as: Adw.HeaderBar });
const queryHeaderBar = (): Gtk.Widget | null => screen.queryByRole(Gtk.AccessibleRole.GROUP, { as: Adw.HeaderBar });
const queryBackButton = (): Gtk.Widget | null => screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" });
const getRouteNames = (state: NavigationState | undefined): string[] => state?.routes.map((route) => route.name) ?? [];
const getRouteKeys = (state: NavigationState | undefined): string[] => state?.routes.map((route) => route.key) ?? [];
const isStackState = (state: NavigationState): state is StackNavigationState<ParamListBase> => state.type === "stack";

const getPreloadedKeys = (state: NavigationState | undefined): string[] =>
    state !== undefined && isStackState(state) ? state.preloadedRoutes.map((route) => route.key) : [];

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
    buildStack,
    clickButton,
    countPages,
    createEventSpy,
    createPreventSpy,
    createStateSpy,
    CustomHeader,
    doubleClickButton,
    expectHidden,
    expectRouteNames,
    expectVisible,
    getHeaderBar,
    getNavigationView,
    getPreloadedKeys,
    getRouteKeys,
    getRouteNames,
    Orphan,
    popToPage,
    pressKeys,
    queryBackButton,
    queryHeaderBar,
    RefApp,
    renderStack,
    type RootParams,
    Stack,
    type StackEvent,
};
