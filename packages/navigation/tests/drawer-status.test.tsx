import type { DrawerNavigationProp, ParamListBase, StackNavigationProp } from "@gtkx/navigation";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, DrawerActions, NavigationContainer, useNavigation } from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    Drawer,
    drawerScreens,
    getDrawerStatus,
    INBOX,
    lastState,
    querySidebarLabel,
    SETTINGS,
    sidebarRow,
    splitView,
    toggleButton,
} from "./helpers/drawer-fixtures.js";

type RouteFocusDrawerProps = {
    collapsed: boolean;
    onReady: (focus: () => void) => void;
};

const RouteFocusStack = createStackNavigator();
const RouteFocusContext = createContext<((focus: () => void) => void) | null>(null);

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const RouteFocusHome = (): ReactNode => {
    const navigation = useNavigation<StackNavigationProp<ParamListBase>>();
    const onReady = useContext(RouteFocusContext);

    if (onReady === null) {
        throw new TypeError("RouteFocusHome requires its fixture context");
    }

    useLayoutEffect(() => {
        onReady(() => {
            navigation.navigate("Details");
        });
    }, [navigation, onReady]);

    return <GtkLabel>Route Focus Home</GtkLabel>;
};

const RouteFocusSettings = (): ReactNode => (
    <RouteFocusStack.Navigator>
        <RouteFocusStack.Screen name="Home" component={RouteFocusHome} />
        <RouteFocusStack.Screen name="Details">
            {() => <GtkLabel>Route Focus Details</GtkLabel>}
        </RouteFocusStack.Screen>
    </RouteFocusStack.Navigator>
);

const RouteFocusDrawer = ({ collapsed, onReady }: RouteFocusDrawerProps): ReactNode => (
    <RouteFocusContext value={onReady}>
        <NavigationContainer>
            <Drawer.Navigator collapsed={collapsed}>
                {drawerScreens([INBOX])}
                <Drawer.Screen
                    name="Settings"
                    component={RouteFocusSettings}
                    options={{ lazy: false }}
                />
            </Drawer.Navigator>
        </NavigationContainer>
    </RouteFocusContext>
);

const OpenDrawerOnMount = (): ReactNode => {
    const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();
    const [initialStatus] = useState(() => getDrawerStatus(navigation.getState()));

    useLayoutEffect(() => {
        navigation.dispatch(DrawerActions.openDrawer());
    }, [navigation]);

    return <GtkLabel>{`Inbox mounted ${initialStatus}`}</GtkLabel>;
};

const ResetFocusedRoute = (): ReactNode => {
    const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Reset Inbox</GtkLabel>
            <GtkButton
                label="Reset to settings"
                onClicked={() => {
                    navigation.reset({ ...navigation.getState(), index: 1 });
                }}
            />
        </GtkBox>
    );
};

const changingRoutesTree = (hasSettings: boolean): ReactNode => (
    <NavigationContainer>
        <Drawer.Navigator collapsed initialRouteName={hasSettings ? "Settings" : "Inbox"}>
            <Drawer.Screen name="Inbox" component={OpenDrawerOnMount} />
            {hasSettings ? drawerScreens([SETTINGS]) : null}
        </Drawer.Navigator>
    </NavigationContainer>
);

describe("drawer - status (1)", () => {
    it("closes and reopens the sidebar from the Toggle Sidebar button", async () => {
        const onStateChange = vi.fn();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        expect(lastState(onStateChange).type).toBe("drawer");
        expect(getDrawerStatus(lastState(onStateChange))).toBe("closed");
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        expect(getDrawerStatus(lastState(onStateChange))).toBe("open");
    });

    it("opens, closes and toggles the drawer through DrawerActions dispatched from a screen", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator defaultStatus="closed">{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Open drawer");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Close drawer");
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Toggle drawer");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Toggle drawer");
        expect(querySidebarLabel("Settings")).toBeNull();
    });
});

describe("drawer - status (2)", () => {
    it("starts with the sidebar hidden when defaultStatus is closed", async () => {
        const onStateChange = vi.fn();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator defaultStatus="closed">{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Inbox")).toBeNull();
        expect(splitView()).toHaveObjectProperty("show-sidebar", false);
        expect(onStateChange).not.toHaveBeenCalled();
    });

    it("starts closed when collapsed and overlays the content when opened", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).toBeNull();
        expect(splitView()).toHaveObjectProperty("collapsed", true);
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        expect(screen.getByText("Inbox Content")).toBeVisible();
        expect(splitView()).toHaveObjectProperty("show-sidebar", true);
    });

    it("switches content and closes the drawer when a screen navigates while collapsed", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Go to settings");
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Inbox Content")).toBeNull();
        expect(querySidebarLabel("Settings")).toBeNull();
    });
});

describe("drawer - status (3)", () => {
    it("returns to the initial status after toggling the sidebar twice", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Toggle drawer");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Toggle drawer");
        expect(querySidebarLabel("Settings")).toBeNull();
    });

    it("closes the drawer when the focused row is activated while collapsed", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(toggleButton());
        await userEvent.click(sidebarRow("Inbox"));
        await screen.findByText("Inbox Content");
        expect(screen.queryByText("Settings Content")).toBeNull();
        expect(querySidebarLabel("Inbox")).toBeNull();
    });

    it("closes the drawer when a row is activated while collapsed", async () => {
        const onStateChange = vi.fn();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(toggleButton());
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expect(querySidebarLabel("Inbox")).toBeNull();
        expect(getDrawerStatus(lastState(onStateChange))).toBe("closed");
    });
});

describe("drawer - changing routes", () => {
    it("closes before mounting the fallback route when the focused route disappears", async () => {
        const { rerender } = await render(changingRoutesTree(true));
        await screen.findByText("Settings Content");
        await userEvent.click(toggleButton());
        await rerender(changingRoutesTree(false));
        await screen.findByText("Inbox mounted closed");
        expect(querySidebarLabel("Inbox")).not.toBeNull();
        expect(querySidebarLabel("Settings")).toBeNull();
    });
});

describe("drawer - reset", () => {
    it("closes an open collapsed drawer when RESET changes the focused route", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>
                    <Drawer.Screen name="Inbox" component={ResetFocusedRoute} />
                    {drawerScreens([SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Reset Inbox");
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Reset to settings");
        await screen.findByText("Settings Content");
        expect(querySidebarLabel("Inbox")).toBeNull();
        expect(querySidebarLabel("Settings")).toBeNull();
    });
});

describe("drawer - child route focus", () => {
    it("closes an open overlay when an inactive child navigator takes focus", async () => {
        const focusSettings: { current: (() => void) | null } = { current: null };

        await render(
            <RouteFocusDrawer
                collapsed
                onReady={(focus) => {
                    focusSettings.current = focus;
                }}
            />,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(toggleButton());
        const focus = focusSettings.current;

        if (focus === null) {
            throw new TypeError("Expected the inactive child navigator to mount");
        }

        await act(() => {
            focus();
        });

        await screen.findByText("Route Focus Details");
        expect(querySidebarLabel("Inbox")).toBeNull();
        expect(querySidebarLabel("Settings")).toBeNull();
    });

    it("keeps an expanded sidebar shown when a child navigator takes focus", async () => {
        const focusSettings: { current: (() => void) | null } = { current: null };

        await render(
            <RouteFocusDrawer
                collapsed={false}
                onReady={(focus) => {
                    focusSettings.current = focus;
                }}
            />,
        );

        await screen.findByText("Inbox Content");
        const focus = focusSettings.current;

        if (focus === null) {
            throw new TypeError("Expected the inactive child navigator to mount");
        }

        await act(() => {
            focus();
        });

        await screen.findByText("Route Focus Details");
        expect(querySidebarLabel("Inbox")).not.toBeNull();
        expect(querySidebarLabel("Settings")).not.toBeNull();
    });
});
