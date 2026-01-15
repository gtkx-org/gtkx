import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScrolledWindow, GtkSearchBar, GtkSearchEntry, x } from "@gtkx/react";
import { useDemo } from "../context/demo-context.js";
import type { Category, Demo } from "../demos/types.js";

type TreeItem = { type: "category"; data: Category } | { type: "demo"; data: Demo };

interface SidebarProps {
    searchMode: boolean;
    onSearchChanged: (text: string) => void;
}

export const Sidebar = ({ searchMode, onSearchChanged }: SidebarProps) => {
    const { filteredCategories, currentDemo, setCurrentDemo, searchQuery } = useDemo();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkSearchBar searchModeEnabled={searchMode}>
                <GtkSearchEntry
                    hexpand
                    text={searchQuery}
                    onSearchChanged={(entry: Gtk.SearchEntry) => onSearchChanged(entry.getText())}
                />
            </GtkSearchBar>
            <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER} cssClasses={["sidebar"]}>
                <x.TreeListView<TreeItem>
                    cssClasses={["navigation-sidebar"]}
                    autoexpand
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    selected={currentDemo ? [`demo-${currentDemo.id}`] : []}
                    onSelectionChanged={(ids) => {
                        const selectedId = ids[0];
                        if (!selectedId?.startsWith("demo-")) return;
                        const demoId = selectedId.slice(5);
                        for (const category of filteredCategories) {
                            const demo = category.demos.find((d) => d.id === demoId);
                            if (demo) {
                                setCurrentDemo(demo);
                                return;
                            }
                        }
                    }}
                    renderItem={(item) => {
                        if (!item) return null;

                        if (item.type === "category") {
                            return <GtkLabel label={item.data.title} hexpand halign={Gtk.Align.START} ellipsize={3} />;
                        }

                        return <GtkLabel label={item.data.title} hexpand halign={Gtk.Align.START} ellipsize={3} />;
                    }}
                >
                    {filteredCategories.map((category) => (
                        <x.TreeListItem
                            key={category.id}
                            id={`category-${category.id}`}
                            value={{ type: "category", data: category } as TreeItem}
                        >
                            {category.demos.map((demo) => (
                                <x.TreeListItem
                                    key={demo.id}
                                    id={`demo-${demo.id}`}
                                    value={{ type: "demo", data: demo } as TreeItem}
                                    hideExpander
                                />
                            ))}
                        </x.TreeListItem>
                    ))}
                </x.TreeListView>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
