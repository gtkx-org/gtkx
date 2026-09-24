import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import {
    createDrawerNavigator,
    createNavigationContainerRef,
    createTabNavigator,
    NavigationContainer,
} from "@gtkx/navigation";
import { act, render, screen } from "@gtkx/testing";
import { expect, test } from "vitest";
import { MountProbe } from "./helpers/tab-fixtures.js";

type Params = { First: undefined; Second: undefined };

const Tabs = createTabNavigator<Params>();
const Drawer = createDrawerNavigator<Params>();
const First = (): ReactNode => <GtkLabel>First Content</GtkLabel>;

test.each(["tabs", "drawer"])("a removed %s route starts lazy again when its saved key returns", async (kind) => {
    let mounts = 0;
    const onMount = (): void => {
        mounts += 1;
    };
    const renderSecond = (): ReactNode => <MountProbe text="Second Content" onMount={onMount} />;
    const ref = createNavigationContainerRef<Params>();
    const routes = [{ key: "first", name: "First" }, { key: "second", name: "Second" }];

    await render(
        <NavigationContainer ref={ref} initialState={{ index: 1, routes }}>
            {kind === "tabs"
                ? (
                        <Tabs.Navigator>
                            <Tabs.Screen name="First" component={First} />
                            <Tabs.Screen name="Second">{renderSecond}</Tabs.Screen>
                        </Tabs.Navigator>
                    )
                : (
                        <Drawer.Navigator>
                            <Drawer.Screen name="First" component={First} />
                            <Drawer.Screen name="Second">{renderSecond}</Drawer.Screen>
                        </Drawer.Navigator>
                    )}
        </NavigationContainer>,
    );

    await screen.findByText("Second Content");
    expect(mounts).toBe(1);
    await act(() => {
        ref.resetRoot({ index: 0, routes: [{ key: "first", name: "First" }] });
    });
    await screen.findByText("First Content");
    await act(() => {
        ref.resetRoot({ index: 0, routes });
    });
    expect(mounts).toBe(1);
    expect(screen.queryByText("Second Content")).toBeNull();

    await act(() => {
        ref.navigate("Second");
    });
    await screen.findByText("Second Content");
    expect(mounts).toBe(2);
});
