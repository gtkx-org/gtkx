import { type ExpanderDescriptions, type ListItem, type ListItemRenderer, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkInscription, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo, TreeItem } from "../demos/types.js";
import { collectExpandableIds } from "../collect-expandable-ids.js";
import { useDemo } from "../context/demo-context.js";

type SidebarProps = {
    isSearchActive: boolean;
    onDemoActivated: (demo: Demo) => void;
    onSearchActiveChange: (isActive: boolean) => void;
    onSearchChanged: (text: string) => void;
};

type SidebarSearchProps = Pick<SidebarProps, "isSearchActive" | "onSearchActiveChange" | "onSearchChanged"> & {
    searchQuery: string;
};

const EMPTY_SELECTION: string[] = [];
const EXPANDER_DESCRIPTIONS: ExpanderDescriptions = { expand: "Expand", collapse: "Collapse" };

function treeItemToData(item: TreeItem): ListItem<TreeItem> {
    if (item.type === "demo") {
        return { id: `demo-${item.demo.id}`, value: item, shouldHideExpander: true };
    }

    return {
        id: `category-${item.title}`,
        value: item,
        children: item.children.map((child) => treeItemToData(child)),
    };
}

const renderItem: ListItemRenderer<TreeItem> = ({ item }) => {
    const text = item.type === "category" ? item.title : item.displayTitle;

    return <GtkInscription text={text} natChars={25} textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END} />;
};

function collectVisibleItems(items: ListItem<TreeItem>[], expandedIds: Set<string>): ListItem<TreeItem>[] {
    const visible: ListItem<TreeItem>[] = [];

    for (const item of items) {
        visible.push(item);

        if (item.children && expandedIds.has(item.id)) {
            visible.push(...collectVisibleItems(item.children, expandedIds));
        }
    }

    return visible;
}

const SidebarSearch = ({ isSearchActive, onSearchActiveChange, onSearchChanged, searchQuery }: SidebarSearchProps) => (
    <GtkSearchBar name="sidebar-search-bar" searchModeEnabled={isSearchActive}>
        <GtkSearchEntry
            accessibleLabel="Search demos"
            placeholderText="Search demos"
            text={searchQuery}
            onSearchChanged={(entry: Gtk.SearchEntry) => {
                onSearchChanged(entry.getText());
            }}
            onStopSearch={() => {
                onSearchActiveChange(false);
            }}
        />
    </GtkSearchBar>
);

function selectedDemo(ids: string[], demos: Demo[]): Demo | undefined {
    const selectedId = ids[0];

    return selectedId?.startsWith("demo-") ? demos.find((demo) => demo.id === selectedId.slice(5)) : undefined;
}

const Sidebar = ({ isSearchActive, onDemoActivated, onSearchActiveChange, onSearchChanged }: SidebarProps) => {
    const { filteredTreeItems, currentDemo, setCurrentDemo, searchQuery, demos } = useDemo();
    const items = filteredTreeItems.map((item) => treeItemToData(item));
    const [expandedIds, setExpandedIds] = useState(() => collectExpandableIds(items));
    const visibleExpandedIds = searchQuery.trim() ? collectExpandableIds(items) : expandedIds;
    const selected = currentDemo ? [`demo-${currentDemo.id}`] : EMPTY_SELECTION;

    const handleSelectionChanged = (ids: string[]) => {
        const demo = selectedDemo(ids, demos);

        if (demo) {
            setCurrentDemo(demo);
        }
    };

    const handleActivate = (position: number) => {
        const item = collectVisibleItems(items, new Set(visibleExpandedIds))[position]?.value;

        if (item?.type === "demo") {
            setCurrentDemo(item.demo);
            onDemoActivated(item.demo);
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <SidebarSearch
                isSearchActive={isSearchActive}
                onSearchActiveChange={onSearchActiveChange}
                onSearchChanged={onSearchChanged}
                searchQuery={searchQuery}
            />
            <GtkScrolledWindow
                vexpand
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                propagateNaturalWidth
                cssClasses={["sidebar"]}
            >
                <ListView
                    accessibleLabel="Demos"
                    cssClasses={["navigation-sidebar"]}
                    expandedIds={visibleExpandedIds}
                    onExpandedChange={searchQuery.trim() ? undefined : setExpandedIds}
                    expanderDescriptions={EXPANDER_DESCRIPTIONS}
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    selectedIds={selected}
                    onSelectionChanged={handleSelectionChanged}
                    onActivate={handleActivate}
                    renderItem={renderItem}
                    items={items}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export { Sidebar };
