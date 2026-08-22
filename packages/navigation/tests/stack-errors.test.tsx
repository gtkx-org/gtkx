import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createStackNavigator, NavigationContainer } from "@gtkx/navigation";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Orphan, Stack } from "./helpers/stack-fixtures.js";

const Loose = createStackNavigator();

const Page = (): ReactNode => <GtkLabel>Page Content</GtkLabel>;

describe("stack - error paths (1)", () => {
    it("throws when a screen renders outside a navigator", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Orphan />
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when a navigator renders outside a container", async () => {
        await expect(
            render(
                <Stack.Navigator>
                    <Stack.Screen name="Home" component={Page} />
                </Stack.Navigator>,
            ),
        ).rejects.toThrow();
    });

    it("throws when a navigator has no screens", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Stack.Navigator>{null}</Stack.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });
});

describe("stack - error paths (2)", () => {
    it("throws when initialRouteName does not exist", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Loose.Navigator initialRouteName="Missing">
                        <Loose.Screen name="Home" component={Page} />
                    </Loose.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when two navigators share a container without a screen", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Stack.Navigator>
                        <Stack.Screen name="Home" component={Page} />
                    </Stack.Navigator>
                    <Stack.Navigator>
                        <Stack.Screen name="Details" component={Page} />
                    </Stack.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });
});
