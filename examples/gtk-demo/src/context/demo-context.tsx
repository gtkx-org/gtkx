import type * as Gtk from "@gtkx/gi/gtk";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { Demo, TreeItem } from "../demos/types.js";

type DemoContextValue = {
    demos: Demo[];
    treeItems: TreeItem[];
    currentDemo: Demo | null;
    setCurrentDemo: (demo: Demo | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredTreeItems: TreeItem[];
    windowTitle: string | null;
    setWindowTitle: (title: string | null) => void;
    defaultWidget: Gtk.Widget | null;
    setDefaultWidget: (widget: Gtk.Widget | null) => void;
};

type DemoTreeProviderProps = {
    demos: Demo[];
    children: ReactNode;
};

type DemoCategories = Map<string, TreeItem[]>;

const DemoContext = createContext<DemoContextValue | null>(null);

const useDemo = () => {
    const context = useContext(DemoContext);

    if (!context) {
        throw new Error("useDemo must be used within a DemoProvider");
    }

    return context;
};

function parseTitle(title: string): { category: string | null; displayTitle: string } {
    const spacedSlash = title.indexOf(" / ");

    if (spacedSlash !== -1) {
        return {
            category: title.slice(0, spacedSlash).trim(),
            displayTitle: title.slice(spacedSlash + 3).trim(),
        };
    }

    const slashIndex = title.indexOf("/");

    if (slashIndex !== -1) {
        return {
            category: title.slice(0, slashIndex).trim(),
            displayTitle: title.slice(slashIndex + 1).trim(),
        };
    }

    return { category: null, displayTitle: title };
}

function pushIntoCategory(categories: DemoCategories, category: string, item: TreeItem): void {
    const items = categories.get(category);

    if (items) {
        items.push(item);

        return;
    }

    categories.set(category, [item]);
}

function groupDemos(demos: Demo[]): { topLevel: TreeItem[]; categories: DemoCategories } {
    const categories: DemoCategories = new Map();
    const topLevel: TreeItem[] = [];

    for (const demo of demos) {
        const { category, displayTitle } = parseTitle(demo.title);
        const item: TreeItem = { type: "demo", demo, displayTitle };

        if (category === null) {
            topLevel.push(item);
        } else {
            pushIntoCategory(categories, category, item);
        }
    }

    return { topLevel, categories };
}

function treeItemTitle(item: TreeItem): string {
    return item.type === "category" ? item.title : item.displayTitle;
}

function compareTreeItems(a: TreeItem, b: TreeItem): number {
    return treeItemTitle(a).localeCompare(treeItemTitle(b));
}

function buildTree(demos: Demo[]): TreeItem[] {
    const { topLevel, categories } = groupDemos(demos);
    const intro = topLevel.shift();
    const result: TreeItem[] = [...topLevel];

    for (const [title, children] of categories) {
        result.push({ type: "category", title, children });
    }

    result.sort(compareTreeItems);

    if (intro) {
        result.unshift(intro);
    }

    return result;
}

function isMatchingDemo(demo: Demo, lowerQuery: string): boolean {
    return (
        demo.title.toLowerCase().includes(lowerQuery) ||
        demo.description.toLowerCase().includes(lowerQuery) ||
        demo.keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
    );
}

function filterTreeItem(item: TreeItem, query: string, lowerQuery: string): TreeItem | null {
    if (item.type === "demo") {
        return isMatchingDemo(item.demo, lowerQuery) ? item : null;
    }

    const filteredChildren = filterTree(item.children, query);

    if (filteredChildren.length === 0) {
        return null;
    }

    return { type: "category", title: item.title, children: filteredChildren };
}

function filterTree(items: TreeItem[], query: string): TreeItem[] {
    const lowerQuery = query.toLowerCase();
    const result: TreeItem[] = [];

    for (const item of items) {
        const filtered = filterTreeItem(item, query, lowerQuery);

        if (filtered) {
            result.push(filtered);
        }
    }

    return result;
}

const findFirstDemoInItem = (item: TreeItem): Demo | null => {
    if (item.type === "demo") {
        return item.demo;
    }

    for (const child of item.children) {
        if (child.type === "demo") {
            return child.demo;
        }
    }

    return null;
};

const findFirstDemo = (treeItems: TreeItem[]): Demo | null => {
    for (const item of treeItems) {
        const demo = findFirstDemoInItem(item);

        if (demo) {
            return demo;
        }
    }

    return null;
};

const DemoProvider = ({ demos, children }: DemoTreeProviderProps) => {
    const treeItems = buildTree(demos);
    const firstDemo = findFirstDemo(treeItems);
    const [currentDemo, setCurrentDemoState] = useState<Demo | null>(firstDemo);
    const [searchQuery, setSearchQuery] = useState("");
    const [windowTitle, setWindowTitle] = useState<string | null>(null);
    const [defaultWidget, setDefaultWidget] = useState<Gtk.Widget | null>(null);

    const setCurrentDemo = (demo: Demo | null) => {
        setCurrentDemoState(demo);
        setWindowTitle(null);
        setDefaultWidget(null);
    };

    const filteredTreeItems = searchQuery.trim() ? filterTree(treeItems, searchQuery) : treeItems;

    const contextValue = {
        demos,
        treeItems,
        currentDemo,
        setCurrentDemo,
        searchQuery,
        setSearchQuery,
        filteredTreeItems,
        windowTitle,
        setWindowTitle,
        defaultWidget,
        setDefaultWidget,
    };

    return <DemoContext.Provider value={contextValue}>{children}</DemoContext.Provider>;
};

export { DemoProvider, parseTitle, useDemo };
