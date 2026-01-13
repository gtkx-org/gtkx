import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkSearchEntry } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./search-entry.tsx?raw";

const items = [
    { id: 1, name: "Apple", category: "Fruit" },
    { id: 2, name: "Banana", category: "Fruit" },
    { id: 3, name: "Carrot", category: "Vegetable" },
    { id: 4, name: "Broccoli", category: "Vegetable" },
    { id: 5, name: "Orange", category: "Fruit" },
    { id: 6, name: "Spinach", category: "Vegetable" },
    { id: 7, name: "Mango", category: "Fruit" },
    { id: 8, name: "Potato", category: "Vegetable" },
    { id: 9, name: "Strawberry", category: "Fruit" },
    { id: 10, name: "Tomato", category: "Vegetable" },
    { id: 11, name: "Grapes", category: "Fruit" },
    { id: 12, name: "Cucumber", category: "Vegetable" },
];

const SearchEntryDemo = () => {
    const [searchText, setSearchText] = useState("");
    const [searchCount, setSearchCount] = useState(0);

    const filteredItems = items.filter(
        (item) =>
            item.name.toLowerCase().includes(searchText.toLowerCase()) ||
            item.category.toLowerCase().includes(searchText.toLowerCase()),
    );

    const handleSearchChanged = (entry: Gtk.SearchEntry) => {
        setSearchText(entry.getText());
        setSearchCount((prev) => prev + 1);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Search Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Live Search Filter" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkSearchEntry is optimized for search input. It shows a search icon and clear button, and emits search-changed signal with a short delay for reactive filtering."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkSearchEntry
                    text={searchText}
                    placeholderText="Search fruits and vegetables..."
                    onSearchChanged={handleSearchChanged}
                />

                <GtkLabel
                    label={`Showing ${filteredItems.length} of ${items.length} items (${searchCount} searches)`}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} cssClasses={["card"]}>
                    {filteredItems.length === 0 ? (
                        <GtkLabel
                            label="No items found"
                            cssClasses={["dim-label"]}
                            marginStart={12}
                            marginTop={8}
                            marginBottom={8}
                        />
                    ) : (
                        filteredItems.map((item) => (
                            <GtkBox
                                key={item.id}
                                spacing={8}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={4}
                                marginBottom={4}
                            >
                                <GtkLabel label={item.name} hexpand halign={Gtk.Align.START} />
                                <GtkLabel label={item.category} cssClasses={["dim-label"]} />
                            </GtkBox>
                        ))
                    )}
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Search with Custom Delay" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="You can customize the search delay (in milliseconds) to control how quickly the search-changed signal fires after typing stops."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Default delay (150ms):" halign={Gtk.Align.START} />
                    <GtkSearchEntry placeholderText="Default delay..." />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Longer delay (500ms):" halign={Gtk.Align.START} />
                    <GtkSearchEntry placeholderText="Longer delay..." searchDelay={500} />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Instant (0ms):" halign={Gtk.Align.START} />
                    <GtkSearchEntry placeholderText="Instant search..." searchDelay={0} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`- Automatic search icon
- Clear button when text is present
- Debounced search-changed signal
- Caps Lock warning
- Keyboard navigation signals (previous-match, next-match, stop-search)`}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const searchEntryDemo: Demo = {
    id: "search-entry",
    title: "Entry/Search Entry",
    description: "GtkSearchEntry for filtering and searching content.",
    keywords: ["search", "entry", "filter", "GtkSearchEntry", "find"],
    component: SearchEntryDemo,
    sourceCode,
};
