import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
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

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

describe("drawer - status", () => {
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
