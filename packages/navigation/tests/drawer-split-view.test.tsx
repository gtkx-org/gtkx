import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Drawer, drawerScreens, INBOX, SETTINGS, splitView } from "./helpers/drawer-fixtures.js";

describe("drawer - split view", () => {
    it("places the sidebar at the end when sidebarPosition is end", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator sidebarPosition="end">{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(splitView()).toHaveObjectProperty("sidebar-position", Gtk.PackType.END);
    });

    it("places the sidebar at the start by default", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(splitView()).toHaveObjectProperty("sidebar-position", Gtk.PackType.START);
        expect(splitView()).toHaveObjectProperty("collapsed", false);
        expect(splitView()).toHaveObjectProperty("show-sidebar", true);
    });

    it("applies pinSidebar and the sidebar width props", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator pinSidebar minSidebarWidth={200} maxSidebarWidth={320} sidebarWidthFraction={0.3}>
                    {drawerScreens([INBOX, SETTINGS])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Inbox Content");
        expect(splitView()).toHaveObjectProperty("pin-sidebar", true);
        expect(splitView()).toHaveObjectProperty("min-sidebar-width", 200);
        expect(splitView()).toHaveObjectProperty("max-sidebar-width", 320);
        expect(splitView()).toHaveObjectProperty("sidebar-width-fraction", 0.3);
    });
});
