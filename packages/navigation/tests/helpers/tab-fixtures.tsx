import type { ReactElement, ReactNode } from "react";
import type { Mock } from "vitest";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createStackNavigator,
    createTabNavigator,
    NavigationContainer,
    type NavigationState,
    type ParamListBase,
    type ScreenListeners,
    type StackScreenProps,
    type TabNavigationEventMap,
    type TabNavigationOptions,
    type TabNavigationState,
    type TabNavigatorProps,
    type TabScreenProps,
} from "@gtkx/navigation";
import { screen } from "@gtkx/testing";
import { useEffect } from "react";
import { expect } from "vitest";

type TabName = "First" | "Second" | "Third";
type NestedParams = { Home: undefined; Details: undefined };
type TabListeners = ScreenListeners<TabNavigationState<ParamListBase>, TabNavigationEventMap>;
type TabRenderer = () => ReactNode;
type StateSpy = Mock<(state: NavigationState | undefined) => void>;
type WidgetClass<T> = abstract new (...args: never[]) => T;
type TabPressSpy = Mock<(event: { target?: string }) => void>;

type TabsAppProps = {
    navigator?: Omit<TabNavigatorProps, "children">;
    options?: Partial<Record<TabName, TabNavigationOptions>>;
    listeners?: Partial<Record<TabName, TabListeners>>;
    renderers?: Partial<Record<TabName, TabRenderer>>;
    names?: TabName[];
    onStateChange?: StateSpy;
};

type TabScreenConfig = {
    name: TabName;
    options: TabNavigationOptions;
    listeners: TabListeners | undefined;
    renderer: TabRenderer | undefined;
};

type SpyPageProps = {
    text: string;
    onMount: () => void;
};

const TAB_NAMES: TabName[] = ["First", "Second", "Third"];
const Tabs = createTabNavigator();
const NestedStack = createStackNavigator<NestedParams>();

const TabPage = ({ route, navigation }: TabScreenProps<ParamListBase>): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>{`${route.name} Content`}</GtkLabel>
        <GtkButton
            label="Navigate to Second"
            onClicked={() => {
                navigation.navigate("Second");
            }}
        />
        <GtkButton
            label="Jump to Third"
            onClicked={() => {
                navigation.jumpTo("Third");
            }}
        />
        <GtkButton
            label="Go back"
            onClicked={() => {
                navigation.goBack();
            }}
        />
    </GtkBox>
);

const SpyPage = ({ text, onMount }: SpyPageProps): ReactNode => {
    useEffect(() => {
        onMount();
    }, [onMount]);

    return <GtkLabel>{text}</GtkLabel>;
};

const NestedHome = ({ navigation }: StackScreenProps<NestedParams, "Home">): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>Nested Home</GtkLabel>
        <GtkButton
            label="Push details"
            onClicked={() => {
                navigation.navigate("Details");
            }}
        />
    </GtkBox>
);

const NestedDetails = (): ReactNode => <GtkLabel>Nested Details</GtkLabel>;

const NestedStackScreen = (): ReactNode => (
    <NestedStack.Navigator>
        <NestedStack.Screen name="Home" component={NestedHome} />
        <NestedStack.Screen name="Details" component={NestedDetails} />
    </NestedStack.Navigator>
);

const tabScreen = ({ name, options, listeners, renderer }: TabScreenConfig): ReactElement => {
    const resolved = { title: `${name} Tab`, ...options };

    if (renderer === undefined) {
        return <Tabs.Screen key={name} name={name} component={TabPage} options={resolved} listeners={listeners} />;
    }

    return (
        <Tabs.Screen key={name} name={name} options={resolved} listeners={listeners}>
            {renderer}
        </Tabs.Screen>
    );
};

const TabsApp = ({ navigator, options, listeners, renderers, names, onStateChange }: TabsAppProps): ReactNode => (
    <NavigationContainer onStateChange={onStateChange}>
        <Tabs.Navigator {...navigator}>
            {(names ?? TAB_NAMES).map((name) =>
                tabScreen({
                    name,
                    options: options?.[name] ?? {},
                    listeners: listeners?.[name],
                    renderer: renderers?.[name],
                }),
            )}
        </Tabs.Navigator>
    </NavigationContainer>
);

const findTab = (title: string): Promise<Gtk.Widget> => screen.findByRole(Gtk.AccessibleRole.TAB, { name: title });

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

const getViewStack = (text: string): Adw.ViewStack => getAncestor(screen.getByText(text), Adw.ViewStack);

const getStackPage = (text: string, title: string): Adw.ViewStackPage => {
    const pages = getViewStack(text).getPages();
    const count = pages.getNItems();

    for (let index = 0; index < count; index += 1) {
        const page = pages.getItem(index);

        if (page instanceof Adw.ViewStackPage && page.getTitle() === title) {
            return page;
        }
    }

    throw new Error(`The view stack has no page titled ${title}`);
};

const lastState = (onStateChange: StateSpy): NavigationState | undefined => onStateChange.mock.lastCall?.[0];

const focusedRouteName = (onStateChange: StateSpy): string | undefined => {
    const state = lastState(onStateChange);

    return state === undefined ? undefined : state.routes[state.index]?.name;
};

const focusedRouteKey = (onStateChange: StateSpy): string | undefined => {
    const state = lastState(onStateChange);

    return state === undefined ? undefined : state.routes[state.index]?.key;
};

const expectSelectedTab = (title: string): void => {
    expect(screen.getByRole(Gtk.AccessibleRole.TAB, { name: title })).toHaveAccessibleState(
        Gtk.AccessibleState.SELECTED,
        true,
    );
};

const expectUnselectedTab = (title: string): void => {
    expect(screen.getByRole(Gtk.AccessibleRole.TAB, { name: title })).toHaveAccessibleState(
        Gtk.AccessibleState.SELECTED,
        false,
    );
};

export {
    expectSelectedTab,
    getAncestor,
    getStackPage,
    expectUnselectedTab,
    findTab,
    focusedRouteKey,
    focusedRouteName,
    lastState,
    NestedStackScreen,
    SpyPage,
    type StateSpy,
    type TabPressSpy,
    TabsApp,
};
