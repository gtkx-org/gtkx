import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    ARCHIVE,
    Drawer,
    drawerScreens,
    INBOX,
    lastState,
    NestedStackScreen,
    routeKey,
    SETTINGS,
    sidebarList,
    sidebarRow,
    toggleButton,
} from "./helpers/drawer-fixtures.js";

type TargetEvent = { target?: string };

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

describe("drawer - events (1)", () => {
    it("emits drawerItemPress targeted at the activated route", async () => {
        const onStateChange = vi.fn();
        const onItemPress = vi.fn<(event: TargetEvent) => void>();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator screenListeners={{ drawerItemPress: onItemPress }}>
                    {drawerScreens([INBOX, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expect(onItemPress).toHaveBeenCalledTimes(1);
        expect(onItemPress.mock.calls[0]?.[0].target).toBe(routeKey(lastState(onStateChange), "Settings"));
    });

    it("keeps the current screen and row when drawerItemPress is prevented", async () => {
        const onStateChange = vi.fn();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator
                    screenListeners={{
                        drawerItemPress: (event) => {
                            event.preventDefault();
                        },
                    }}
                >
                    {drawerScreens([INBOX, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        expect(screen.getByText("Inbox Content")).toBeVisible();
        expect(screen.queryByText("Settings Content")).toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Inbox"));
        expect(onStateChange).not.toHaveBeenCalled();
    });
});

describe("drawer - events (2)", () => {
    it("emits blur on the previous route and focus on the next one", async () => {
        const onStateChange = vi.fn();
        const onFocus = vi.fn<(event: TargetEvent) => void>();
        const onBlur = vi.fn<(event: TargetEvent) => void>();

        await render(
            <NavigationContainer onStateChange={onStateChange}>
                <Drawer.Navigator screenListeners={{ focus: onFocus, blur: onBlur }}>
                    {drawerScreens([INBOX, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        const state = lastState(onStateChange);
        expect(onBlur).toHaveBeenCalledTimes(1);
        expect(onBlur.mock.calls[0]?.[0].target).toBe(routeKey(state, "Inbox"));
        expect(onFocus.mock.lastCall?.[0].target).toBe(routeKey(state, "Settings"));
    });

    it("pops a nested stack to its first screen on blur with popToTopOnBlur", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed>
                    <Drawer.Screen name="Inbox" component={NestedStackScreen} options={{ popToTopOnBlur: true }} />
                    {drawerScreens([SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Nested Home");
        await clickButton("Go to details");
        await screen.findByText("Nested Details");
        await userEvent.click(toggleButton());
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        await userEvent.click(toggleButton());
        await userEvent.click(sidebarRow("Inbox"));
        await screen.findByText("Nested Home");
        expect(screen.queryByText("Nested Details")).toBeNull();
    });
});

describe("drawer - events (3)", () => {
    it("returns to the previously focused screen on goBack with backBehavior history", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator collapsed backBehavior="history">
                    {drawerScreens([INBOX, SETTINGS, ARCHIVE])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(toggleButton());
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        await userEvent.click(toggleButton());
        await userEvent.click(sidebarRow("Archive"));
        await screen.findByText("Archive Content");
        await clickButton("Go back");
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Archive Content")).toBeNull();
        await clickButton("Go back");
        await screen.findByText("Inbox Content");
    });
});
