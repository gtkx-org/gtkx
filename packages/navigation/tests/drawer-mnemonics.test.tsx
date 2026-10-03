import * as Gtk from "@gtkx/gi/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Drawer, drawerScreens, INBOX, SETTINGS, sidebarList, sidebarRow } from "./helpers/drawer-fixtures.js";

describe("drawer - mnemonics", () => {
    it("navigates with Alt and a title mnemonic", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator screenOptions={{ useUnderline: true }}>
                    {drawerScreens([INBOX, { ...SETTINGS, options: { title: "_Settings" } }])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        const content = await screen.findByText("Inbox Content");
        expect(within(sidebarList()).getByText("Settings")).toBeVisible();
        await userEvent.keyboard(content, "{Alt>}s{/Alt}");
        expect(await screen.findByText("Settings Content")).toBeVisible();
        expect(screen.queryByText("Inbox Content")).toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Settings"));
        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Settings" })).toBe(sidebarRow("Settings"));
    });

    it("uses drawerLabel mnemonics and displays escaped underscores", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([
                        INBOX,
                        {
                            ...SETTINGS,
                            options: { title: "_Other", drawerLabel: "_Files__and__folders", useUnderline: true },
                        },
                    ])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        const content = await screen.findByText("Inbox Content");
        expect(within(sidebarList()).getByText("Files_and_folders")).toBeVisible();
        await userEvent.keyboard(content, "{Alt>}o{/Alt}");
        expect(screen.getByText("Inbox Content")).toBeVisible();
        expect(screen.queryByText("Settings Content")).toBeNull();
        await userEvent.keyboard(content, "{Alt>}f{/Alt}");
        expect(await screen.findByText("Settings Content")).toBeVisible();
        expect(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Files_and_folders" }))
            .toBe(sidebarList().getSelectedRow());
    });

    it("keeps underscores literal and leaves mnemonics disabled by default", async () => {
        await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([INBOX, { ...SETTINGS, options: { drawerLabel: "_Settings__page" } }])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        const content = await screen.findByText("Inbox Content");
        const row = screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "_Settings__page" });
        expect(within(row).getByText("_Settings__page")).toBeVisible();
        await userEvent.keyboard(content, "{Alt>}s{/Alt}");
        expect(screen.getByText("Inbox Content")).toBeVisible();
        expect(screen.queryByText("Settings Content")).toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Inbox"));
        await userEvent.click(row);
        expect(await screen.findByText("Settings Content")).toBeVisible();
    });

    it("updates and disables the mnemonic when screen options change", async () => {
        const { rerender } = await render(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([INBOX, { ...SETTINGS, options: { drawerLabel: "_Settings", useUnderline: true } }])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        await screen.findByText("Inbox Content");
        expect(within(sidebarList()).getByText("Settings")).toBeVisible();
        await rerender(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([INBOX, { ...SETTINGS, options: { drawerLabel: "_Archive", useUnderline: true } }])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        expect(within(sidebarList()).getByText("Archive")).toBeVisible();
        await userEvent.keyboard(screen.getByText("Inbox Content"), "{Alt>}s{/Alt}");
        expect(screen.queryByText("Settings Content")).toBeNull();
        await userEvent.keyboard(screen.getByText("Inbox Content"), "{Alt>}a{/Alt}");
        expect(await screen.findByText("Settings Content")).toBeVisible();
        await userEvent.click(sidebarRow("Inbox"));
        await screen.findByText("Inbox Content");
        await rerender(
            <NavigationContainer>
                <Drawer.Navigator>
                    {drawerScreens([INBOX, { ...SETTINGS, options: { drawerLabel: "_Archive", useUnderline: false } }])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        expect(within(sidebarList()).getByText("_Archive")).toBeVisible();
        await userEvent.keyboard(screen.getByText("Inbox Content"), "{Alt>}a{/Alt}");
        expect(screen.getByText("Inbox Content")).toBeVisible();
        expect(screen.queryByText("Settings Content")).toBeNull();
    });

    it("keeps the current screen when its mnemonic press is prevented", async () => {
        let presses = 0;
        await render(
            <NavigationContainer>
                <Drawer.Navigator
                    screenListeners={{
                        drawerItemPress: (event) => {
                            presses += 1;
                            event.preventDefault();
                        },
                    }}
                >
                    {drawerScreens([INBOX, { ...SETTINGS, options: { drawerLabel: "_Settings", useUnderline: true } }])}
                </Drawer.Navigator>
            </NavigationContainer>,
        );
        await userEvent.keyboard(await screen.findByText("Inbox Content"), "{Alt>}s{/Alt}");
        await waitFor(() => {
            expect(presses).toBe(1);
        });
        expect(screen.getByText("Inbox Content")).toBeVisible();
        expect(screen.queryByText("Settings Content")).toBeNull();
        expect(sidebarList().getSelectedRow()).toBe(sidebarRow("Inbox"));
    });
});
