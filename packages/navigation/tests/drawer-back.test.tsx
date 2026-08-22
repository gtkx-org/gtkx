import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    Drawer,
    drawerScreens,
    getDrawerStatus,
    INBOX,
    lastState,
    querySidebarLabel,
    SETTINGS,
    splitView,
    toggleButton,
} from "./helpers/drawer-fixtures.js";

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
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
        const onUnhandledAction = vi.fn();
        await renderDrawer(false, onUnhandledAction);
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Go back");
        expect(querySidebarLabel("Settings")).toBeNull();
        expect(onUnhandledAction).toHaveBeenCalledTimes(1);
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
        const onStateChange = vi.fn();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator collapsed>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        const view = splitView();

        await act(() => {
            view.setShowSidebar(true);
        });

        expect(getDrawerStatus(lastState(onStateChange))).toBe("open");

        await act(() => {
            view.setShowSidebar(false);
        });

        expect(getDrawerStatus(lastState(onStateChange))).toBe("closed");
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
