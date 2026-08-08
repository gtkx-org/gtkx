import { type ExpanderDescriptions, type ListItem, type ListItemRenderer, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkInscription, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry } from "@gtkx/jsx/gtk";
import type { TreeItem } from "../demos/types.js";
import { collectExpandableIds } from "../collect-expandable-ids.js";
import { useDemo } from "../context/demo-context.js";

type SidebarProps = {
    isSearchActive: boolean;
    onSearchChanged: (text: string) => void;
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

const Sidebar = ({ isSearchActive, onSearchChanged }: SidebarProps) => {
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
            <GtkSearchBar name="sidebar-search-bar" searchModeEnabled={isSearchActive}>
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
                    expanderDescriptions={EXPANDER_DESCRIPTIONS}
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
