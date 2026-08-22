import { GtkLabel } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Drawer, drawerScreens, INBOX, SETTINGS } from "./helpers/drawer-fixtures.js";

describe("drawer - errors", () => {
    it("throws when the navigator has no screens", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Drawer.Navigator>{null}</Drawer.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when the navigator has a child that is not a screen", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Drawer.Navigator>
                        <GtkLabel label="Not a screen" />
                    </Drawer.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when the navigator is rendered outside a NavigationContainer", async () => {
        await expect(render(<Drawer.Navigator>{drawerScreens([INBOX])}</Drawer.Navigator>)).rejects.toThrow();
    });

    it("throws when initialRouteName names no screen", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Drawer.Navigator initialRouteName="Missing">{drawerScreens([INBOX, SETTINGS])}</Drawer.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });
});
