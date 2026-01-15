import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkSearchBar, GtkSearchEntry, GtkToggleButton } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./search-entry.tsx?raw";

const SearchEntryDemo = () => {
    const [searchText, setSearchText] = useState("");
    const [searchMode, setSearchMode] = useState(false);
    const searchBarRef = useRef<Gtk.SearchBar | null>(null);
    const containerRef = useRef<Gtk.Box | null>(null);

    useEffect(() => {
        const searchBar = searchBarRef.current;
        const container = containerRef.current;
        if (!searchBar || !container) return;

        const root = container.getRoot();
        if (root) {
            searchBar.setKeyCaptureWidget(root as unknown as Gtk.Widget);
        }
    }, []);

    const handleSearchModeToggle = useCallback((enabled: boolean) => {
        setSearchMode(enabled);
    }, []);

    const handleToggleButtonClicked = useCallback((btn: Gtk.ToggleButton) => {
        setSearchMode(btn.getActive());
    }, []);

    return (
        <GtkBox ref={containerRef} orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <GtkBox marginStart={12} marginEnd={12} marginTop={6} marginBottom={6}>
                <GtkToggleButton
                    iconName="edit-find-symbolic"
                    active={searchMode}
                    onToggled={handleToggleButtonClicked}
                    tooltipText="Toggle search (or just start typing)"
                />
            </GtkBox>
            <GtkSearchBar
                ref={searchBarRef}
                searchModeEnabled={searchMode}
                showCloseButton
                onNotify={(self, prop) => {
                    if (prop === "search-mode-enabled") {
                        handleSearchModeToggle(self.getSearchMode());
                    }
                }}
            >
                <GtkSearchEntry
                    halign={Gtk.Align.CENTER}
                    widthChars={40}
                    onSearchChanged={(entry) => setSearchText(entry.getText())}
                />
            </GtkSearchBar>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={18}
                marginStart={18}
                marginEnd={18}
                marginTop={18}
                marginBottom={18}
                vexpand
            >
                <GtkLabel
                    label="Start typing anywhere to search..."
                    cssClasses={["dim-label"]}
                    visible={!searchMode && searchText.length === 0}
                />
                <GtkBox spacing={10} visible={searchText.length > 0}>
                    <GtkLabel label="Searching for:" xalign={0} />
                    <GtkLabel label={searchText} cssClasses={["accent"]} />
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
