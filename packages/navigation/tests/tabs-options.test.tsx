import type { TabHeaderProps } from "@gtkx/navigation";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { queryAllByObjectProperty, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { expectSelectedTab, findTab, getAncestor, getStackPage, SpyPage, TabsApp } from "./helpers/tab-fixtures.js";

const CustomHeader = ({ viewSwitcher }: TabHeaderProps): ReactNode => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
        <GtkLabel>Custom Header</GtkLabel>
        {viewSwitcher}
    </GtkBox>
);

describe("tabs - options (1)", () => {
    it("uses tabBarLabel as the tab name", async () => {
        await render(<TabsApp options={{ Second: { tabBarLabel: "Labelled Tab" } }} />);
        await findTab("Labelled Tab");
        expect(screen.queryByRole(Gtk.AccessibleRole.TAB, { name: "Second Tab" })).toBeNull();
        await userEvent.click(await findTab("Labelled Tab"));
        await screen.findByText("Second Content");
    });

    it("shows tabBarIcon in the tab", async () => {
        await render(<TabsApp options={{ Second: { tabBarIcon: "go-home-symbolic" } }} />);
        const tab = await findTab("Second Tab");
        expect(queryAllByObjectProperty("icon-name", tab, "go-home-symbolic")).not.toHaveLength(0);
        expect(queryAllByObjectProperty("icon-name", await findTab("First Tab"), "go-home-symbolic")).toHaveLength(0);
    });

    it("shows tabBarBadge and needsAttention while still switching", async () => {
        await render(<TabsApp options={{ Second: { tabBarBadge: 7, needsAttention: true } }} />);
        const tab = await findTab("Second Tab");
        within(tab).getByText("7");
        expect(getStackPage("First Content", "Second Tab")).toHaveObjectProperty("needsAttention", true);
        expect(getStackPage("First Content", "First Tab")).toHaveObjectProperty("needsAttention", false);
        await userEvent.click(tab);
        await screen.findByText("Second Content");
        expectSelectedTab("Second Tab");
    });
});

describe("tabs - options (2)", () => {
    it("renders a switcher bar at the bottom and the focused title in the header", async () => {
        const { baseElement } = await render(<TabsApp navigator={{ tabBarPosition: "bottom" }} />);
        await screen.findByText("First Content");
        expect(getAncestor(await findTab("First Tab"), Adw.ViewSwitcherBar)).toHaveObjectProperty("reveal", true);
        expect(queryAllByObjectProperty("title", baseElement, "First Tab")).toHaveLength(1);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(screen.queryByText("First Content")).toBeNull();

        await waitFor(() => {
            expect(queryAllByObjectProperty("title", baseElement, "Second Tab")).toHaveLength(1);
        });

        expect(queryAllByObjectProperty("title", baseElement, "First Tab")).toHaveLength(0);
    });

    it("replaces a top switcher with headerTitle and keeps a bottom one", async () => {
        await render(<TabsApp options={{ First: { headerTitle: "Mail" } }} />);
        await screen.findByText("Mail");
        expect(screen.queryByRole(Gtk.AccessibleRole.TAB, { name: "Second Tab" })).toBeNull();
    });

    it("keeps the bottom switcher when headerTitle is set", async () => {
        await render(<TabsApp navigator={{ tabBarPosition: "bottom" }} options={{ First: { headerTitle: "Mail" } }} />);
        await screen.findByText("Mail");
        await userEvent.click(await findTab("Second Tab"));
        expect(await screen.findByText("Second Content")).toBeVisible();
    });

    it("keeps the switcher when headerShown is false", async () => {
        const { baseElement } = await render(<TabsApp navigator={{ screenOptions: { headerShown: false } }} />);
        await screen.findByText("First Content");
        expect(queryAllByObjectProperty("title", baseElement, "First Tab")).toHaveLength(0);
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(screen.queryByText("First Content")).toBeNull();
    });

    it("renders a custom header with the view switcher", async () => {
        await render(<TabsApp navigator={{ screenOptions: { header: CustomHeader } }} />);
        await screen.findByText("Custom Header");
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        await screen.findByText("Custom Header");
        expectSelectedTab("Second Tab");
    });
});

describe("tabs - options (3)", () => {
    it("mounts a lazy tab on first focus", async () => {
        const onMount = vi.fn();
        const renderSecond = (): ReactNode => <SpyPage text="Second Content" onMount={onMount} />;
        await render(<TabsApp renderers={{ Second: renderSecond }} />);
        await screen.findByText("First Content");
        expect(onMount).not.toHaveBeenCalled();
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");
        expect(onMount).toHaveBeenCalledTimes(1);
    });

    it("mounts a non-lazy tab at startup", async () => {
        const onMount = vi.fn();
        const renderSecond = (): ReactNode => <SpyPage text="Second Content" onMount={onMount} />;
        await render(<TabsApp renderers={{ Second: renderSecond }} options={{ Second: { lazy: false } }} />);
        await screen.findByText("First Content");
        expect(onMount).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Second Content")).toBeNull();
    });

    it("switches with the fade animation", async () => {
        await render(<TabsApp navigator={{ screenOptions: { animation: "fade" } }} />, {
            areAnimationsEnabled: true,
        });

        await screen.findByText("First Content");
        await userEvent.click(await findTab("Second Tab"));
        await screen.findByText("Second Content");

        await waitFor(() => {
            expect(screen.queryByText("First Content")).toBeNull();
        });

        expectSelectedTab("Second Tab");
    });
});
