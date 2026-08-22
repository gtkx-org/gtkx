import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    Details,
    DrawerWithStack,
    expectText,
    FocusLabel,
    FocusTracker,
    NestedStack,
    PlainTabs,
    Stack,
    StackWithTabs,
    TabsWithStack,
} from "./helpers/container-fixtures.js";

const DoubleNavigators = (): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <NestedStack />
        <PlainTabs />
    </GtkBox>
);

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const clickTab = async (name: string): Promise<void> => {
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name }));
};

describe("nesting - stack inside tabs", () => {
    it("keeps the switcher while pushing inside a tab", async () => {
        await render(
            <NavigationContainer>
                <TabsWithStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        await clickButton("Go to details");
        await screen.findByText("Details 42");
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "First Tab" });
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Second Tab" });
        await clickButton("Back");
        await expectText("Home Content");
    });

    it("keeps the nested stack state when switching tabs and back", async () => {
        await render(
            <NavigationContainer>
                <TabsWithStack />
            </NavigationContainer>,
        );

        await clickButton("Go to details");
        await screen.findByText("Details 42");
        await clickTab("Second Tab");
        await screen.findByText("Second Content");
        expect(screen.queryByText("Details 42")).toBeNull();
        await clickTab("First Tab");
        await screen.findByText("Details 42");
        expect(screen.queryByText("Home Content")).toBeNull();
    });

    it("reaches the parent navigator through getParent", async () => {
        await render(
            <NavigationContainer>
                <TabsWithStack />
            </NavigationContainer>,
        );

        await screen.findByText("Parent: present");
        await clickButton("Switch to second");
        await screen.findByText("Second Content");
        expect(screen.queryByText("Home Content")).toBeNull();
    });
});

describe("nesting - tabs inside a stack", () => {
    it("shows only the tab header when the stack screen hides its header", async () => {
        await render(
            <NavigationContainer>
                <StackWithTabs />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "First Tab" });
        expect(screen.queryByText("Main")).toBeNull();
        await clickButton("Go to details");
        await screen.findByText("Details 42");
        expect(screen.queryByRole(Gtk.AccessibleRole.TAB, { name: "First Tab" })).toBeNull();
        await clickButton("Back");
        await screen.findByText("Home Content");
        await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "First Tab" });
    });

    it("navigates to a nested screen with params through the parent", async () => {
        await render(
            <NavigationContainer>
                <StackWithTabs />
            </NavigationContainer>,
        );

        await clickButton("Go to details");
        await clickButton("Go to second tab");
        await screen.findByText("Second 5");
        expect(screen.queryByText("Details 42")).toBeNull();
        await clickTab("First Tab");
        await screen.findByText("Home Content");
    });
});

describe("nesting - drawer containing a stack", () => {
    it("keeps the sidebar visible after navigating from it when not collapsed", async () => {
        await render(
            <NavigationContainer>
                <DrawerWithStack />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        await userEvent.click(screen.getByText("Settings Row"));
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Home Content")).toBeNull();
        await userEvent.click(screen.getByText("Inbox Row"));
        await screen.findByText("Home Content");
    });

    it("returns to the stack root when navigating between drawer routes", async () => {
        await render(
            <NavigationContainer>
                <DrawerWithStack collapsed />
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        await clickButton("Toggle Sidebar");
        await userEvent.click(await screen.findByText("Settings Row"));
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Home Content")).toBeNull();
        await clickButton("Toggle Sidebar");
        await userEvent.click(await screen.findByText("Inbox Row"));
        await screen.findByText("Home Content");
        expect(screen.queryByText("Details 42")).toBeNull();
    });

    it("opens the collapsed sidebar after pushing inside the stack", async () => {
        await render(
            <NavigationContainer>
                <DrawerWithStack collapsed />
            </NavigationContainer>,
        );

        await clickButton("Go to details");
        await screen.findByText("Details 42");
        expect(screen.queryByText("Settings Row")).toBeNull();
        await clickButton("Toggle Sidebar");
        await userEvent.click(await screen.findByText("Settings Row"));
        await screen.findByText("Settings Content");
        await clickButton("Toggle Sidebar");
        await userEvent.click(await screen.findByText("Inbox Row"));
        await screen.findByText("Details 42");
    });
});

describe("nesting - focus", () => {
    it("runs useFocusEffect on focus and its cleanup on blur", async () => {
        const onFocus = vi.fn();
        const onBlur = vi.fn();

        await render(
            <NavigationContainer>
                <Stack.Navigator>
                    <Stack.Screen name="Home">{() => <FocusTracker onFocus={onFocus} onBlur={onBlur} />}</Stack.Screen>
                    <Stack.Screen name="Details" component={Details} />
                </Stack.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Home Content");
        expect(onFocus).toHaveBeenCalledTimes(1);
        expect(onBlur).not.toHaveBeenCalled();
        await clickButton("Go to details");
        await screen.findByText("Details 42");
        expect(onBlur).toHaveBeenCalledTimes(1);
        await clickButton("Back");
        await screen.findByText("Home Content");
        expect(onFocus).toHaveBeenCalledTimes(2);
    });

    it("reflects the focused page through useIsFocused", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(
            <NavigationContainer>
                <Stack.Navigator>
                    <Stack.Screen name="Home">{() => <FocusLabel labelRef={labelRef} />}</Stack.Screen>
                    <Stack.Screen name="Details" component={Details} />
                </Stack.Navigator>
            </NavigationContainer>,
        );

        await screen.findByText("Home focused: true");
        await clickButton("Go to details");
        await screen.findByText("Details 42");
        expect(labelRef.current).toHaveObjectProperty("label", "Home focused: false");
        await clickButton("Back");
        await screen.findByText("Home focused: true");
    });
});

describe("nesting - errors", () => {
    it("throws when a screen renders two navigators side by side", async () => {
        await expect(
            render(
                <NavigationContainer>
                    <Stack.Navigator>
                        <Stack.Screen name="Home" component={DoubleNavigators} />
                    </Stack.Navigator>
                </NavigationContainer>,
            ),
        ).rejects.toThrow();
    });
});
