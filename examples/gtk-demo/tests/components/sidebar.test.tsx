import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { render, renderHook, screen, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { Demo } from "../../src/demos/types.js";
import { Sidebar } from "../../src/components/sidebar.js";
import { DemoProvider, useDemo } from "../../src/context/demo-context.js";

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };

const buttonDemo: Demo = {
    id: "button",
    title: "Buttons / Button",
    description: "A button",
    keywords: ["click"],
    component: () => null,
};

const expanderDemo: Demo = {
    id: "expander",
    title: "Buttons / Expander",
    description: "An expander",
    keywords: ["disclose"],
};

const standaloneDemo: Demo = {
    id: "stand",
    title: "Standalone",
    description: "Standalone demo",
    keywords: [],
    component: () => null,
};

const noop = vi.fn();

const drawSidebar = (demos: Demo[], isSearchActive = false, children?: ReactNode): ReactNode => (
    <DemoProvider demos={demos}>
        <Sidebar isSearchActive={isSearchActive} onSearchChanged={noop} />
        {children}
    </DemoProvider>
);

const ContextProbeWrapper = ({ children }: { children: ReactNode }) =>
    drawSidebar([intro, buttonDemo, expanderDemo], false, children);

describe("Sidebar", () => {
    it("renders the Buttons category node grouping its two child demos", async () => {
        await render(drawSidebar([intro, buttonDemo, expanderDemo, standaloneDemo]));
        const category = await screen.findByText("Buttons");
        const first = await screen.findByText("Button");
        const second = await screen.findByText("Expander");
        expect(category).not.toBe(first);
        expect(first).not.toBe(second);
    });

    it("renders top-level demos by their display title", async () => {
        await render(drawSidebar([intro, standaloneDemo]));
        const standalone = await screen.findByText("Standalone");
        const introEntry = await screen.findByText("GTK Demo");
        expect(standalone).not.toBe(introEntry);
    });

    it("opens the sidebar search bar when search mode is enabled", async () => {
        await render(drawSidebar([intro, buttonDemo, expanderDemo], true));
        const searchBar = await screen.findByName("sidebar-search-bar", { as: Gtk.SearchBar });
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
        await screen.findByText("Buttons");
    });

    it("exposes the current demo via the context", async () => {
        const { result } = await renderHook(() => useDemo(), { wrapper: ContextProbeWrapper });
        expect(result.current.currentDemo?.id).toBe("intro");
    });
});

describe("Sidebar accessibility", () => {
    it("names every expander in the tree and describes the ones that expand", async () => {
        await render(drawSidebar([intro, buttonDemo, expanderDemo]));
        const list = await screen.findByName("sidebar-list", { as: Gtk.ListView });
        const expanders = within(list).getAllByRole(Gtk.AccessibleRole.BUTTON);
        expect(expanders.length).toBeGreaterThan(0);

        for (const expander of expanders) {
            expect(expander).toHaveAccessibleName();
        }

        expect(within(list).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Buttons" })).toHaveAccessibleDescription(
            "Collapse",
        );
    });
});
