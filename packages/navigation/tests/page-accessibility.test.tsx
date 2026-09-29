import type { NavigationProp } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import {
    CommonActions,
    createDrawerNavigator,
    createTabNavigator,
    NavigationContainer,
    useNavigation,
} from "@gtkx/navigation";
import { getHandle, t } from "@gtkx/runtime";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { expect, test } from "vitest";
import { sidebarRow } from "./helpers/drawer-fixtures.js";
import { getAncestor } from "./helpers/widget-ancestors.js";

type Routes = { First: undefined; Second: undefined };
type Kind = "tabs" | "drawer";
type Preventable = { preventDefault: () => void };
type AppProps = { kind: Kind; lazy?: boolean; preventSwitch?: boolean };

const Tabs = createTabNavigator<Routes>();
const Drawer = createDrawerNavigator<Routes>();
const checkState = t.fn("libgtk-4.so.1", "gtk_test_accessible_check_state", {
    args: [{ type: t.object("borrowed") }, { type: t.int32 }, { type: t.int32 }],
    returns: t.string("full"),
    fixedArgCount: 2,
});

const First = (): ReactNode => {
    const navigation = useNavigation<NavigationProp<Routes>>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>First Content</GtkLabel>
            <GtkButton
                label="Open Second"
                onClicked={() => {
                    navigation.navigate("Second");
                }}
            />
            <GtkButton
                label="Preload Second"
                onClicked={() => {
                    navigation.dispatch(CommonActions.preload("Second"));
                }}
            />
        </GtkBox>
    );
};

const Second = (): ReactNode => {
    const navigation = useNavigation<NavigationProp<Routes>>();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>Second Content</GtkLabel>
            <GtkButton
                label="Return First"
                onClicked={() => {
                    navigation.navigate("First");
                }}
            />
        </GtkBox>
    );
};

const prevent = (event: Preventable): void => {
    event.preventDefault();
};

const App = ({ kind, lazy = true, preventSwitch = false }: AppProps): ReactNode => (
    <NavigationContainer>
        {kind === "tabs"
            ? (
                    <Tabs.Navigator screenOptions={{ lazy }}>
                        <Tabs.Screen name="First" component={First} />
                        <Tabs.Screen
                            name="Second"
                            component={Second}
                            listeners={preventSwitch ? { tabPress: prevent } : undefined}
                        />
                    </Tabs.Navigator>
                )
            : (
                    <Drawer.Navigator screenOptions={{ lazy }}>
                        <Drawer.Screen name="First" component={First} />
                        <Drawer.Screen
                            name="Second"
                            component={Second}
                            listeners={preventSwitch ? { drawerItemPress: prevent } : undefined}
                        />
                    </Drawer.Navigator>
                )}
    </NavigationContainer>
);

const expectAccessiblePage = async (title: string): Promise<void> => {
    const content = await screen.findByText(`${title} Content`);
    const stack = getAncestor(content, Adw.ViewStack);

    await waitFor(() => {
        const pages = stack.getPages();
        expect(pages.getNItems()).toBe(2);

        for (let index = 0; index < pages.getNItems(); index += 1) {
            const page = pages.getItem(index);

            if (!(page instanceof Adw.ViewStackPage)) {
                throw new TypeError("Expected a native view stack page");
            }

            const hidden = Number(page.getTitle() !== title);
            expect(checkState(getHandle(page), Gtk.AccessibleState.HIDDEN, hidden)).toBeNull();
        }
    });
};

test.each(["tabs", "drawer"] as const)("%s exposes only the focused lazy page to accessibility", async (kind) => {
    await render(<App kind={kind} />);
    await expectAccessiblePage("First");
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open Second" }));
    await expectAccessiblePage("Second");
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Return First" }));
    await expectAccessiblePage("First");
});

test.each(["tabs", "drawer"] as const)("%s keeps eagerly loaded pages hidden until focused", async (kind) => {
    await render(<App kind={kind} lazy={false} />);
    await expectAccessiblePage("First");
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open Second" }));
    await expectAccessiblePage("Second");
});

test.each(["tabs", "drawer"] as const)("%s preloads a page without exposing it to accessibility", async (kind) => {
    await render(<App kind={kind} />);
    await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Preload Second" }));
    await expectAccessiblePage("First");
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Open Second" }));
    await expectAccessiblePage("Second");
});

test.each(["tabs", "drawer"] as const)("%s preserves accessibility when a route change is refused", async (kind) => {
    await render(<App kind={kind} preventSwitch />);
    await expectAccessiblePage("First");
    const target = kind === "tabs"
        ? screen.getByRole(Gtk.AccessibleRole.TAB, { name: "Second" })
        : sidebarRow("Second");
    await userEvent.click(target);
    await expectAccessiblePage("First");
});
