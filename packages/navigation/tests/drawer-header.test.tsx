import type { DrawerHeaderProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    Drawer,
    drawerScreens,
    expectHeaderTitle,
    INBOX,
    MountSpy,
    SETTINGS,
    sidebarRow,
    toggleButton,
} from "./helpers/drawer-fixtures.js";

const HIDDEN_HEADER = { headerShown: false, title: "Inbox Title", drawerLabel: "Mail" };

const CustomHeader = ({ route, navigation, options }: DrawerHeaderProps): ReactNode => (
    <GtkBox>
        <GtkLabel label={`Custom ${route.name} ${options.title ?? ""}`} />
        <GtkButton
            label="Header settings"
            onClicked={() => {
                navigation.navigate("Settings");
            }}
        />
    </GtkBox>
);

describe("drawer - header", () => {
    it("shows the focused screen's title and the toggle button", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([{ ...INBOX, options: { title: "Inbox Title" } }, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expectHeaderTitle("Inbox Title");
        expect(toggleButton()).toBeVisible();
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expectHeaderTitle("Settings");
    });

    it("hides the header bar when headerShown is false", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([{ ...INBOX, options: HIDDEN_HEADER }, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Toggle Sidebar" })).toBeNull();
        expect(screen.queryByText("Inbox Title")).toBeNull();
    });

    it("replaces the title with headerTitle as a string or an element", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([
                        { ...INBOX, options: { ...HIDDEN_HEADER, headerShown: true, headerTitle: "Custom Title" } },
                        { ...SETTINGS, options: { headerTitle: <GtkLabel label="Title Widget" /> } },
                    ])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expectHeaderTitle("Custom Title");
        expect(screen.queryByText("Inbox Title")).toBeNull();
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expectHeaderTitle("Title Widget");
    });

    it("packs headerStart and headerEnd beside the toggle button", async () => {
        const options = {
            headerStart: <GtkButton label="Start action" />,
            headerEnd: <GtkButton label="End action" />,
        };

        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([{ ...INBOX, options }, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Start action" })).toBeVisible();
        expect(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "End action" })).toBeVisible();
        expect(toggleButton()).toBeVisible();
    });

    it("renders a custom header with the route, navigation and options", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([{ ...INBOX, options: { title: "Inbox Title", header: CustomHeader } }, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Custom Inbox Inbox Title");
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Toggle Sidebar" })).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Header settings" }));
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Custom Inbox Inbox Title")).toBeNull();
    });

    it("mounts screens on first focus by default", async () => {
        const onInboxMount = vi.fn();
        const onSettingsMount = vi.fn();

        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    <Drawer.Screen name="Inbox">
                        {() => <MountSpy text="Inbox Content" onMount={onInboxMount} />}
                    </Drawer.Screen>
                    <Drawer.Screen name="Settings">
                        {() => <MountSpy text="Settings Content" onMount={onSettingsMount} />}
                    </Drawer.Screen>
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(onInboxMount).toHaveBeenCalled();
        expect(onSettingsMount).not.toHaveBeenCalled();
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expect(onSettingsMount).toHaveBeenCalled();
    });

    it("mounts a screen at startup when lazy is false", async () => {
        const onSettingsMount = vi.fn();

        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([INBOX])}
                    <Drawer.Screen name="Settings" options={{ lazy: false }}>
                        {() => <MountSpy text="Settings Content" onMount={onSettingsMount} />}
                    </Drawer.Screen>
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(onSettingsMount).toHaveBeenCalled();
        expect(screen.queryByText("Settings Content")).toBeNull();
    });
});
