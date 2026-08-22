import type {
    DrawerNavigationOptions,
    DrawerNavigationProp,
    DrawerStatus,
    NavigationState,
    ParamListBase,
    StackNavigationProp,
} from "@gtkx/navigation";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createDrawerNavigator, createStackNavigator, DrawerActions, useNavigation } from "@gtkx/navigation";
import { screen, within } from "@gtkx/testing";
import { useEffect } from "react";
import { expect } from "vitest";

type WidgetClass<T> = abstract new (...args: never[]) => T;
type StateSpy = Mock<(state: NavigationState | undefined) => void>;
type ScreenConfig = { name: string; text: string; options?: DrawerNavigationOptions };
type MountSpyProps = { text: string; onMount: () => void };

const Drawer = createDrawerNavigator();
const NestedStack = createStackNavigator();
const TOGGLE_NAME = "Toggle Sidebar";
const INBOX: ScreenConfig = { name: "Inbox", text: "Inbox Content" };
const SETTINGS: ScreenConfig = { name: "Settings", text: "Settings Content" };
const ARCHIVE: ScreenConfig = { name: "Archive", text: "Archive Content" };

const DrawerScreen = ({ text }: { text: string }): ReactNode => {
    const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{text}</GtkLabel>
            <GtkButton
                label="Go to settings"
                onClicked={() => {
                    navigation.navigate("Settings");
                }}
            />
            <GtkButton
                label="Go back"
                onClicked={() => {
                    navigation.goBack();
                }}
            />
            <GtkButton
                label="Open drawer"
                onClicked={() => {
                    navigation.dispatch(DrawerActions.openDrawer());
                }}
            />
            <GtkButton
                label="Close drawer"
                onClicked={() => {
                    navigation.dispatch(DrawerActions.closeDrawer());
                }}
            />
            <GtkButton
                label="Toggle drawer"
                onClicked={() => {
                    navigation.dispatch(DrawerActions.toggleDrawer());
                }}
            />
        </GtkBox>
    );
};

const MountSpy = ({ text, onMount }: MountSpyProps): ReactNode => {
    useEffect(() => {
        onMount();
    }, [onMount]);

    return <GtkLabel>{text}</GtkLabel>;
};

const NestedHome = (): ReactNode => {
    const navigation = useNavigation<StackNavigationProp<ParamListBase>>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Nested Home</GtkLabel>
            <GtkButton
                label="Go to details"
                onClicked={() => {
                    navigation.navigate("Details");
                }}
            />
        </GtkBox>
    );
};

const NestedDetails = (): ReactNode => <GtkLabel>Nested Details</GtkLabel>;

const NestedStackScreen = (): ReactNode => (
    <NestedStack.Navigator>
        <NestedStack.Screen name="Home" component={NestedHome} />
        <NestedStack.Screen name="Details" component={NestedDetails} />
    </NestedStack.Navigator>
);

const drawerScreens = (configs: ScreenConfig[]): ReactNode =>
    configs.map(({ name, text, options }) => (
        <Drawer.Screen key={name} name={name} options={options}>
            {() => <DrawerScreen text={text} />}
        </Drawer.Screen>
    ));

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

const sidebarList = (): Gtk.ListBox => {
    const list = screen.getByRole(Gtk.AccessibleRole.LIST);

    if (!(list instanceof Gtk.ListBox)) {
        throw new TypeError("The sidebar list is not a GtkListBox");
    }

    return list;
};

const sidebarRow = (label: string): Gtk.ListBoxRow =>
    getAncestor(within(sidebarList()).getByText(label), Gtk.ListBoxRow);

const querySidebarLabel = (label: string): Gtk.Widget | null => {
    const list = screen.queryByRole(Gtk.AccessibleRole.LIST);

    return list === null ? null : within(list).queryByText(label);
};

const toggleButton = (): Gtk.Widget => screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: TOGGLE_NAME });
const splitView = (): Adw.OverlaySplitView => getAncestor(toggleButton(), Adw.OverlaySplitView);

const expectHeaderTitle = (title: string): void => {
    const headerBar = getAncestor(toggleButton(), Adw.HeaderBar);
    expect(within(headerBar).getByText(title)).toBeVisible();
};

const lastState = (spy: StateSpy): NavigationState => {
    const state = spy.mock.lastCall?.[0];

    if (state === undefined) {
        throw new Error("onStateChange has not reported a state yet");
    }

    return state;
};

const routeKey = (state: NavigationState, name: string): string => {
    const route = state.routes.find((candidate) => candidate.name === name);

    if (route === undefined) {
        throw new Error(`No route named "${name}"`);
    }

    return route.key;
};

const getDrawerStatus = (state: NavigationState): DrawerStatus => {
    const history: readonly unknown[] = state.history ?? [];

    const entry = history.findLast(
        (candidate): candidate is { type: "drawer"; status: DrawerStatus } =>
            typeof candidate === "object" && candidate !== null && "type" in candidate && candidate.type === "drawer",
    );

    if (entry !== undefined) {
        return entry.status;
    }

    return "default" in state && state.default === "open" ? "open" : "closed";
};

export {
    ARCHIVE,
    Drawer,
    drawerScreens,
    getDrawerStatus,
    expectHeaderTitle,
    INBOX,
    lastState,
    MountSpy,
    NestedStackScreen,
    querySidebarLabel,
    routeKey,
    SETTINGS,
    sidebarList,
    sidebarRow,
    splitView,
    toggleButton,
};
