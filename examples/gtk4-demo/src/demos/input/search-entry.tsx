import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, ListBox, ListBoxRow, ScrolledWindow, SearchEntry } from "@gtkx/gtkx";
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

export const SearchEntryDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Search Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Search Input" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="SearchEntry is optimized for search with a built-in clear button and search icon."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <SearchEntry placeholderText="Search fruits..." />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Sample List" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Here's a list of fruits that could be filtered by a search."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <ScrolledWindow vexpand heightRequest={200} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <ListBox cssClasses={["boxed-list"]}>
                        {fruits.map((item) => (
                            <ListBoxRow key={item}>
                                <Label.Root
                                    label={item}
                                    halign={Gtk.Align.START}
                                    marginStart={12}
                                    marginTop={8}
                                    marginBottom={8}
                                />
                            </ListBoxRow>
                        ))}
                    </ListBox>
                </ScrolledWindow>
            </Box>
        </Box>
    );
};

export const searchEntryDemo: Demo = {
    id: "search-entry",
    title: "Search Entry",
    description: "Text entry optimized for search with clear button and search icon.",
    keywords: ["search", "entry", "filter", "find", "GtkSearchEntry"],
    component: SearchEntryDemo,
    source: `const SearchEntryDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <SearchEntry placeholderText="Search..." />
            <ListBox>
                {items.map((item) => (
                    <ListBoxRow key={item}>
                        <Label.Root label={item} />
                    </ListBoxRow>
                ))}
            </ListBox>
        </Box>
    );
};`,
};
