import type { DrawerContentProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { DrawerItemList, NavigationContainer } from "@gtkx/navigation";
import { fireEvent, render, screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    ARCHIVE,
    Drawer,
    drawerScreens,
    INBOX,
    querySidebarLabel,
    SETTINGS,
    sidebarList,
    sidebarRow,
} from "./helpers/drawer-fixtures.js";

const LABELLED_SCREENS = [
    { ...INBOX, options: { drawerLabel: "Mail", title: "Inbox Title" } },
    { ...SETTINGS, options: { title: "Preferences" } },
    ARCHIVE,
];

const CustomContent = (props: DrawerContentProps): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel label={`Routes: ${String(props.state.routes.length)}`} />
        <DrawerItemList {...props} />
    </GtkBox>
);

describe("drawer - sidebar", () => {
    it("lists every route labelled by drawerLabel, then title, then name", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens(LABELLED_SCREENS)}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(sidebarRow("Mail").getIndex()).toBe(0);
        expect(sidebarRow("Preferences").getIndex()).toBe(1);
        expect(sidebarRow("Archive").getIndex()).toBe(2);
        expect(querySidebarLabel("Inbox Title")).toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Mail"));
    });

    it("shows the activated row's screen and hides the previous one", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Inbox Content")).toBeNull();
    });

    it("navigates when the list emits row-activated", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([INBOX, SETTINGS, ARCHIVE])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await fireEvent(sidebarList(), "row-activated", sidebarRow("Archive"));
        await screen.findByText("Archive Content");
        expect(screen.queryByText("Inbox Content")).toBeNull();
    });

    it("renders drawerIcon as an image in the row", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([{ ...INBOX, options: { drawerIcon: "mail-unread-symbolic" } }, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        const image = within(sidebarRow("Inbox")).getByRole(Gtk.AccessibleRole.IMG);
        expect(image).toHaveObjectProperty("icon-name", "mail-unread-symbolic");
        expect(within(sidebarRow("Settings")).queryByRole(Gtk.AccessibleRole.IMG)).toBeNull();
    });

    it("hands state, navigation and descriptors to a custom drawerContent", async () => {
        const drawerContent = vi.fn(CustomContent);

        await render(
            <NavigationContainer>
                <Drawer.Navigator drawerContent={drawerContent}>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Routes: 2");
        const props = drawerContent.mock.calls[0]?.[0];
        expect(Object.keys(props?.descriptors ?? {})).toEqual(props?.state.routes.map((route) => route.key));
        expect(props?.navigation.getState().routeNames).toEqual(["Inbox", "Settings"]);
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
    });

    it("keeps the sidebar shown after a row is activated when not collapsed", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Settings"));
        await screen.findByText("Settings Content");
        expect(querySidebarLabel("Inbox")).not.toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Settings"));
    });

    it("updates the row when drawerLabel changes", async () => {
        const { rerender } = await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([{ ...INBOX, options: { drawerLabel: "Mail" } }, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(sidebarRow("Mail").getIndex()).toBe(0);

        await rerender(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([{ ...INBOX, options: { drawerLabel: "Letters" } }, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        expect(sidebarRow("Letters").getIndex()).toBe(0);
        expect(querySidebarLabel("Mail")).toBeNull();
    });

    it("renders a drawer with a single screen", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([INBOX])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(sidebarRow("Inbox").getIndex()).toBe(0);
        await userEvent.click(sidebarRow("Inbox"));
        await screen.findByText("Inbox Content");
    });

    it("keeps the screen when the focused row is activated", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        await userEvent.click(sidebarRow("Inbox"));
        await screen.findByText("Inbox Content");
        expect(screen.queryByText("Settings Content")).toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Inbox"));
    });
});
