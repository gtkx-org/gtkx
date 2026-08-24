import type { NavigationState } from "@gtkx/navigation";
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

const recordState = (states: NavigationState[]): ((state: NavigationState | undefined) => void) =>
    (state) => {
        if (state !== undefined) {
            states.push(state);
        }
    };

const latestState = (states: readonly NavigationState[]): NavigationState => {
    const state = states.at(-1);

    if (state === undefined) {
        throw new Error("No navigation state was reported");
    }

    return state;
};

const drawerTree = (
    isCollapsed: boolean,
    onStateChange?: (state: NavigationState | undefined) => void,
    isPinned = false,
    defaultStatus?: "closed" | "open",
): ReactNode => (
    <NavigationContainer onStateChange={onStateChange}>
        <Drawer.Navigator collapsed={isCollapsed} pinSidebar={isPinned} defaultStatus={defaultStatus}>
            {drawerScreens([INBOX, SETTINGS])}
        </Drawer.Navigator>
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

    it("goes back through the screen history while the sidebar is closed", async () => {
        const onUnhandledAction = vi.fn();
        await renderDrawer(false, onUnhandledAction);
        await clickButton("Go to settings");
        await screen.findByText("Settings Content");
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        await clickButton("Go back");
        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).toBeNull();
        expect(onUnhandledAction).not.toHaveBeenCalled();
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

    it("closes and reopens through one declarative state transition", async () => {
        const states: NavigationState[] = [];
        const onStateChange = recordState(states);
        const { rerender } = await render(drawerTree(false, onStateChange));
        await screen.findByText("Inbox Content");
        states.length = 0;
        await rerender(drawerTree(true, onStateChange));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("closed");
        expect(querySidebarLabel("Settings")).toBeNull();
        states.length = 0;
        await rerender(drawerTree(false, onStateChange));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("open");
        expect(querySidebarLabel("Settings")).not.toBeNull();
    });

    it("preserves the drawer status while the sidebar is pinned", async () => {
        const states: NavigationState[] = [];
        const onStateChange = recordState(states);
        const { rerender } = await render(drawerTree(false, onStateChange, true));
        await screen.findByText("Inbox Content");
        states.length = 0;
        await rerender(drawerTree(true, onStateChange, true));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("open");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        states.length = 0;
        await rerender(drawerTree(false, onStateChange, true));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("open");
        expect(querySidebarLabel("Settings")).not.toBeNull();
    });
});

describe("drawer - pinning changes", () => {
    it("applies the current collapse policy when pinning changes", async () => {
        const states: NavigationState[] = [];
        const onStateChange = recordState(states);
        const { rerender } = await render(drawerTree(false, onStateChange, true));
        await screen.findByText("Inbox Content");
        await rerender(drawerTree(true, onStateChange, true));
        expect(querySidebarLabel("Settings")).not.toBeNull();
        states.length = 0;
        await rerender(drawerTree(true, onStateChange, false));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("closed");
        expect(querySidebarLabel("Settings")).toBeNull();
        await rerender(drawerTree(false, onStateChange, false));
        expect(querySidebarLabel("Settings")).not.toBeNull();
        await rerender(drawerTree(false, onStateChange, true));
        await userEvent.click(toggleButton());
        expect(querySidebarLabel("Settings")).toBeNull();
        states.length = 0;
        await rerender(drawerTree(false, onStateChange, false));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("open");
        expect(querySidebarLabel("Settings")).not.toBeNull();
    });

    it("uses the incoming pin policy when collapse changes in the same render", async () => {
        const states: NavigationState[] = [];
        const onStateChange = recordState(states);
        const { rerender } = await render(drawerTree(false, onStateChange));
        await screen.findByText("Inbox Content");
        states.length = 0;
        await rerender(drawerTree(true, onStateChange, true));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("open");
        expect(querySidebarLabel("Settings")).not.toBeNull();
    });
});

describe("drawer - collapsing with a closed default", () => {
    it("shows on expansion and hides on collapse", async () => {
        const states: NavigationState[] = [];
        const onStateChange = recordState(states);
        const { rerender } = await render(drawerTree(true, onStateChange, false, "closed"));
        await screen.findByText("Inbox Content");
        expect(querySidebarLabel("Settings")).toBeNull();
        states.length = 0;
        await rerender(drawerTree(false, onStateChange, false, "closed"));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("open");
        expect(querySidebarLabel("Settings")).not.toBeNull();
        states.length = 0;
        await rerender(drawerTree(true, onStateChange, false, "closed"));
        expect(states).toHaveLength(1);
        expect(getDrawerStatus(latestState(states))).toBe("closed");
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
