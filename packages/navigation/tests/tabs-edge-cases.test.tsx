import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    expectSelectedTab,
    findTab,
    focusedRouteName,
    type StateSpy,
    type TabPressSpy,
    TabsApp,
} from "./helpers/tab-fixtures.js";

describe("tabs - edge cases (1)", () => {
    it("ignores a click on the selected tab", async () => {
        const onStateChange: StateSpy = vi.fn();
        const onTabPress: TabPressSpy = vi.fn();
        await render(<TabsApp onStateChange={onStateChange} listeners={{ First: { tabPress: onTabPress } }} />);
        await screen.findByText("First Content");
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("First Content");
        expectSelectedTab("First Tab");
        expect(onTabPress).not.toHaveBeenCalled();
        expect(onStateChange).not.toHaveBeenCalled();
    });

    it("lands on the last tab after two rapid switches", async () => {
        const onStateChange: StateSpy = vi.fn();
        await render(<TabsApp onStateChange={onStateChange} />);
        await screen.findByText("First Content");
        await userEvent.click(await findTab("Second Tab"));
        await userEvent.click(await findTab("Third Tab"));
        await screen.findByText("Third Content");
        expect(screen.queryByText("Second Content")).toBeNull();
        expect(screen.queryByText("First Content")).toBeNull();
        expectSelectedTab("Third Tab");
        expect(focusedRouteName(onStateChange)).toBe("Third");
    });

    it("renders a navigator with a single screen", async () => {
        await render(<TabsApp names={["First"]} />);
        await screen.findByText("First Content");
        expectSelectedTab("First Tab");
        expect(screen.getAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(1);
    });
});

describe("tabs - edge cases (2)", () => {
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

    it("loads a rekeyed tab as a new lazy scene", async () => {
        let nextInstance = 0;

        const SecondPage = (): ReactNode => {
            const [instance] = useState(() => {
                nextInstance += 1;

                return nextInstance;
            });

            return <GtkLabel>{`Second instance ${instance.toString()}`}</GtkLabel>;
        };

        const renderSecond = (): ReactNode => <SecondPage />;

        const { rerender } = await render(
            <TabsApp renderers={{ Second: renderSecond }} navigationKeys={{ Second: "first" }} />,
        );

        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second instance 1");
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("First Content");
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second instance 1");
        expect(nextInstance).toBe(1);
        await userEvent.click(await findTab("First Tab"));
        await screen.findByText("First Content");
        await rerender(<TabsApp renderers={{ Second: renderSecond }} navigationKeys={{ Second: "second" }} />);
        expect(nextInstance).toBe(1);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second instance 2");
        expect(screen.queryByText("Second instance 1")).toBeNull();
    });
});
