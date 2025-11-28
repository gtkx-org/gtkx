import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Category, Demo } from "../demos/types.js";

interface DemoContextValue {
    categories: Category[];
    currentDemo: Demo | null;
    currentCategory: Category | null;
    selectDemo: (categoryId: string, demoId: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredCategories: Category[];
}

const DemoContext = createContext<DemoContextValue | null>(null);

interface DemoProviderProps {
    categories: Category[];
    children: ReactNode;
}

export const DemoProvider = ({ categories, children }: DemoProviderProps) => {
    const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(categories[0]?.id ?? null);
    const [currentDemoId, setCurrentDemoId] = useState<string | null>(categories[0]?.demos[0]?.id ?? null);
    const [searchQuery, setSearchQuery] = useState("");

    const currentCategory = useMemo(
        () => categories.find((c) => c.id === currentCategoryId) ?? null,
        [categories, currentCategoryId],
    );

    const currentDemo = useMemo(
        () => currentCategory?.demos.find((d) => d.id === currentDemoId) ?? null,
        [currentCategory, currentDemoId],
    );

    const selectDemo = useCallback((categoryId: string, demoId: string) => {
        setCurrentCategoryId(categoryId);
        setCurrentDemoId(demoId);
    }, []);

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) {
            return categories;
        }
        const query = searchQuery.toLowerCase();
        return categories
            .map((category) => ({
                ...category,
                demos: category.demos.filter(
                    (demo) =>
                        demo.title.toLowerCase().includes(query) ||
                        demo.description.toLowerCase().includes(query) ||
                        demo.keywords.some((k) => k.toLowerCase().includes(query)),
                ),
            }))
            .filter((category) => category.demos.length > 0);
    }, [categories, searchQuery]);

    const value = useMemo(
        () => ({
            categories,
            currentDemo,
            currentCategory,
            selectDemo,
            searchQuery,
            setSearchQuery,
            filteredCategories,
        }),
        [categories, currentDemo, currentCategory, selectDemo, searchQuery, filteredCategories],
    );

    return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = (): DemoContextValue => {
    const context = useContext(DemoContext);
    if (!context) {
        throw new Error("useDemo must be used within a DemoProvider");
    }
    return context;
};
