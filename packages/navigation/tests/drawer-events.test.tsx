import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
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
    type StateHistory,
    toggleButton,
} from "./helpers/drawer-fixtures.js";

type TargetEvent = { target?: string };

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

describe("drawer - events", () => {
    it("emits drawerItemPress targeted at the activated route", async () => {
        const states: StateHistory = [];
        const itemPressTargets: (string | undefined)[] = [];

        await render(
            <NavigationContainer
                onStateChange={(state) => {
                    states.push(state);
                }}
            >
                <Drawer.Navigator
                    screenListeners={{
                        drawerItemPress: (event: TargetEvent) => {
                            itemPressTargets.push(event.target);
                        },
                    }}
                >
                    {drawerScreens([INBOX, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expect(itemPressTargets).toEqual([routeKey(lastState(states), "Settings")]);
    });

    it("keeps the current screen and row when drawerItemPress is prevented", async () => {
        const states: StateHistory = [];

        await render(
            <NavigationContainer
                onStateChange={(state) => {
                    states.push(state);
                }}
            >
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
        expect(states).toEqual([]);
    });

    it("emits blur on the previous route and focus on the next one", async () => {
        const states: StateHistory = [];
        const focusTargets: (string | undefined)[] = [];
        const blurTargets: (string | undefined)[] = [];

        await render(
            <NavigationContainer
                onStateChange={(state) => {
                    states.push(state);
                }}
            >
                <Drawer.Navigator
                    screenListeners={{
                        focus: (event: TargetEvent) => {
                            focusTargets.push(event.target);
                        },
                        blur: (event: TargetEvent) => {
                            blurTargets.push(event.target);
                        },
                    }}
                >
                    {drawerScreens([INBOX, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        const state = lastState(states);
        expect(blurTargets).toEqual([routeKey(state, "Inbox")]);
        expect(focusTargets.at(-1)).toBe(routeKey(state, "Settings"));
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
