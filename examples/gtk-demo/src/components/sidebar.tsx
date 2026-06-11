import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkInscription, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import { GtkListView } from "@gtkx/react";
import { useDemo } from "../context/demo-context.js";
import type { TreeItem } from "../demos/types.js";

interface SidebarProps {
    searchMode: boolean;
    onSearchChanged: (text: string) => void;
}

interface SidebarItemData {
    id: string;
    value: TreeItem;
    hideExpander?: true;
    children?: SidebarItemData[];
}

function treeItemToData(item: TreeItem): SidebarItemData {
    if (item.type === "demo") {
        return { id: `demo-${item.demo.id}`, value: item, hideExpander: true };
    }
    return {
        id: `category-${item.title}`,
        value: item,
        children: item.children.map(treeItemToData),
    };
}

const EMPTY_SELECTION: string[] = [];

const renderItem = (item: TreeItem) => {
    const text = item.type === "category" ? item.title : item.displayTitle;
    return <GtkInscription text={text} natChars={25} textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END} />;
};

export const Sidebar = ({ searchMode, onSearchChanged }: SidebarProps) => {
    const { filteredTreeItems, currentDemo, setCurrentDemo, searchQuery, demos } = useDemo();

    const items = filteredTreeItems.map(treeItemToData);

    const selected = currentDemo ? [`demo-${currentDemo.id}`] : EMPTY_SELECTION;

    const handleSelectionChanged = (ids: string[]) => {
        const selectedId = ids[0];
        if (!selectedId?.startsWith("demo-")) return;
        const demoId = selectedId.slice(5);
        const demo = demos.find((d) => d.id === demoId);
        if (demo) setCurrentDemo(demo);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="sidebar-search-bar" searchModeEnabled={searchMode}>
                <GtkSearchEntry
                    text={searchQuery}
                    onSearchChanged={(entry: Gtk.SearchEntry) => onSearchChanged(entry.getText())}
                />
            </GtkSearchBar>
            <GtkScrolledWindow
                vexpand
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                propagateNaturalWidth
                cssClasses={["sidebar"]}
            >
                <GtkListView
                    name="sidebar-list"
                    cssClasses={["navigation-sidebar"]}
                    autoexpand
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    selected={selected}
                    onSelectionChanged={handleSelectionChanged}
                    renderItem={renderItem}
                    items={items}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};
