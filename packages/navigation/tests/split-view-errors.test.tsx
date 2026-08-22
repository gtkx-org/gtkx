import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createSplitViewNavigator, NavigationContainer, useNavigation } from "@gtkx/navigation";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const Loose = createSplitViewNavigator();

const Page = (): ReactNode => <GtkLabel>Page Content</GtkLabel>;

const Detached = (): ReactNode => {
    const navigation = useNavigation();

    return <GtkLabel>{typeof navigation.goBack}</GtkLabel>;
};

describe("split view - error paths (1)", () => {
    it("throws when the navigator has no screens", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Loose.Navigator>{null}</Loose.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when the navigator renders outside a NavigationContainer", async () => {
        await expect(
            render(
                <Loose.Navigator>
                    <Loose.Screen name="Lists" component={Page} />
                    <Loose.Screen name="Tasks" component={Page} />
                </Loose.Navigator>,
            ),
        ).rejects.toThrow();
    });
});

describe("split view - error paths (2)", () => {
    it("throws when initialRouteName names no screen", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Loose.Navigator initialRouteName="Missing">
                        <Loose.Screen name="Lists" component={Page} />
                        <Loose.Screen name="Tasks" component={Page} />
                    </Loose.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });

    it("throws when a screen calls useNavigation outside any navigator", async () => {
        await expect(render(<Detached />)).rejects.toThrow();
    });
});
