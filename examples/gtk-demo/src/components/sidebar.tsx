import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkExpander,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScrolledWindow,
    GtkSearchEntry,
} from "@gtkx/react";
import { useDemo } from "../context/demo-context.js";

export const Sidebar = () => {
    const { filteredCategories, currentDemo, setCurrentDemo, searchQuery, setSearchQuery } = useDemo();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["sidebar"]}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} marginStart={8} marginEnd={8} marginTop={8} marginBottom={8}>
                <GtkSearchEntry
                    placeholderText="Search demos..."
                    text={searchQuery}
                    onSearchChanged={(entry: Gtk.SearchEntry) => setSearchQuery(entry.getText())}
                    hexpand
                />
            </GtkBox>

            <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["navigation-sidebar"]}>
                    {filteredCategories.map((category) => (
                        <GtkListBoxRow key={category.id} activatable={false}>
                            <GtkExpander label={category.title} expanded>
                                <GtkListBox
                                    onRowActivated={(_, row) => {
                                        const index = row.getIndex();
                                        const demo = category.demos[index];
                                        if (demo) {
                                            setCurrentDemo(demo);
                                        }
                                    }}
                                >
                                    {category.demos.map((demo) => (
                                        <GtkListBoxRow
                                            key={demo.id}
                                            name={`demo-${demo.id}`}
                                            cssClasses={currentDemo?.id === demo.id ? ["selected"] : []}
                                        >
                                            <GtkBox
                                                orientation={Gtk.Orientation.VERTICAL}
                                                spacing={2}
                                                marginTop={6}
                                                marginBottom={6}
                                                marginStart={12}
                                                marginEnd={12}
                                            >
                                                <GtkLabel
                                                    label={demo.title}
                                                    halign={Gtk.Align.START}
                                                    cssClasses={["heading"]}
                                                />
                                                <GtkLabel
                                                    label={demo.description}
                                                    halign={Gtk.Align.START}
                                                    cssClasses={["dim-label", "caption"]}
                                                    ellipsize={3}
                                                    lines={1}
                                                />
                                            </GtkBox>
                                        </GtkListBoxRow>
                                    ))}
                                </GtkListBox>
                            </GtkExpander>
                        </GtkListBoxRow>
                    ))}
                </GtkListBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
};
