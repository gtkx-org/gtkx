import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    expectSelectedTab,
    findTab,
    focusedRouteKey,
    NestedStackScreen,
    type StateHistory,
    TabsApp,
} from "./helpers/tab-fixtures.js";

describe("tabs - events", () => {
    it("emits tabPress targeting the pressed route", async () => {
        const states: StateHistory = [];
        const targets: (string | undefined)[] = [];
        await render(
            <TabsApp
                onStateChange={(state) => {
                    states.push(state);
                }}
                listeners={{
                    Second: {
                        tabPress: (event) => {
                            targets.push(event.target);
                        },
                    },
                }}
            />,
        );
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(targets).toEqual([focusedRouteKey(states)]);
    });

    it("keeps the current tab when tabPress is prevented", async () => {
        const states: StateHistory = [];

        const listeners = {
            Second: {
                tabPress: (event: { preventDefault: () => void }) => {
                    event.preventDefault();
                },
            },
        };

        await render(
            <TabsApp
                onStateChange={(state) => {
                    states.push(state);
                }}
                listeners={listeners}
            />,
        );
        await screen.findByText("First Content");
        await userEvent.click(await findTab("Second Tab"));

        await waitFor(() => {
            expectSelectedTab("First Tab");
        });

        await screen.findByText("First Content");
        expect(screen.queryByText("Second Content")).toBeNull();
        expect(states).toEqual([]);
    });

    it("emits focus and blur when switching", async () => {
        let focusEvents = 0;
        let blurEvents = 0;
        await render(
            <TabsApp
                listeners={{
                    First: {
                        blur: () => {
                            blurEvents += 1;
                        },
                    },
                    Second: {
                        focus: () => {
                            focusEvents += 1;
                        },
                    },
                }}
            />,
        );
        await screen.findByText("First Content");
        expect(focusEvents).toBe(0);
        expect(blurEvents).toBe(0);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(focusEvents).toBe(1);
        expect(blurEvents).toBe(1);
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
