import type * as Gtk from "@gtkx/gi/gtk";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { Demo, TreeItem } from "../demos/types.js";

interface DemoContextValue {
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
}

const DemoContext = createContext<DemoContextValue | null>(null);

export const useDemo = () => {
    const context = useContext(DemoContext);
    if (!context) {
        throw new Error("useDemo must be used within a DemoProvider");
    }
    return context;
};

export function parseTitle(title: string): { category: string | null; displayTitle: string } {
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

function buildTree(demos: Demo[]): TreeItem[] {
    const categories = new Map<string, TreeItem[]>();
    const topLevel: TreeItem[] = [];

    for (const demo of demos) {
        const { category, displayTitle } = parseTitle(demo.title);
        if (category === null) {
            topLevel.push({ type: "demo", demo, displayTitle });
        } else {
            let items = categories.get(category);
            if (!items) {
                items = [];
                categories.set(category, items);
            }
            items.push({ type: "demo", demo, displayTitle });
        }
    }

    const intro = topLevel.shift();
    const result: TreeItem[] = [...topLevel];
    for (const [title, children] of categories) {
        result.push({ type: "category", title, children });
    }

    result.sort((a, b) => {
        const titleA = a.type === "category" ? a.title : a.displayTitle;
        const titleB = b.type === "category" ? b.title : b.displayTitle;
        return titleA.localeCompare(titleB);
    });

    if (intro) {
        result.unshift(intro);
    }

    return result;
}

function filterTree(items: TreeItem[], query: string): TreeItem[] {
    const lowerQuery = query.toLowerCase();
    const result: TreeItem[] = [];

    for (const item of items) {
        if (item.type === "demo") {
            const demo = item.demo;
            const matches =
                demo.title.toLowerCase().includes(lowerQuery) ||
                demo.description.toLowerCase().includes(lowerQuery) ||
                demo.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery));
            if (matches) {
                result.push(item);
            }
        } else {
            const filteredChildren = filterTree(item.children, query);
            if (filteredChildren.length > 0) {
                result.push({ type: "category", title: item.title, children: filteredChildren });
            }
        }
    }

    return result;
}

interface DemoTreeProviderProps {
    demos: Demo[];
    children: ReactNode;
}

const findFirstDemoInItem = (item: TreeItem): Demo | null => {
    if (item.type === "demo") return item.demo;
    for (const child of item.children) {
        if (child.type === "demo") return child.demo;
    }
    return null;
};

const findFirstDemo = (treeItems: TreeItem[]): Demo | null => {
    for (const item of treeItems) {
        const demo = findFirstDemoInItem(item);
        if (demo) return demo;
    }
    return null;
};

export const DemoProvider = ({ demos, children }: DemoTreeProviderProps) => {
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
