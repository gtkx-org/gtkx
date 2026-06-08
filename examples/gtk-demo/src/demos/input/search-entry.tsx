import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkHeaderBar, GtkLabel, GtkSearchBar, GtkSearchEntry, GtkToggleButton } from "@gtkx/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Demo, DemoProps, DemoProviderProps } from "../types.js";
import sourceCode from "./search-entry.tsx?raw";

interface SearchEntryContextValue {
    searchText: string;
    setSearchText: (value: string) => void;
    searchMode: boolean;
    setSearchMode: (value: boolean) => void;
    handleToggleButtonClicked: (btn: Gtk.ToggleButton) => void;
}

const SearchEntryContext = createContext<SearchEntryContextValue | null>(null);

const useSearchEntryContext = (): SearchEntryContextValue => {
    const ctx = useContext(SearchEntryContext);
    if (!ctx) throw new Error("SearchEntryContext is missing");
    return ctx;
};

const SearchEntryProvider = ({ children }: DemoProviderProps) => {
    const [searchText, setSearchText] = useState("");
    const [searchMode, setSearchMode] = useState(false);

    const handleToggleButtonClicked = useCallback((btn: Gtk.ToggleButton) => {
        setSearchMode(btn.getActive());
    }, []);

    const value = useMemo<SearchEntryContextValue>(
        () => ({ searchText, setSearchText, searchMode, setSearchMode, handleToggleButtonClicked }),
        [searchText, searchMode, handleToggleButtonClicked],
    );

    return <SearchEntryContext.Provider value={value}>{children}</SearchEntryContext.Provider>;
};

const SearchEntryTitlebar = () => {
    const { searchMode, handleToggleButtonClicked } = useSearchEntryContext();
    return (
        <GtkHeaderBar
            packEnd={
                <GtkToggleButton
                    iconName="system-search-symbolic"
                    active={searchMode}
                    onToggled={handleToggleButtonClicked}
                />
            }
        />
    );
};

const SearchEntryDemo = ({ window }: DemoProps) => {
    const { searchText, setSearchText, searchMode, setSearchMode } = useSearchEntryContext();
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            <GtkSearchBar
                searchModeEnabled={searchMode}
                showCloseButton={false}
                keyCaptureWidget={window.current}
                onNotifySearchModeEnabled={(enabled) => setSearchMode(enabled ?? false)}
            >
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
        "GtkSearchEntry provides an entry that is ready for search.\n\nSearch entries have their \"search-changed\" signal delayed and should be used when the search operation is slow, such as big datasets to search, or online searches.\n\nGtkSearchBar allows have a hidden search entry that 'springs into action' upon keyboard input.",
    keywords: [],
    component: SearchEntryDemo,
    titlebar: SearchEntryTitlebar,
    provider: SearchEntryProvider,
    sourceCode,
    windowTitle: "Type to Search",
    resizable: false,
    defaultWidth: 200,
};
