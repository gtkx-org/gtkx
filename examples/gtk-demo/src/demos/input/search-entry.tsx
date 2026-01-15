import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkSearchBar, GtkSearchEntry } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./search-entry.tsx?raw";

const SearchEntryDemo = () => {
    const [searchText, setSearchText] = useState("");

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <GtkSearchBar searchModeEnabled showCloseButton={false}>
                <GtkSearchEntry halign={Gtk.Align.CENTER} onSearchChanged={(entry) => setSearchText(entry.getText())} />
            </GtkSearchBar>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={18}
                marginStart={18}
                marginEnd={18}
                marginTop={18}
                marginBottom={18}
            >
                <GtkBox spacing={10}>
                    <GtkLabel label="Searching for:" xalign={0} />
                    <GtkLabel label={searchText} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const searchEntryDemo: Demo = {
    id: "search-entry",
    title: "Entry/Search Entry",
    description:
        "GtkSearchEntry provides an entry that is ready for search. Search entries have their search-changed signal delayed and should be used when the search operation is slow, such as big datasets to search, or online searches. GtkSearchBar allows have a hidden search entry that 'springs into action' upon keyboard input.",
    keywords: ["search", "entry", "filter", "GtkSearchEntry", "GtkSearchBar"],
    component: SearchEntryDemo,
    sourceCode,
};
