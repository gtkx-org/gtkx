import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkHeaderBar, GtkLabel, GtkSearchBar, GtkSearchEntry, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { createContext, useContext, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./search-entry.tsx?raw";

type SearchEntryContextValue = {
    searchText: string;
    setSearchText: (value: string) => void;
    isSearchActive: boolean;
    setIsSearchActive: (isEnabled: boolean) => void;
    handleToggleButtonClicked: (btn: Gtk.ToggleButton) => void;
};

const SearchEntryContext = createContext<SearchEntryContextValue | null>(null);

const searchEntryDemo: Demo = {
    id: "search-entry",
    title: "Entry/Search Entry",
    description:
        "GtkSearchEntry provides an entry that is ready for search.\n\nSearch entries have their " +
        "\"search-changed\" signal delayed and should be used when the search operation is slow, " +
        "such as big datasets to search, or online searches.\n\nGtkSearchBar allows have a hidden " +
        "search entry that 'springs into action' upon keyboard input.",
    keywords: [],
    component: SearchEntryDemo,
    titlebar: SearchEntryTitlebar,
    provider: SearchEntryProvider,
    sourceCode,
    windowTitle: "Type to Search",
    isResizable: false,
    defaultWidth: 200,
};

function useSearchEntryContext(): SearchEntryContextValue {
    const ctx = useContext(SearchEntryContext);

    if (!ctx) {
        throw new Error("SearchEntryContext is missing");
    }

    return ctx;
}

function SearchEntryProvider({ children }: DemoProviderProps) {
    const [searchText, setSearchText] = useState("");
    const [isSearchActive, setIsSearchActive] = useState(false);

    const handleToggleButtonClicked = (btn: Gtk.ToggleButton) => {
        setIsSearchActive(btn.getActive());
    };

    const value = {
        searchText,
        setSearchText,
        isSearchActive,
        setIsSearchActive,
        handleToggleButtonClicked,
    };

    return <SearchEntryContext.Provider value={value}>{children}</SearchEntryContext.Provider>;
}

function SearchEntryTitlebar() {
    const { isSearchActive, handleToggleButtonClicked } = useSearchEntryContext();

    return (
        <GtkHeaderBar
            end={(
                <GtkToggleButton
                    iconName="system-search-symbolic"
                    active={isSearchActive}
                    onToggled={handleToggleButtonClicked}
                />
            )}
        />
    );
}

function SearchEntryDemo() {
    const { searchText, setSearchText, isSearchActive, setIsSearchActive } = useSearchEntryContext();
    const parentWindow = useParentWindow();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <GtkSearchBar
                searchModeEnabled={isSearchActive}
                showCloseButton={false}
                keyCaptureWidget={parentWindow}
                onNotifySearchModeEnabled={(enabled) => {
                    setIsSearchActive(enabled ?? false);
                }}
            >
                <GtkSearchEntry
                    halign={Gtk.Align.CENTER}
                    onSearchChanged={(entry) => {
                        setSearchText(entry.getText());
                    }}
                />
            </GtkSearchBar>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={18}
                marginStart={18}
                marginEnd={18}
                marginTop={18}
                marginBottom={18}
            >
                <GtkLabel xalign={0}>{`Searching for: ${searchText}`}</GtkLabel>
            </GtkBox>
        </GtkBox>
    );
}

export { searchEntryDemo };
