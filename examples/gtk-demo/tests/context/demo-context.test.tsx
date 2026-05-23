import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { DemoProvider, parseTitle, useDemo } from "../../src/context/demo-context.js";
import type { Demo, TreeItem } from "../../src/demos/types.js";
import { render } from "../test-utils.js";

type Snapshot = ReturnType<typeof useDemo>;

const Inspector = ({ onContext }: { onContext: (value: Snapshot) => void }) => {
    const ctx = useDemo();
    useEffect(() => {
        onContext(ctx);
    });
    return null;
};

const captureContext = async (demos: Demo[]): Promise<Snapshot> => {
    let snapshot: Snapshot | null = null;
    await render(
        <DemoProvider demos={demos}>
            <Inspector onContext={(ctx) => (snapshot = ctx)} />
        </DemoProvider>,
    );
    if (!snapshot) throw new Error("expected DemoProvider to publish context");
    return snapshot;
};

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
        await expect(render(<Inspector onContext={() => {}} />)).rejects.toThrow(/DemoProvider/);
    });
});

describe("DemoProvider", () => {
    it("pins the intro at the top of the tree", async () => {
        const ctx = await captureContext([intro, standalone, button]);
        expect(ctx.treeItems[0]).toEqual({ type: "demo", demo: intro, displayTitle: "GTK Demo" });
    });

    it("groups demos with a category under a category node", async () => {
        const ctx = await captureContext([intro, button, expander]);
        const buttonsCategory = ctx.treeItems.find(
            (item): item is Extract<TreeItem, { type: "category" }> => item.type === "category",
        );
        expect(buttonsCategory?.title).toBe("Buttons");
        expect(buttonsCategory?.children.map((c) => (c.type === "demo" ? c.demo.id : null))).toEqual([
            "button",
            "expander",
        ]);
    });

    it("recognizes bare '/' titles as categorized", async () => {
        const ctx = await captureContext([intro, fixedSlash]);
        expect(ctx.treeItems.some((item) => item.type === "category" && item.title === "Layout")).toBe(true);
    });

    it("sorts top-level demos and categories alphabetically", async () => {
        const zebra: Demo = { id: "zebra", title: "Zebra", description: "z", keywords: [] };
        const aardvark: Demo = { id: "aardvark", title: "Aardvark", description: "a", keywords: [] };
        const ctx = await captureContext([intro, zebra, aardvark, button]);
        const labels = ctx.treeItems.map((item) => (item.type === "category" ? item.title : item.displayTitle));
        expect(labels).toEqual(["GTK Demo", "Aardvark", "Buttons", "Zebra"]);
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

const SearchHarness = ({
    demos,
    query,
    onItems,
}: {
    demos: Demo[];
    query: string;
    onItems: (items: TreeItem[]) => void;
}) => {
    const Inner = () => {
        const { setSearchQuery, filteredTreeItems } = useDemo();
        const [applied, setApplied] = useState(false);
        useEffect(() => {
            if (!applied) {
                setSearchQuery(query);
                setApplied(true);
                return;
            }
            onItems(filteredTreeItems);
        }, [applied, filteredTreeItems, setSearchQuery]);
        return null;
    };
    return (
        <DemoProvider demos={demos}>
            <Inner />
        </DemoProvider>
    );
};

const captureFiltered = async (demos: Demo[], query: string): Promise<TreeItem[]> => {
    let filtered: TreeItem[] | null = null;
    await render(<SearchHarness demos={demos} query={query} onItems={(items) => (filtered = items)} />);
    if (!filtered) throw new Error("expected filteredTreeItems to publish");
    return filtered;
};

describe("filteredTreeItems", () => {
    it("returns the full tree when the query is whitespace-only", async () => {
        const filtered = await captureFiltered([intro, button, expander], "   ");
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered[0]).toEqual({ type: "demo", demo: intro, displayTitle: "GTK Demo" });
    });

    it("matches against title", async () => {
        const filtered = await captureFiltered([intro, button, expander], "button");
        const category = filtered.find((item) => item.type === "category" && item.title === "Buttons");
        expect(category).toBeDefined();
    });

    it("matches against description", async () => {
        const filtered = await captureFiltered([intro, button, expander], "expandable widget");
        expect(filtered.some((item) => item.type === "category" && item.title === "Buttons")).toBe(true);
    });

    it("matches against keywords", async () => {
        const filtered = await captureFiltered([intro, button, expander], "disclosure");
        expect(filtered.some((item) => item.type === "category" && item.title === "Buttons")).toBe(true);
    });

    it("drops categories whose children no longer match", async () => {
        const filtered = await captureFiltered([intro, button, expander], "zzznevermatch");
        expect(filtered.find((item) => item.type === "category")).toBeUndefined();
    });

    it("matches top-level demos", async () => {
        const filtered = await captureFiltered([intro, standalone, button], "Standalone");
        expect(filtered.some((item) => item.type === "demo" && item.demo.id === "stand")).toBe(true);
    });
});
