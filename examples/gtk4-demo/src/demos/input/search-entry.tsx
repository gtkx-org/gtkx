import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkListBox, GtkListBoxRow, GtkScrolledWindow, GtkSearchEntry } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const fruits = [
    "Apple",
    "Apricot",
    "Banana",
    "Blueberry",
    "Cherry",
    "Cranberry",
    "Date",
    "Elderberry",
    "Fig",
    "Grape",
    "Honeydew",
    "Kiwi",
    "Lemon",
    "Lime",
    "Mango",
    "Nectarine",
    "Orange",
    "Papaya",
    "Peach",
    "Pear",
    "Pineapple",
    "Plum",
    "Raspberry",
    "Strawberry",
    "Watermelon",
];

const SearchEntryDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Search Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Search Input" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkSearchEntry is optimized for search with a built-in clear button and search icon."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkSearchEntry placeholderText="Search fruits..." />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Sample List" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Here's a list of fruits that could be filtered by a search."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkScrolledWindow vexpand heightRequest={200} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkListBox cssClasses={["boxed-list"]}>
                        {fruits.map((item) => (
                            <GtkListBoxRow key={item}>
                                <GtkLabel
                                    label={item}
                                    halign={Gtk.Align.START}
                                    marginStart={12}
                                    marginTop={8}
                                    marginBottom={8}
                                />
                            </GtkListBoxRow>
                        ))}
                    </GtkListBox>
                </GtkScrolledWindow>
            </GtkBox>
        </GtkBox>
    );
};

export const searchEntryDemo: Demo = {
    id: "search-entry",
    title: "Search Entry",
    description: "Text entry optimized for search with clear button and search icon.",
    keywords: ["search", "entry", "filter", "find", "GtkSearchEntry"],
    component: SearchEntryDemo,
    sourcePath: getSourcePath(import.meta.url, "search-entry.tsx"),
};
