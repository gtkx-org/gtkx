import { DropDown } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import * as PangoCairo from "@gtkx/gi/pangocairo";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkEventControllerKey,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkMenuButton,
    GtkPopover,
    GtkScrolledWindow,
    GtkSeparator,
    GtkSpinButton,
} from "@gtkx/jsx/gtk";
import { readdirSync, statSync } from "node:fs";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-selections.tsx?raw";

type EventResult = typeof Gdk.EVENT_PROPAGATE | typeof Gdk.EVENT_STOP;

type SuggestionEntryProps = {
    words: string[];
    placeholder: string;
    name?: string;
};

type SuggestionEntryViewProps = {
    name?: string | undefined;
    placeholder: string;
    query: string;
    matches: string[];
    entryRef: React.RefObject<Gtk.Entry | null>;
    popoverRef: React.RefObject<Gtk.Popover | null>;
    listBoxRef: React.RefObject<Gtk.ListBox | null>;
    onChanged: (entry: Gtk.Entry) => void;
    onKeyPressed: (keyval: number) => EventResult;
    onClosed: () => void;
    onRowActivated: (index: number) => EventResult;
};

type SuggestionState = {
    words: string[];
    matches: string[];
    selected: number;
    setQuery: (value: string) => void;
    setSelected: (updater: (current: number) => number) => void;
    setIsOpen: (isOpen: boolean) => void;
};

type Device = (typeof devices)[number];

type DirEntry = {
    path: string;
    name: string;
    icon: string;
};

const times = ["1 minute", "2 minutes", "5 minutes", "20 minutes"];

const minutes = [
    "1 minute",
    "2 minutes",
    "5 minutes",
    "10 minutes",
    "15 minutes",
    "20 minutes",
    "25 minutes",
    "30 minutes",
    "35 minutes",
    "40 minutes",
    "45 minutes",
    "50 minutes",
    "55 minutes",
];

const hours = [
    "1 hour",
    "2 hours",
    "3 hours",
    "5 hours",
    "6 hours",
    "7 hours",
    "8 hours",
    "9 hours",
    "10 hours",
    "11 hours",
    "12 hours",
];

const devices = [
    { id: "digital1", title: "Digital Output", icon: "audio-card-symbolic", description: "Built-in Audio" },
    { id: "headphones", title: "Headphones", icon: "audio-headphones-symbolic", description: "Built-in audio" },
    {
        id: "digital2",
        title: "Digital Output",
        icon: "audio-card-symbolic",
        description: "Thinkpad Tunderbolt 3 Dock USB Audio",
    },
    {
        id: "analog",
        title: "Analog Output",
        icon: "audio-card-symbolic",
        description: "Thinkpad Tunderbolt 3 Dock USB Audio",
    },
];

const suggestionWords = [
    "GNOME",
    "gnominious",
    "Gnomonic projection",
    "total",
    "totally",
    "toto",
    "tottery",
    "totterer",
    "Totten trust",
    "totipotent",
    "totipotency",
    "totemism",
    "totem pole",
    "Totara",
    "totalizer",
    "totalizator",
    "totalitarianism",
    "total parenteral nutrition",
    "total hysterectomy",
    "total eclipse",
    "Totipresence",
    "Totipalmi",
    "Tomboy",
    "zombie",
];

const destinationWords = ["app-mockups", "settings-mockups", "os-mockups", "software-mockups", "mocktails"];

const getFontFamilies = (() => {
    let cache: string[] | undefined;

    return (): string[] => {
        cache ??= loadFontFamilies();

        return cache;
    };
})();

const getDirectoryEntries = (() => {
    let cache: DirEntry[] | undefined;

    return (): DirEntry[] => {
        cache ??= loadDirectoryEntries();

        return cache;
    };
})();

const listviewSelectionsDemo: Demo = {
    id: "listview-selections",
    title: "Lists/Selections",
    description:
        "The GtkDropDown widget presents a list of choices. It is backed by a list model, and each item is " +
        "displayed with a widget produced by a factory.\n\nThis example also shows a custom entry that " +
        "completes what you type from a word list and offers the matches in a popover. It is not part of GTK.",
    keywords: ["suggestion", "completion"],
    component: ListViewSelectionsDemo,
    sourceCode,
    windowTitle: "Selections",
    isResizable: false,
};

function logError(error: unknown) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}

function loadFontFamilies(): string[] {
    const fontMap = PangoCairo.FontMap.getDefault();
    const count = fontMap.getNItems();
    const names: string[] = [];

    for (let index = 0; index < count; index++) {
        const family = fontMap.getItem(index);

        if (family instanceof Pango.FontFamily) {
            names.push(family.getName());
        }
    }

    return names.toSorted((a, b) => a.localeCompare(b));
}

function escapeMarkup(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function highlightMatch(word: string, query: string): string {
    if (query.length === 0) {
        return escapeMarkup(word);
    }

    const lower = word.toLowerCase();
    const queryLower = query.toLowerCase();
    const idx = lower.indexOf(queryLower);

    if (idx === -1) {
        return escapeMarkup(word);
    }

    const before = escapeMarkup(word.slice(0, idx));
    const match = escapeMarkup(word.slice(idx, idx + query.length));
    const after = escapeMarkup(word.slice(idx + query.length));

    return `${before}<b>${match}</b>${after}`;
}

function findSuggestions(words: string[], text: string): string[] {
    if (text.length === 0) {
        return [];
    }

    const lower = text.toLowerCase();

    return words.filter((word) => word.toLowerCase().includes(lower)).slice(0, 10);
}

function acceptSuggestion(state: SuggestionState, entry: Gtk.Entry | null, index: number): EventResult {
    const word = state.matches[index];

    if (!entry || word === undefined) {
        return Gdk.EVENT_PROPAGATE;
    }

    entry.setText(word);
    entry.setPosition(-1);
    state.setIsOpen(false);

    return Gdk.EVENT_STOP;
}

function moveSuggestionSelection(state: SuggestionState, delta: number): void {
    if (state.matches.length === 0) {
        return;
    }

    state.setSelected((current) => (current + delta + state.matches.length) % state.matches.length);
}

function handleSuggestionChanged(state: SuggestionState, entry: Gtk.Entry): void {
    const text = entry.getText();
    state.setQuery(text);
    state.setSelected(() => -1);
    state.setIsOpen(findSuggestions(state.words, text).length > 0);
}

function handleSuggestionKey(state: SuggestionState, entry: Gtk.Entry | null, keyval: number): EventResult {
    if (state.matches.length === 0) {
        return Gdk.EVENT_PROPAGATE;
    }

    switch (keyval) {
        case Gdk.KEY_Down: {
            moveSuggestionSelection(state, 1);

            return Gdk.EVENT_STOP;
        }
        case Gdk.KEY_Up: {
            moveSuggestionSelection(state, -1);

            return Gdk.EVENT_STOP;
        }
        case Gdk.KEY_Return:
        case Gdk.KEY_KP_Enter: {
            return acceptSuggestion(state, entry, state.selected);
        }
        case Gdk.KEY_Escape: {
            state.setIsOpen(false);

            return Gdk.EVENT_STOP;
        }
        default: {
            return Gdk.EVENT_PROPAGATE;
        }
    }
}

function syncPopoverVisibility(popover: Gtk.Popover | null, isOpen: boolean): void {
    if (!popover) {
        return;
    }

    if (isOpen) {
        popover.popup();
    } else {
        popover.popdown();
    }
}

function syncSelectedRow(listBox: Gtk.ListBox | null, selected: number): void {
    if (!listBox || selected < 0) {
        return;
    }

    const row = listBox.getRowAtIndex(selected);

    if (row) {
        listBox.selectRow(row);
    }
}

const SuggestionEntryView = ({
    name,
    placeholder,
    query,
    matches,
    entryRef,
    popoverRef,
    listBoxRef,
    onChanged,
    onKeyPressed,
    onClosed,
    onRowActivated,
}: SuggestionEntryViewProps) => (
    <GtkEntry
        ref={entryRef}
        name={name}
        hexpand
        placeholderText={placeholder}
        onChanged={onChanged}
        controllers={(
            <GtkEventControllerKey propagationPhase={Gtk.PropagationPhase.CAPTURE} onKeyPressed={onKeyPressed} />
        )}
    >
        <GtkPopover
            ref={popoverRef}
            name={name ? `${name}-popover` : undefined}
            hasArrow={false}
            position={Gtk.PositionType.BOTTOM}
            autohide={false}
            onClosed={onClosed}
        >
            <GtkScrolledWindow maxContentHeight={400} propagateNaturalHeight hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkListBox
                    ref={listBoxRef}
                    selectionMode={Gtk.SelectionMode.BROWSE}
                    onRowActivated={(row) => onRowActivated(row.getIndex())}
                >
                    {matches.map((word) => (
                        <GtkListBoxRow key={`${query}:${word}`}>
                            <GtkLabel useMarkup xalign={0} hexpand>
                                {highlightMatch(word, query)}
                            </GtkLabel>
                        </GtkListBoxRow>
                    ))}
                </GtkListBox>
            </GtkScrolledWindow>
        </GtkPopover>
    </GtkEntry>
);

const SuggestionEntry = ({ words, placeholder, name }: SuggestionEntryProps) => {
    const entryRef = useRef<Gtk.Entry | null>(null);
    const popoverRef = useRef<Gtk.Popover | null>(null);
    const listBoxRef = useRef<Gtk.ListBox | null>(null);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(-1);
    const [isOpen, setIsOpen] = useState(false);
    const matches = findSuggestions(words, query);
    const state: SuggestionState = { words, matches, selected, setQuery, setSelected, setIsOpen };

    useEffect(() => {
        syncPopoverVisibility(popoverRef.current, isOpen);
    }, [isOpen]);

    useEffect(() => {
        syncSelectedRow(listBoxRef.current, selected);
    }, [selected]);

    return (
        <SuggestionEntryView
            name={name}
            placeholder={placeholder}
            query={query}
            matches={matches}
            entryRef={entryRef}
            popoverRef={popoverRef}
            listBoxRef={listBoxRef}
            onChanged={(entry) => {
                handleSuggestionChanged(state, entry);
            }}
            onKeyPressed={(keyval) => handleSuggestionKey(state, entryRef.current, keyval)}
            onClosed={() => {
                setIsOpen(false);
            }}
            onRowActivated={(index) => acceptSuggestion(state, entryRef.current, index)}
        />
    );
};

const renderSelectableTimeItem = (label: string, selectedId: string) => (
    <GtkBox spacing={10}>
        <GtkLabel xalign={0} hexpand>
            {label}
        </GtkLabel>
        <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1 : 0} />
    </GtkBox>
);

const TimesDropDown = () => {
    const [selectedId, setSelectedId] = useState(times[0] ?? "");

    return (
        <DropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            renderListItem={({ item: label }: { item: string }) => renderSelectableTimeItem(label, selectedId)}
            items={times.map((t) => ({ id: t, value: t }))}
        />
    );
};

const TimesSectionedDropDown = () => {
    const [selectedId, setSelectedId] = useState(minutes[0] ?? "");

    return (
        <DropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            enableSearch
            renderListItem={({ item: label }: { item: string }) => renderSelectableTimeItem(label, selectedId)}
            renderHeader={({ section: value }: { section: string }) => (
                <GtkLabel useMarkup xalign={0} marginTop={10} marginBottom={10}>
                    {`<big><b>${escapeMarkup(value)}</b></big>`}
                </GtkLabel>
            )}
            sections={[
                {
                    id: "minutes",
                    value: "Minutes",
                    data: minutes.map((m) => ({ id: m, value: m })),
                },
                {
                    id: "hours",
                    value: "Hours",
                    data: hours.map((h) => ({ id: h, value: h })),
                },
            ]}
        />
    );
};

const renderDeviceRow = (label: string, renderDetails: (device: Device) => ReactNode) => {
    const device = devices.find((d) => d.id === label);

    if (!device) {
        return <GtkLabel>{label}</GtkLabel>;
    }

    return (
        <GtkBox spacing={10}>
            <GtkImage iconName={device.icon} />
            {renderDetails(device)}
        </GtkBox>
    );
};

const DevicesDropDown = () => {
    const [selectedId, setSelectedId] = useState(devices[0]?.id ?? "");

    return (
        <DropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            renderItem={({ item: label }: { item: string }) =>
                renderDeviceRow(label, (device) => (
                    <GtkLabel xalign={0} hexpand>
                        {device.title}
                    </GtkLabel>
                ))}
            renderListItem={({ item: label }: { item: string }) =>
                renderDeviceRow(label, (device) => (
                    <>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2}>
                            <GtkLabel xalign={0}>{device.title}</GtkLabel>
                            <GtkLabel xalign={0} cssClasses={["dim-label"]}>
                                {device.description}
                            </GtkLabel>
                        </GtkBox>
                        <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1 : 0} />
                    </>
                ))}
            items={devices.map((d) => ({ id: d.id, value: d.id }))}
        />
    );
};

function isDirectoryPath(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    } catch (error) {
        logError(error);

        return false;
    }
}

function toDirEntry(cwd: string, name: string): DirEntry {
    return {
        path: name,
        name,
        icon: isDirectoryPath(`${cwd}/${name}`) ? "folder-symbolic" : "text-x-generic-symbolic",
    };
}

function loadDirectoryEntries(): DirEntry[] {
    const cwd = process.cwd();

    try {
        return readdirSync(cwd)
            .map((name) => toDirEntry(cwd, name))
            .toSorted((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        logError(error);

        return [];
    }
}

const DirectorySuggestionEntry = () => {
    const [text, setText] = useState("");
    const entries = getDirectoryEntries();

    return (
        <GtkBox cssClasses={["linked"]}>
            <GtkEntry
                name="directory-entry"
                text={text}
                hexpand
                onChanged={(entry) => {
                    setText(entry.getText());
                }}
            />
            <GtkMenuButton
                name="directory-menu-button"
                iconName="pan-down-symbolic"
                tooltipText="Show suggestions"
                popover={(
                    <GtkPopover hasArrow={false} position={Gtk.PositionType.BOTTOM}>
                        <GtkScrolledWindow
                            maxContentHeight={400}
                            propagateNaturalHeight
                            hscrollbarPolicy={Gtk.PolicyType.NEVER}
                        >
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                                {entries.map((entry) => (
                                    <GtkButton
                                        key={entry.path}
                                        cssClasses={["flat"]}
                                        onClicked={() => {
                                            setText(entry.name);
                                        }}
                                    >
                                        <GtkBox spacing={8}>
                                            <GtkImage iconName={entry.icon} />
                                            <GtkLabel halign={Gtk.Align.START} hexpand>
                                                {entry.name}
                                            </GtkLabel>
                                        </GtkBox>
                                    </GtkButton>
                                ))}
                            </GtkBox>
                        </GtkScrolledWindow>
                    </GtkPopover>
                )}
            />
        </GtkBox>
    );
};

function selectFontByIndex(value: number, setFontIndex: (index: number) => void): void {
    const index = Math.round(value);

    if (index >= 0 && index < getFontFamilies().length) {
        setFontIndex(index);
    }
}

function selectFontById(id: string, setFontIndex: (index: number) => void): void {
    const index = getFontFamilies().indexOf(id);

    if (index !== -1) {
        setFontIndex(index);
    }
}

const FontsSelector = () => {
    const [fontIndex, setFontIndex] = useState(0);
    const [isFontSearchEnabled, setIsFontSearchEnabled] = useState(false);

    return (
        <>
            <DropDown
                name="fonts-dropdown"
                selectedId={getFontFamilies()[fontIndex] ?? ""}
                enableSearch={isFontSearchEnabled}
                onSelectionChanged={(id) => {
                    selectFontById(id, setFontIndex);
                }}
                items={getFontFamilies().map((f) => ({ id: f, value: f }))}
            />
            <GtkSpinButton
                name="font-spin"
                halign={Gtk.Align.START}
                marginStart={20}
                adjustment={(
                    <GtkAdjustment value={fontIndex} lower={-1} upper={getFontFamilies().length} stepIncrement={1} />
                )}
                onValueChanged={(spin) => {
                    selectFontByIndex(spin.getValue(), setFontIndex);
                }}
            />
            <GtkCheckButton
                name="enable-search-check"
                label="Enable search"
                marginStart={20}
                active={isFontSearchEnabled}
                onToggled={(btn) => {
                    setIsFontSearchEnabled(btn.getActive());
                }}
            />
        </>
    );
};

const DropdownsColumn = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
        <GtkLabel cssClasses={["title-4"]}>Dropdowns</GtkLabel>
        <TimesDropDown />
        <TimesSectionedDropDown />
        <FontsSelector />
        <DevicesDropDown />
    </GtkBox>
);

const SuggestionsColumn = () => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
        <GtkLabel cssClasses={["title-4"]}>Suggestions</GtkLabel>
        <SuggestionEntry name="words-entry" words={suggestionWords} placeholder="Words with T or G…" />
        <DirectorySuggestionEntry />
        <SuggestionEntry words={destinationWords} placeholder="Destination" />
    </GtkBox>
);

function ListViewSelectionsDemo() {
    return (
        <GtkBox spacing={20} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <DropdownsColumn />
            <GtkSeparator name="column-separator" orientation={Gtk.Orientation.VERTICAL} />
            <SuggestionsColumn />
        </GtkBox>
    );
}

export { listviewSelectionsDemo };
