import { readdirSync, statSync } from "node:fs";
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
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-selections.tsx?raw";

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

function loadFontFamilies(): string[] {
    const fontMap = PangoCairo.fontMapGetDefault();
    const count = fontMap.getNItems();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
        const family = fontMap.getItem(i);
        if (family instanceof Pango.FontFamily) names.push(family.getName());
    }
    return names.sort((a, b) => a.localeCompare(b));
}

let fontFamilies: string[] | undefined;
function getFontFamilies() {
    if (!fontFamilies) {
        fontFamilies = loadFontFamilies();
    }
    return fontFamilies;
}

function escapeMarkup(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function highlightMatch(word: string, query: string): string {
    if (query.length === 0) return escapeMarkup(word);

    const lower = word.toLowerCase();
    const queryLower = query.toLowerCase();
    const idx = lower.indexOf(queryLower);
    if (idx === -1) return escapeMarkup(word);

    const before = escapeMarkup(word.slice(0, idx));
    const match = escapeMarkup(word.slice(idx, idx + query.length));
    const after = escapeMarkup(word.slice(idx + query.length));
    return `${before}<b>${match}</b>${after}`;
}

const findSuggestions = (words: string[], text: string): string[] => {
    if (text.length < 1) return [];
    const lower = text.toLowerCase();
    return words.filter((word) => word.toLowerCase().includes(lower)).slice(0, 10);
};

interface SuggestionEntryViewProps {
    name?: string | undefined;
    placeholder: string;
    query: string;
    matches: string[];
    entryRef: React.RefObject<Gtk.Entry | null>;
    popoverRef: React.RefObject<Gtk.Popover | null>;
    listBoxRef: React.RefObject<Gtk.ListBox | null>;
    onChanged: (entry: Gtk.Entry) => void;
    onKeyPressed: (keyval: number) => boolean;
    onClosed: () => void;
    onRowActivated: (index: number) => boolean;
}

const renderSuggestionEntry = ({
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
        controllers={<GtkEventControllerKey onKeyPressed={onKeyPressed} />}
    >
        <GtkPopover
            ref={popoverRef}
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
                            <GtkLabel label={highlightMatch(word, query)} useMarkup xalign={0} hexpand />
                        </GtkListBoxRow>
                    ))}
                </GtkListBox>
            </GtkScrolledWindow>
        </GtkPopover>
    </GtkEntry>
);

interface SuggestionHandlerDeps {
    words: string[];
    matches: string[];
    selected: number;
    entryRef: React.RefObject<Gtk.Entry | null>;
    setQuery: (value: string) => void;
    setSelected: (updater: (current: number) => number) => void;
    setOpen: (value: boolean) => void;
}

interface SuggestionHandlers {
    accept: (index: number) => boolean;
    handleChanged: (entry: Gtk.Entry) => void;
    handleKeyPressed: (keyval: number) => boolean;
}

const createSuggestionHandlers = (deps: SuggestionHandlerDeps): SuggestionHandlers => {
    const { words, matches, selected, entryRef, setQuery, setSelected, setOpen } = deps;

    const accept = (index: number): boolean => {
        const entry = entryRef.current;
        const word = matches[index];
        if (!entry || word === undefined) return false;
        entry.setText(word);
        entry.setPosition(-1);
        setOpen(false);
        return true;
    };

    const move = (delta: number): void => {
        if (matches.length === 0) return;
        setSelected((current) => (current + delta + matches.length) % matches.length);
    };

    const handleChanged = (entry: Gtk.Entry): void => {
        const text = entry.getText();
        setQuery(text);
        setSelected(() => -1);
        setOpen(findSuggestions(words, text).length > 0);
    };

    const handleKeyPressed = (keyval: number): boolean => {
        if (matches.length === 0) return false;
        if (keyval === Gdk.KEY_Down) {
            move(1);
            return true;
        }
        if (keyval === Gdk.KEY_Up) {
            move(-1);
            return true;
        }
        if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) return accept(selected);
        if (keyval === Gdk.KEY_Escape) {
            setOpen(false);
            return true;
        }
        return false;
    };

    return { accept, handleChanged, handleKeyPressed };
};

const SuggestionEntry = ({ words, placeholder, name }: { words: string[]; placeholder: string; name?: string }) => {
    const entryRef = useRef<Gtk.Entry | null>(null);
    const popoverRef = useRef<Gtk.Popover | null>(null);
    const listBoxRef = useRef<Gtk.ListBox | null>(null);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(-1);
    const [open, setOpen] = useState(false);
    const matches = findSuggestions(words, query);
    const { accept, handleChanged, handleKeyPressed } = createSuggestionHandlers({
        words,
        matches,
        selected,
        entryRef,
        setQuery,
        setSelected,
        setOpen,
    });

    useEffect(() => {
        const popover = popoverRef.current;
        if (!popover) return;
        if (open) popover.popup();
        else popover.popdown();
    }, [open]);

    useEffect(() => {
        const listBox = listBoxRef.current;
        if (!listBox || selected < 0) return;
        const row = listBox.getRowAtIndex(selected);
        if (row) listBox.selectRow(row);
    }, [selected]);

    return renderSuggestionEntry({
        name,
        placeholder,
        query,
        matches,
        entryRef,
        popoverRef,
        listBoxRef,
        onChanged: handleChanged,
        onKeyPressed: handleKeyPressed,
        onClosed: () => setOpen(false),
        onRowActivated: accept,
    });
};

const renderSelectableTimeItem = (label: string, selectedId: string) => (
    <GtkBox spacing={10}>
        <GtkLabel label={label} xalign={0} hexpand />
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
                <GtkLabel
                    label={`<big><b>${escapeMarkup(value)}</b></big>`}
                    useMarkup
                    xalign={0}
                    marginTop={10}
                    marginBottom={10}
                />
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

type Device = (typeof devices)[number];

const renderDeviceRow = (label: string, renderDetails: (device: Device) => ReactNode) => {
    const device = devices.find((d) => d.id === label);
    if (!device) {
        return <GtkLabel label={label} />;
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
                renderDeviceRow(label, (device) => <GtkLabel label={device.title} xalign={0} hexpand />)
            }
            renderListItem={({ item: label }: { item: string }) =>
                renderDeviceRow(label, (device) => (
                    <>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2}>
                            <GtkLabel label={device.title} xalign={0} />
                            <GtkLabel label={device.description} xalign={0} cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1 : 0} />
                    </>
                ))
            }
            items={devices.map((d) => ({ id: d.id, value: d.id }))}
        />
    );
};

interface DirEntry {
    path: string;
    name: string;
    icon: string;
}

function loadDirectoryEntries(): DirEntry[] {
    const cwd = process.cwd();
    try {
        const entries = readdirSync(cwd);
        const results: DirEntry[] = [];
        for (const name of entries) {
            let isDir = false;
            try {
                isDir = statSync(`${cwd}/${name}`).isDirectory();
            } catch (e) {
                if (e instanceof Error) console.error(e.message);
            }
            results.push({
                path: name,
                name,
                icon: isDir ? "folder-symbolic" : "text-x-generic-symbolic",
            });
        }
        return results.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
        return [];
    }
}

let directoryEntries: DirEntry[] | undefined;
function getDirectoryEntries() {
    if (!directoryEntries) {
        directoryEntries = loadDirectoryEntries();
    }
    return directoryEntries;
}

const DirectorySuggestionEntry = () => {
    const [text, setText] = useState("");
    const entries = getDirectoryEntries();

    return (
        <GtkBox cssClasses={["linked"]}>
            <GtkEntry text={text} hexpand onChanged={(entry) => setText(entry.getText())} />
            <GtkMenuButton
                iconName="pan-down-symbolic"
                tooltipText="Show suggestions"
                popover={
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
                                        onClicked={() => setText(entry.name)}
                                    >
                                        <GtkBox spacing={8}>
                                            <GtkImage iconName={entry.icon} />
                                            <GtkLabel label={entry.name} halign={Gtk.Align.START} hexpand />
                                        </GtkBox>
                                    </GtkButton>
                                ))}
                            </GtkBox>
                        </GtkScrolledWindow>
                    </GtkPopover>
                }
            />
        </GtkBox>
    );
};

const ListViewSelectionsDemo = () => {
    const [fontIndex, setFontIndex] = useState(0);
    const [enableFontSearch, setEnableFontSearch] = useState(false);

    const handleFontSpinChanged = (val: number) => {
        const idx = Math.round(val);
        if (idx >= 0 && idx < getFontFamilies().length) {
            setFontIndex(idx);
        }
    };

    return (
        <GtkBox spacing={20} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
                <GtkLabel label="Dropdowns" cssClasses={["title-4"]} />

                <TimesDropDown />

                <TimesSectionedDropDown />

                <DropDown
                    name="fonts-dropdown"
                    selectedId={getFontFamilies()[fontIndex] ?? ""}
                    enableSearch={enableFontSearch}
                    onSelectionChanged={(id) => {
                        const idx = getFontFamilies().indexOf(id);
                        if (idx >= 0) setFontIndex(idx);
                    }}
                    items={getFontFamilies().map((f) => ({ id: f, value: f }))}
                />

                <GtkSpinButton
                    name="font-spin"
                    halign={Gtk.Align.START}
                    marginStart={20}
                    adjustment={
                        <GtkAdjustment
                            value={fontIndex}
                            lower={-1}
                            upper={getFontFamilies().length}
                            stepIncrement={1}
                        />
                    }
                    onValueChanged={(spin) => handleFontSpinChanged(spin.getValue())}
                />

                <GtkCheckButton
                    name="enable-search-check"
                    label="Enable search"
                    marginStart={20}
                    active={enableFontSearch}
                    onToggled={(btn) => setEnableFontSearch(btn.getActive())}
                />

                <DevicesDropDown />
            </GtkBox>

            <GtkSeparator name="column-separator" orientation={Gtk.Orientation.VERTICAL} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
                <GtkLabel label="Suggestions" cssClasses={["title-4"]} />

                <SuggestionEntry name="words-entry" words={suggestionWords} placeholder="Words with T or G…" />

                <DirectorySuggestionEntry />

                <SuggestionEntry words={destinationWords} placeholder="Destination" />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewSelectionsDemo: Demo = {
    id: "listview-selections",
    title: "Lists/Selections",
    description:
        "The GtkDropDown widget is a modern alternative to GtkComboBox. It uses list models instead of tree models, and the content is displayed using widgets instead of cell renderers.\n\nThis example also shows a custom widget that can replace GtkEntryCompletion or GtkComboBoxText. It is not currently part of GTK.",
    keywords: ["suggestion", "completion"],
    component: ListViewSelectionsDemo,
    sourceCode,
    windowTitle: "Selections",
    resizable: false,
};
