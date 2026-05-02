import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { Demo, TreeItem } from "../demos/types.js";

interface DemoContextValue {
    demos: Demo[];
    treeItems: TreeItem[];
    currentDemo: Demo | null;
    setCurrentDemo: (demo: Demo | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredTreeItems: TreeItem[];
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

interface DemoProviderProps {
    demos: Demo[];
    children: ReactNode;
}

export const DemoProvider = ({ demos, children }: DemoProviderProps) => {
    const treeItems = useMemo(() => buildTree(demos), [demos]);

    const firstDemo = useMemo(() => {
        for (const item of treeItems) {
            if (item.type === "demo") return item.demo;
            if (item.type === "category") {
                for (const child of item.children) {
                    if (child.type === "demo") return child.demo;
                }
            }
        }
        return null;
    }, [treeItems]);

    const [currentDemo, setCurrentDemo] = useState<Demo | null>(firstDemo);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTreeItems = useMemo(
        () => (searchQuery.trim() ? filterTree(treeItems, searchQuery) : treeItems),
        [treeItems, searchQuery],
    );

    const contextValue = useMemo(
        () => ({
            demos,
            treeItems,
            currentDemo,
            setCurrentDemo,
            searchQuery,
            setSearchQuery,
            filteredTreeItems,
        }),
        [demos, treeItems, currentDemo, searchQuery, filteredTreeItems],
    );

    return <DemoContext.Provider value={contextValue}>{children}</DemoContext.Provider>;
};
