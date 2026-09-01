import type { ReactNode } from "react";
import { act, render, renderHook } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { Demo, TreeItem } from "../../src/demos/types.js";
import { DemoProvider, parseTitle, useDemo } from "../../src/context/demo-context.js";

type Category = Extract<TreeItem, { type: "category" }>;

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };
const standalone: Demo = { id: "stand", title: "Standalone", description: "No category", keywords: [] };

const button: Demo = {
    id: "button",
    title: "Buttons / Button",
    description: "Button description",
    keywords: ["click", "action"],
    component: () => null,
};

const expander: Demo = {
    id: "expander",
    title: "Buttons / Expander",
    description: "An expandable widget",
    keywords: ["disclosure"],
};

const fixedSlash: Demo = {
    id: "fixed",
    title: "Layout/Fixed",
    description: "Fixed layout",
    keywords: [],
};

const buildWrapper = (demos: Demo[]) => {
    return ({ children }: { children: ReactNode }) => <DemoProvider demos={demos}>{children}</DemoProvider>;
};

const captureContext = async (demos: Demo[]) => {
    const { result } = await renderHook(() => useDemo(), { wrapper: buildWrapper(demos) });

    return result.current;
};

const captureFiltered = async (demos: Demo[], query: string): Promise<TreeItem[]> => {
    const { result } = await renderHook(() => useDemo(), { wrapper: buildWrapper(demos) });

    await act(() => {
        result.current.setSearchQuery(query);
    });

    return result.current.filteredTreeItems;
};

const UnboundConsumer = () => {
    useDemo();

    return null;
};

const firstCategory = (items: TreeItem[]): Category | undefined =>
    items.find((item): item is Category => item.type === "category");

const findCategory = (items: TreeItem[], title: string): Category | undefined =>
    items.find((item): item is Category => item.type === "category" && item.title === title);

const childDemoIds = (category: Category | undefined): (string | null)[] | undefined =>
    category?.children.map((child) => (child.type === "demo" ? child.demo.id : null));

const treeLabels = (items: TreeItem[]): string[] =>
    items.map((item) => (item.type === "category" ? item.title : item.displayTitle));

describe("parseTitle", () => {
    it("returns category=null for a plain title", () => {
        expect(parseTitle("Plain")).toEqual({ category: null, displayTitle: "Plain" });
    });

    it("splits on ' / ' when both spaces are present", () => {
        expect(parseTitle("Buttons / Button")).toEqual({ category: "Buttons", displayTitle: "Button" });
    });

    it("falls back to splitting on a bare '/'", () => {
        expect(parseTitle("Layout/Fixed")).toEqual({ category: "Layout", displayTitle: "Fixed" });
    });
});

describe("useDemo", () => {
    it("throws when used outside a DemoProvider", async () => {
        await expect(render(<UnboundConsumer />)).rejects.toThrow();
    });
});

describe("DemoProvider", () => {
    it("pins the intro at the top of the tree", async () => {
        const ctx = await captureContext([intro, standalone, button]);
        expect(ctx.treeItems[0]).toEqual({ type: "demo", demo: intro, displayTitle: "GTK Demo" });
    });

    it("groups demos with a category under a category node", async () => {
        const ctx = await captureContext([intro, button, expander]);
        const buttonsCategory = firstCategory(ctx.treeItems);
        expect(buttonsCategory?.title).toBe("Buttons");
        expect(childDemoIds(buttonsCategory)).toEqual(["button", "expander"]);
    });

    it("recognizes bare '/' titles as categorized", async () => {
        const ctx = await captureContext([intro, fixedSlash]);
        expect(findCategory(ctx.treeItems, "Layout")).toBeDefined();
    });

    it("sorts top-level demos and categories alphabetically", async () => {
        const zebra: Demo = { id: "zebra", title: "Zebra", description: "z", keywords: [] };
        const aardvark: Demo = { id: "aardvark", title: "Aardvark", description: "a", keywords: [] };
        const ctx = await captureContext([intro, zebra, aardvark, button]);
        expect(treeLabels(ctx.treeItems)).toEqual(["GTK Demo", "Aardvark", "Buttons", "Zebra"]);
    });

    it("uses the pinned intro as the initial currentDemo", async () => {
        const ctx = await captureContext([intro, button]);
        expect(ctx.currentDemo?.id).toBe("intro");
    });

    it("walks into the first category when no top-level demos exist", async () => {
        const ctx = await captureContext([button, expander]);
        expect(ctx.currentDemo?.id).toBe("button");
    });

    it("returns currentDemo=null when the demos list is empty", async () => {
        const ctx = await captureContext([]);
        expect(ctx.currentDemo).toBeNull();
    });
});

describe("filteredTreeItems", () => {
    it("returns the full tree when the query is whitespace-only", async () => {
        const filtered = await captureFiltered([intro, button, expander], " ".repeat(3));
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered[0]).toEqual({ type: "demo", demo: intro, displayTitle: "GTK Demo" });
    });

    it("matches against title", async () => {
        const filtered = await captureFiltered([intro, button, expander], "Expander");
        expect(childDemoIds(findCategory(filtered, "Buttons"))).toEqual(["expander"]);
    });

    it("matches against description", async () => {
        const filtered = await captureFiltered([intro, button, expander], "expandable widget");
        expect(findCategory(filtered, "Buttons")).toBeDefined();
    });

    it("matches against keywords", async () => {
        const filtered = await captureFiltered([intro, button, expander], "disclosure");
        expect(findCategory(filtered, "Buttons")).toBeDefined();
    });

    it("drops categories whose children no longer match", async () => {
        const filtered = await captureFiltered([intro, button, expander], "zzznevermatch");
        expect(firstCategory(filtered)).toBeUndefined();
    });

    it("matches top-level demos", async () => {
        const filtered = await captureFiltered([intro, standalone, button], "Standalone");
        expect(filtered.some((item) => item.type === "demo" && item.demo.id === "stand")).toBe(true);
    });
});
