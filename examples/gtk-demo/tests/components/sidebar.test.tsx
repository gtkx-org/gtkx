import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "../../src/components/sidebar.js";
import { DemoProvider, useDemo } from "../../src/context/demo-context.js";
import type { Demo } from "../../src/demos/types.js";
import { render, screen } from "../test-utils.js";

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
    it("renders category labels", async () => {
        await render(
            <DemoProvider demos={[intro, buttonDemo, expanderDemo, standaloneDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
            </DemoProvider>,
        );
        expect(await screen.findByText("Buttons")).toBeDefined();
    });

    it("renders top-level demos by their display title", async () => {
        await render(
            <DemoProvider demos={[intro, standaloneDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
            </DemoProvider>,
        );
        expect(await screen.findByText("Standalone")).toBeDefined();
    });

    it("renders with search mode enabled", async () => {
        await render(
            <DemoProvider demos={[intro, buttonDemo, expanderDemo]}>
                <Sidebar searchMode={true} onSearchChanged={noop} />
            </DemoProvider>,
        );
        expect(await screen.findByText("Buttons")).toBeDefined();
    });

    it("exposes the current demo via the context", async () => {
        let snapshot: ReturnType<typeof useDemo> | null = null;
        await render(
            <DemoProvider demos={[intro, buttonDemo, expanderDemo]}>
                <Sidebar searchMode={false} onSearchChanged={noop} />
                <QueryPublisher onContext={(ctx) => (snapshot = ctx)} />
            </DemoProvider>,
        );
        if (!snapshot) throw new Error("expected snapshot");
        const ctx = snapshot as ReturnType<typeof useDemo>;
        expect(ctx.currentDemo?.id).toBe("intro");
    });
});
