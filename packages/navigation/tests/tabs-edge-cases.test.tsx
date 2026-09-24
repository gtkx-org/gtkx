import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    expectSelectedTab,
    findTab,
    focusedRouteName,
    type StateHistory,
    TabsApp,
} from "./helpers/tab-fixtures.js";

describe("tabs - edge cases", () => {
    it("ignores a click on the selected tab", async () => {
        const states: StateHistory = [];
        let tabPresses = 0;
        await render(
            <TabsApp
                onStateChange={(state) => {
                    states.push(state);
                }}
                listeners={{
                    First: {
                        tabPress: () => {
                            tabPresses += 1;
                        },
                    },
                }}
            />,
        );
        await screen.findByText("First Content");
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("First Content");
        expectSelectedTab("First Tab");
        expect(tabPresses).toBe(0);
        expect(states).toEqual([]);
    });

    it("lands on the last tab after two rapid switches", async () => {
        const states: StateHistory = [];
        await render(
            <TabsApp
                onStateChange={(state) => {
                    states.push(state);
                }}
            />,
        );
        await screen.findByText("First Content");
        await userEvent.click(await findTab("Second Tab"));
        await userEvent.click(await findTab("Third Tab"));
        await screen.findByText("Third Content");
        expect(screen.queryByText("Second Content")).toBeNull();
        expect(screen.queryByText("First Content")).toBeNull();
        expectSelectedTab("Third Tab");
        expect(focusedRouteName(states)).toBe("Third");
    });

    it("renders a navigator with a single screen", async () => {
        await render(<TabsApp names={["First"]} />);
        await screen.findByText("First Content");
        expectSelectedTab("First Tab");
        expect(screen.getAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(1);
    });

    it("updates the tab name when the title changes", async () => {
        const { rerender } = await render(<TabsApp options={{ First: { title: "First Tab" } }} />);
        await findTab("First Tab");
        await rerender(<TabsApp options={{ First: { title: "Renamed Tab" } }} />);
        await findTab("Renamed Tab");
        expect(screen.queryByRole(Gtk.AccessibleRole.TAB, { name: "First Tab" })).toBeNull();
        await screen.findByText("First Content");
    });

    it("removes every widget on unmount", async () => {
        const { unmount } = await render(<TabsApp />);
        await screen.findByText("First Content");
        await findTab("Second Tab");
        await unmount();
        expect(screen.queryByText("First Content")).toBeNull();
        expect(screen.queryAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(0);
    });
});
