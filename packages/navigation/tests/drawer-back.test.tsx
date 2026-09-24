import type { DrawerNavigationProp, ParamListBase } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { NavigationContainer, useNavigation } from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    Drawer,
    drawerScreens,
    getDrawerStatus,
    INBOX,
    lastState,
    querySidebarLabel,
    SETTINGS,
    splitView,
    type StateHistory,
    toggleButton,
} from "./helpers/drawer-fixtures.js";

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const ConsecutiveDrawerActions = (): ReactNode => {
    const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Inbox Content</GtkLabel>
            <GtkButton
                label="Open then close sidebar"
                onClicked={() => {
                    navigation.openDrawer();
                    navigation.closeDrawer();
                }}
            />
            <GtkButton
                label="Close then open sidebar"
                onClicked={() => {
                    navigation.closeDrawer();
                    navigation.openDrawer();
                }}
            />
        </GtkBox>
    );
};

const drawerTree = (isCollapsed: boolean): ReactNode => (
    <NavigationContainer>
        <Drawer.Navigator collapsed={isCollapsed}>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
    </NavigationContainer>
);

const renderDrawer = async (isCollapsed: boolean, onUnhandledAction?: () => void): Promise<void> => {
    await render(
        <NavigationContainer onUnhandledAction={onUnhandledAction}>
            <Drawer.Navigator collapsed={isCollapsed}>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
        </NavigationContainer>,
    );

    await screen.findByText("Inbox Content");
};

describe("drawer - going back", () => {
    it("leaves a closed sidebar closed when a screen goes back", async () => {
        let unhandledActions = 0;
        await renderDrawer(false, () => {
            unhandledActions += 1;
        });
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Go back");
        expect(querySidebarLabel("Settings")).toBeNull();
        expect(unhandledActions).toBe(1);
    });

    it("goes back through the screen history while the sidebar is closed", async () => {
        let unhandledActions = 0;
        await renderDrawer(false, () => {
            unhandledActions += 1;
        });
        await clickButton("Go to settings");
        await screen.findByText("Settings Content");
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Go back");
        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).toBeNull();
        expect(unhandledActions).toBe(0);
    });

    it("closes an overlaid sidebar when a screen goes back", async () => {
        await renderDrawer(true);
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Go back");
        expect(querySidebarLabel("Settings")).toBeNull();
    });
});

describe("drawer - collapsing", () => {
    it("keeps the sidebar and the state in step when collapsed changes", async () => {
        const { rerender } = await render(drawerTree(false));
        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await rerender(drawerTree(true));
        expect(querySidebarLabel("Settings")).toBeNull();
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Go to settings");
        await screen.findByText("Settings Content");
        expect(querySidebarLabel("Settings")).toBeNull();
    });
});

describe("drawer - sidebar sync", () => {
    it("follows the split view when the sidebar is dismissed outside navigation", async () => {
        const states: StateHistory = [];

        await render(
            <NavigationContainer
                onStateChange={(state) => {
                    states.push(state);
                }}
            >
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        const view = splitView();

        await act(() => {
            view.setShowSidebar(true);
        });

        expect(getDrawerStatus(lastState(states))).toBe("open");

        await act(() => {
            view.setShowSidebar(false);
        });

        expect(getDrawerStatus(lastState(states))).toBe("closed");
    });

    it("follows the latest consecutive drawer action before rendering", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>
                    <Drawer.Screen name="Inbox" component={ConsecutiveDrawerActions} />
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await clickButton("Open then close sidebar");
        expect(querySidebarLabel("Inbox")).toBeNull();
        await clickButton("Close then open sidebar");
        expect(querySidebarLabel("Inbox")).toBeVisible();
    });

    it("keeps the sidebar beside the content after navigating while not collapsed", async () => {
        await renderDrawer(false);
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await clickButton("Go to settings");
        await screen.findByText("Settings Content");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        expect(splitView()).toHaveObjectProperty("showSidebar", true);
    });
});
