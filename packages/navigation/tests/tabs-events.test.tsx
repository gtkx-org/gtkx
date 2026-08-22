import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    expectSelectedTab,
    findTab,
    focusedRouteKey,
    NestedStackScreen,
    type StateSpy,
    type TabPressSpy,
    TabsApp,
} from "./helpers/tab-fixtures.js";

describe("tabs - events (1)", () => {
    it("emits tabPress targeting the pressed route", async () => {
        const onStateChange: StateSpy = vi.fn();
        const onTabPress: TabPressSpy = vi.fn();
        await render(<TabsApp onStateChange={onStateChange} listeners={{ Second: { tabPress: onTabPress } }} />);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(onTabPress).toHaveBeenCalledTimes(1);
        expect(onTabPress.mock.calls[0]?.[0].target).toBe(focusedRouteKey(onStateChange));
    });

    it("keeps the current tab when tabPress is prevented", async () => {
        const onStateChange: StateSpy = vi.fn();

        const listeners = {
            Second: {
                tabPress: (event: { preventDefault: () => void }) => {
                    event.preventDefault();
                },
            },
        };

        await render(<TabsApp onStateChange={onStateChange} listeners={listeners} />);
        await screen.findByText("First Content");
        await userEvent.click(await findTab("Second Tab"));

        await waitFor(() => {
            expectSelectedTab("First Tab");
        });

        await screen.findByText("First Content");
        expect(screen.queryByText("Second Content")).toBeNull();
        expect(onStateChange).not.toHaveBeenCalled();
    });
});

describe("tabs - events (2)", () => {
    it("emits focus and blur when switching", async () => {
        const onFocus = vi.fn();
        const onBlur = vi.fn();
        await render(<TabsApp listeners={{ First: { blur: onBlur }, Second: { focus: onFocus } }} />);
        await screen.findByText("First Content");
        expect(onFocus).not.toHaveBeenCalled();
        expect(onBlur).not.toHaveBeenCalled();
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(onFocus).toHaveBeenCalledTimes(1);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("pops a nested stack to its first screen with popToTopOnBlur", async () => {
        await render(
            <TabsApp renderers={{ First: NestedStackScreen }} options={{ First: { popToTopOnBlur: true } }} />,
        );

        await screen.findByText("Nested Home");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Push details" }));
        await screen.findByText("Nested Details");
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("Nested Home");
        expect(screen.queryByText("Nested Details")).toBeNull();
    });

    it("keeps a nested stack where it was without popToTopOnBlur", async () => {
        await render(<TabsApp renderers={{ First: NestedStackScreen }} />);
        await screen.findByText("Nested Home");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Push details" }));
        await screen.findByText("Nested Details");
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("Nested Details");
        expect(screen.queryByText("Nested Home")).toBeNull();
    });
});
