import { NavigationContainer } from "@gtkx/navigation";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { RoutePage, Tabs, TabsApp } from "./helpers/tab-fixtures.js";

describe("tabs - errors", () => {
    it("throws for a navigator without screens", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Tabs.Navigator>{null}</Tabs.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws for a screen outside a navigator", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <RoutePage />
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws for an unknown initialRouteName", async () => {
        await expect(render(<TabsApp navigator={{ initialRouteName: "Missing" }} />)).rejects.toThrow();
    });
});
