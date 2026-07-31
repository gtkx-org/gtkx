import { type ListItemRenderer, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkInscription, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import type { TreeItem } from "../demos/types.js";
import { useDemo } from "../context/demo-context.js";

type SidebarProps = {
    searchMode: boolean;
    onSearchChanged: (text: string) => void;
};

type SidebarItemData = {
    id: string;
    value: TreeItem;
    hideExpander?: true;
    children?: SidebarItemData[];
};

const EMPTY_SELECTION: string[] = [];

function treeItemToData(item: TreeItem): SidebarItemData {
    if (item.type === "demo") {
        return { id: `demo-${item.demo.id}`, value: item, hideExpander: true };
    }

    return {
        id: `category-${item.title}`,
        value: item,
        children: item.children.map((child) => treeItemToData(child)),
    };
}

const collectExpandableIds = (nodes: SidebarItemData[]): string[] => {
    const ids: string[] = [];

    for (const node of nodes) {
        if (node.children && node.children.length > 0) {
            ids.push(node.id, ...collectExpandableIds(node.children));
        }
    }

    return ids;
};

const renderItem: ListItemRenderer<TreeItem> = ({ item }) => {
    const text = item.type === "category" ? item.title : item.displayTitle;

    return <GtkInscription text={text} natChars={25} textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END} />;
};

const Sidebar = ({ searchMode, onSearchChanged }: SidebarProps) => {
    const { filteredTreeItems, currentDemo, setCurrentDemo, searchQuery, demos } = useDemo();
    const items = filteredTreeItems.map((item) => treeItemToData(item));
    const expandedIds = collectExpandableIds(items);
    const selected = currentDemo ? [`demo-${currentDemo.id}`] : EMPTY_SELECTION;

    const handleSelectionChanged = (ids: string[]) => {
        const selectedId = ids[0];

        if (!selectedId?.startsWith("demo-")) {
            return;
        }

        const demoId = selectedId.slice(5);
        const demo = demos.find((d) => d.id === demoId);

        if (demo) {
            setCurrentDemo(demo);
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar name="sidebar-search-bar" searchModeEnabled={searchMode}>
                <GtkSearchEntry
                    text={searchQuery}
                    onSearchChanged={(entry: Gtk.SearchEntry) => {
                        onSearchChanged(entry.getText());
                    }}
                />
            </GtkSearchBar>
            <GtkScrolledWindow
                vexpand
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                propagateNaturalWidth
                cssClasses={["sidebar"]}
            >
                <ListView
                    name="sidebar-list"
                    cssClasses={["navigation-sidebar"]}
                    expandedIds={expandedIds}
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    selectedIds={selected}
                    onSelectionChanged={handleSelectionChanged}
                    renderItem={renderItem}
                    items={items}
                />
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export { Sidebar };
