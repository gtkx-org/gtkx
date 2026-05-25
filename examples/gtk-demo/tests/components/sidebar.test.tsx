import type * as Gtk from "@gtkx/ffi/gtk";
import { render, renderHook, screen } from "@gtkx/testing";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "../../src/components/sidebar.js";
import { DemoProvider, useDemo } from "../../src/context/demo-context.js";
import type { Demo } from "../../src/demos/types.js";

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

const noop = () => {};

describe("Sidebar", () => {
    it("renders the Buttons category node grouping its two child demos", async () => {
        await render(
            <DemoProvider demos={[intro, buttonDemo, expanderDemo, standaloneDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
            </DemoProvider>,
        );
        await screen.findByText("Buttons");
        await screen.findByText("Button");
        await screen.findByText("Expander");
    });

    it("renders top-level demos by their display title", async () => {
        await render(
            <DemoProvider demos={[intro, standaloneDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
            </DemoProvider>,
        );
        await screen.findByText("Standalone");
        await screen.findByText("GTK Demo");
    });

    it("opens the sidebar search bar when search mode is enabled", async () => {
        await render(
            <DemoProvider demos={[intro, buttonDemo, expanderDemo]}>
                <Sidebar searchMode={true} onSearchChanged={noop} />
            </DemoProvider>,
        );
        const searchBar = (await screen.findByName("sidebar-search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(true);
        await screen.findByText("Buttons");
    });

    it("exposes the current demo via the context", async () => {
        const Wrapper = ({ children }: { children: ReactNode }) => (
            <DemoProvider demos={[intro, buttonDemo, expanderDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
                {children}
            </DemoProvider>
        );
        const { result } = await renderHook(() => useDemo(), { wrapper: Wrapper });
        expect(result.current.currentDemo?.id).toBe("intro");
    });
});
