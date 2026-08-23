import type { NavigationState } from "@gtkx/navigation";
import * as Gtk from "@gtkx/gi/gtk";
import {
    CommonActions,
    createDrawerNavigator,
    createDrawerScreen,
    createNavigationContainerRef,
    createStackNavigator,
    createStackScreen,
    createStaticNavigation,
    createTabNavigator,
    createTabScreen,
} from "@gtkx/navigation";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    expectText,
    FirstTabPage,
    InboxPage,
    SecondTabPage,
    SettingsPage,
    StaticDetails,
    StaticHome,
} from "./helpers/container-fixtures.js";

const RootStack = createStackNavigator({
    screens: {
        Home: StaticHome,
        Details: { screen: StaticDetails, options: { title: "Details Page" } },
    },
});

const TypedStack = createStackNavigator({
    screens: {
        Home: createStackScreen({ screen: StaticHome, options: { title: "Typed Home" } }),
        Details: createStackScreen({ screen: StaticDetails, options: { headerTitle: "Typed Details" } }),
    },
});

const StaticTabs = createTabNavigator({
    screens: {
        First: createTabScreen({ screen: FirstTabPage, options: { title: "First Tab" } }),
        Second: createTabScreen({ screen: SecondTabPage, options: { title: "Second Tab" } }),
    },
});

const StaticDrawer = createDrawerNavigator({
    screens: {
        Inbox: createDrawerScreen({ screen: InboxPage, options: { drawerLabel: "Inbox Row" } }),
        Settings: createDrawerScreen({ screen: SettingsPage, options: { drawerLabel: "Settings Row" } }),
    },
});

const GatedStack = createStackNavigator({
    screens: {
        Home: StaticHome,
        Details: { screen: StaticDetails, if: () => false },
    },
});

const NestedStack = createStackNavigator({
    screens: {
        Main: { screen: StaticTabs, options: { headerShown: false } },
        Details: StaticDetails,
    },
});

const App = createStaticNavigation(RootStack);
const TypedApp = createStaticNavigation(TypedStack);
const TabsApp = createStaticNavigation(StaticTabs);
const DrawerApp = createStaticNavigation(StaticDrawer);
const GatedApp = createStaticNavigation(GatedStack);
const NestedApp = createStaticNavigation(NestedStack);

describe("static - navigation", () => {
    it("renders the static stack and navigates from a screen", async () => {
        await render(<App />);
        await screen.findByText("Home Content");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 42");
        await screen.findByText("Details Page");
        expect(screen.queryByText("Home Content")).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await screen.findByText("Home Content");
    });

    it("accepts onStateChange and a ref", async () => {
        const onStateChange = vi.fn<(state: NavigationState | undefined) => void>();
        const ref = createNavigationContainerRef();
        await render(<App onStateChange={onStateChange} ref={ref} />);
        await screen.findByText("Home Content");
        expect(ref.isReady()).toBe(true);

        await act(() => {
            ref.dispatch(CommonActions.navigate("Details", { id: "5" }));
        });

        await screen.findByText("Details 5");
        expect(onStateChange).toHaveBeenCalledTimes(1);

        expect(onStateChange.mock.calls[0]?.[0]).toMatchObject({
            index: 1,
            routes: [{ name: "Home" }, { name: "Details", params: { id: "5" } }],
        });
    });
});

describe("static - screen factories", () => {
    it("applies a createStackScreen config", async () => {
        await render(<TypedApp />);
        await screen.findByText("Typed Home");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 42");
        await expectText("Typed Details");
    });

    it("applies a createTabScreen config", async () => {
        await render(<TabsApp />);
        await screen.findByText("First Content");
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Second Tab" }));
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" });
        expect(screen.queryByText("First Content")).toBeNull();
    });

    it("applies a createDrawerScreen config", async () => {
        await render(<DrawerApp />);
        await screen.findByText("Inbox Content");
        await userEvent.click(screen.getByText("Settings Row"));
        await screen.findByText("Settings Content");
        expect(screen.queryByText("Inbox Content")).toBeNull();
    });
});

describe("static - nesting and gating", () => {
    it("skips a screen whose if callback returns false", async () => {
        const onUnhandledAction = vi.fn();
        await render(<GatedApp onUnhandledAction={onUnhandledAction} />);
        await screen.findByText("Home Content");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        expect(onUnhandledAction).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Details 42")).toBeNull();
        await screen.findByText("Home Content");
    });

    it("nests static tabs inside a static stack", async () => {
        await render(<NestedApp />);
        await screen.findByText("First Content");
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TAB, { name: "Second Tab" }));
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" }));
        await screen.findByText("Details 8");
        expect(screen.queryByRole(Gtk.AccessibleRole.TAB, { name: "Second Tab" })).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" }));
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go to details" });
        expect(screen.queryByText("First Content")).toBeNull();
    });
});

describe("static - errors", () => {
    it("throws when the static config declares no screens", () => {
        expect(() => createStackNavigator({ screens: {} })).toThrow();
    });
});

describe("static navigation - dynamic navigators", () => {
    it("refuses a dynamic navigator where a static config is required", () => {
        const DynamicStack = createStackNavigator<{ Home: undefined }>();
        // @ts-expect-error a navigator built without a static config has no screens to assemble
        expect(() => createStaticNavigation(DynamicStack)).toThrow();
    });
});
