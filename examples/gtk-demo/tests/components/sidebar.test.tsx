import type * as Gtk from "@gtkx/ffi/gtk";
import { render, screen } from "@gtkx/testing";
import { useEffect } from "react";
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

const QueryPublisher = ({ onContext }: { onContext: (ctx: ReturnType<typeof useDemo>) => void }) => {
    const ctx = useDemo();
    useEffect(() => {
        onContext(ctx);
    });
    return null;
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
        let snapshot: ReturnType<typeof useDemo> | null = null;
        await render(
            <DemoProvider demos={[intro, buttonDemo, expanderDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
                <QueryPublisher onContext={(ctx) => (snapshot = ctx)} />
            </DemoProvider>,
        );
        expect(snapshot).not.toBeNull();
        expect((snapshot as unknown as ReturnType<typeof useDemo>).currentDemo?.id).toBe("intro");
    });
});
