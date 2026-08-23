import { createNavigationContainerRef } from "@gtkx/navigation";
import { act, render, screen, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    buildStack,
    clickButton,
    createStateSpy,
    doubleClickButton,
    expectHidden,
    expectRouteNames,
    expectVisible,
    getHeaderBar,
    getRouteNames,
    pressKeys,
    queryBackButton,
    RefApp,
    renderStack,
    type RootParams,
} from "./helpers/stack-fixtures.js";

describe("stack - navigation (1)", () => {
    it("pushes a page on navigate and hides the previous one", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expectHidden("Home Content");
        expectRouteNames(onStateChange, ["Home", "Details"]);
    });

    it("shows the page title in the header bar and pops with Back", async () => {
        await renderStack();
        expect(within(getHeaderBar()).getByText("Home")).toBeVisible();
        await clickButton("Go to details");
        expect(within(getHeaderBar()).getByText("Details Page")).toBeVisible();
        await clickButton("Back");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });

    it("pops with Escape", async () => {
        await renderStack();
        await clickButton("Go to details");
        await pressKeys("Details 1", "{Escape}");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });

    it("pops with Alt+Left", async () => {
        await renderStack();
        await clickButton("Go to details");
        await pressKeys("Details 1", "{Alt>}{ArrowLeft}{/Alt}");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });
});

describe("stack - navigation (2)", () => {
    it("pushes twice then pops to top", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Push details");
        await clickButton("Push details");
        await screen.findByText("Details 2");
        await clickButton("Pop to top");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
        expectHidden("Details 2");
        expectRouteNames(onStateChange, ["Home"]);
    });

    it("replaces the visible page", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Replace with details");
        await screen.findByText("Details 1");
        expectHidden("Home Content");
        expect(queryBackButton()).toBeNull();
        expectRouteNames(onStateChange, ["Details"]);
    });

    it("passes params to the screen and updates them with setParams", async () => {
        await renderStack();
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Set params");
        await screen.findByText("Details 99");
        expectHidden("Details 1");
    });

    it("updates params instead of pushing a copy when navigating to the focused route", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Navigate to details");
        await screen.findByText("Details 5");
        expectRouteNames(onStateChange, ["Home", "Details"]);
        await clickButton("Back");
        await screen.findByText("Home Content");
    });
});

describe("stack - navigation (3)", () => {
    it("renders the last route of initialState visible", async () => {
        const initialState = { index: 1, routes: [{ name: "Home" }, { name: "Details", params: { id: "3" } }] };
        await renderStack({ container: { initialState } });
        await screen.findByText("Details 3");
        expectHidden("Home Content");
        await clickButton("Back");
        await screen.findByText("Home Content");
    });

    it("resets to a new root", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Reset to settings");
        await screen.findByText("Settings Content");
        expectHidden("Details 1");
        expectHidden("Home Content");
        expect(queryBackButton()).toBeNull();
        expectRouteNames(onStateChange, ["Settings"]);
    });
});

describe("stack - navigation (4)", () => {
    it("reports every stack state to onStateChange", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Back");
        await screen.findByText("Home Content");

        expect(onStateChange.mock.calls.map(([state]) => getRouteNames(state))).toEqual([
            ["Home", "Details"],
            ["Home"],
        ]);
    });

    it("pops with navigation.goBack", async () => {
        await renderStack();
        await clickButton("Go to details");
        await clickButton("Go back");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });

    it("navigates through the container ref inside act", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        await renderStack({ container: { ref } });

        await act(() => {
            ref.navigate("Details", { id: "8" });
        });

        await screen.findByText("Details 8");
        expectHidden("Home Content");
        expect(ref.canGoBack()).toBe(true);
    });

    it("navigates through useNavigationContainerRef from outside the navigator", async () => {
        await render(<RefApp />);
        await screen.findByText("Home Content");
        await clickButton("Navigate through ref");
        await screen.findByText("Details 9");
        expectHidden("Home Content");
    });
});

describe("stack - edge cases (1)", () => {
    it("pushes the same route twice and pops one page at a time", async () => {
        await renderStack();
        await clickButton("Push details");
        await clickButton("Push details");
        await screen.findByText("Details 2");
        expectHidden("Details 1");
        await clickButton("Back");
        await screen.findByText("Details 1");
        expectHidden("Details 2");
        await clickButton("Back");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });

    it("ignores Back, Escape and goBack on the root page", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        const onUnhandledAction = vi.fn();
        await renderStack({ container: { ref, onUnhandledAction } });
        expect(queryBackButton()).toBeNull();
        expect(ref.canGoBack()).toBe(false);
        await pressKeys("Home Content", "{Escape}");
        await clickButton("Go back");
        expectVisible("Home Content");
        expect(onUnhandledAction).toHaveBeenCalledTimes(1);
    });

    it("pushes one page on a rapid double click with navigate", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await doubleClickButton("Go to details");
        await screen.findByText("Details 1");
        expectRouteNames(onStateChange, ["Home", "Details"]);
        await clickButton("Back");
        await screen.findByText("Home Content");
    });
});

describe("stack - edge cases (2)", () => {
    it("pushes two pages on a rapid double click with push", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await doubleClickButton("Push details");
        await screen.findByText("Details 1");
        expectRouteNames(onStateChange, ["Home", "Details", "Details"]);
        await clickButton("Back");
        await screen.findByText("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
    });

    it("updates the title when the container re-renders with new screenOptions", async () => {
        const { rerender } = await renderStack({ navigator: { screenOptions: { title: "First Title" } } });
        expect(within(getHeaderBar()).getByText("First Title")).toBeVisible();
        await rerender(buildStack({ navigator: { screenOptions: { title: "Second Title" } } }));
        expect(within(getHeaderBar()).getByText("Second Title")).toBeVisible();
        expectHidden("First Title");
    });

    it("removes the pages when the container unmounts", async () => {
        const { unmount } = await renderStack();
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await unmount();
        expectHidden("Details 1");
        expectHidden("Home Content");
    });
});

describe("stack - closing page", () => {
    it("shows the outgoing page's latest params while it animates away", async () => {
        await renderStack({ isAnimated: true });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Set params");
        await screen.findByText("Details 99");
        await clickButton("Go back");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });
});
