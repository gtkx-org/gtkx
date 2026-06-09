import { readdirSync, statSync } from "node:fs";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import * as PangoCairo from "@gtkx/gi/pangocairo";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDropDown,
    GtkEntry,
    GtkEventControllerKey,
    GtkImage,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkScrolledWindow,
    GtkSeparator,
    GtkSpinButton,
    useAdjustment,
} from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
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

interface SuggestionRefs {
    entryRef: React.RefObject<Gtk.Entry | null>;
    popoverRef: React.RefObject<Gtk.Popover | null>;
    listBoxRef: React.RefObject<Gtk.ListBox | null>;
    suggestionsRef: React.RefObject<string[]>;
    selectedRef: React.RefObject<number>;
}

const useSuggestionRefs = (): SuggestionRefs => ({
    entryRef: useRef<Gtk.Entry | null>(null),
    popoverRef: useRef<Gtk.Popover | null>(null),
    listBoxRef: useRef<Gtk.ListBox | null>(null),
    suggestionsRef: useRef<string[]>([]),
    selectedRef: useRef<number>(-1),
});

const clearListBox = (listBox: Gtk.ListBox): void => {
    let child = listBox.getFirstChild();
    while (child) {
        const next = child.getNextSibling();
        listBox.remove(child);
        child = next;
    }
};

const appendSuggestionRow = (listBox: Gtk.ListBox, word: string, query: string): void => {
    const row = Gtk.ListBoxRow.new();
    const label = Gtk.Label.new(null);
    label.setMarkup(highlightMatch(word, query));
    label.setXalign(0);
    label.setHexpand(true);
    row.setChild(label);
    listBox.append(row);
};

const useRebuildSuggestionList = (refs: SuggestionRefs, words: string[]) => (text: string) => {
    const popover = refs.popoverRef.current;
    const listBox = refs.listBoxRef.current;
    if (!popover || !listBox) return;
    clearListBox(listBox);
    if (text.length < 1) {
        refs.suggestionsRef.current = [];
        refs.selectedRef.current = -1;
        popover.popdown();
        return;
    }
    const lower = text.toLowerCase();
    const matches = words.filter((w) => w.toLowerCase().includes(lower)).slice(0, 10);
    refs.suggestionsRef.current = matches;
    refs.selectedRef.current = -1;
    if (matches.length === 0) {
        popover.popdown();
        return;
    }
    for (const word of matches) appendSuggestionRow(listBox, word, text);
    popover.popup();
};

const useAcceptSuggestion = (refs: SuggestionRefs) => () => {
    const popover = refs.popoverRef.current;
    const entry = refs.entryRef.current;
    const matches = refs.suggestionsRef.current;
    const idx = refs.selectedRef.current;
    if (!popover || !entry || idx < 0 || idx >= matches.length) return false;
    const word = matches[idx];
    if (word === undefined) return false;
    entry.setText(word);
    entry.setPosition(-1);
    popover.popdown();
    return true;
};

const useMoveSuggestion = (refs: SuggestionRefs) => (delta: number) => {
    const listBox = refs.listBoxRef.current;
    const matches = refs.suggestionsRef.current;
    if (!listBox || matches.length === 0) return;
    const next = (refs.selectedRef.current + delta + matches.length) % matches.length;
    refs.selectedRef.current = next;
    const row = listBox.getRowAtIndex(next);
    if (row) listBox.selectRow(row);
};

const buildSuggestionPopover = (entry: Gtk.Entry): { popover: Gtk.Popover; listBox: Gtk.ListBox } => {
    const popover = Gtk.Popover.new();
    popover.setHasArrow(false);
    popover.setPosition(Gtk.PositionType.BOTTOM);
    popover.setAutohide(false);
    const scrolled = Gtk.ScrolledWindow.new();
    scrolled.setMaxContentHeight(400);
    scrolled.setPropagateNaturalHeight(true);
    scrolled.setPolicy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    const listBox = Gtk.ListBox.new();
    listBox.setSelectionMode(Gtk.SelectionMode.BROWSE);
    scrolled.setChild(listBox);
    popover.setChild(scrolled);
    popover.setParent(entry);
    return { popover, listBox };
};

const useSuggestionPopover = (refs: SuggestionRefs, accept: () => boolean) => {
    useEffect(() => {
        const entry = refs.entryRef.current;
        if (!entry) return;
        const { popover, listBox } = buildSuggestionPopover(entry);
        refs.popoverRef.current = popover;
        refs.listBoxRef.current = listBox;
        const onRowActivated = (_lb: Gtk.ListBox, row: Gtk.ListBoxRow) => {
            refs.selectedRef.current = row.getIndex();
            accept();
        };
        listBox.on("row-activated", onRowActivated);
        return () => {
            listBox.off("row-activated", onRowActivated);
            popover.unparent();
            refs.popoverRef.current = null;
            refs.listBoxRef.current = null;
        };
    }, [refs, accept]);
};

const handleSuggestionKey = (
    keyval: number,
    refs: SuggestionRefs,
    move: (delta: number) => void,
    accept: () => boolean,
): boolean => {
    if (refs.suggestionsRef.current.length === 0) return false;
    if (keyval === Gdk.KEY_Down) {
        move(1);
        return true;
    }
    if (keyval === Gdk.KEY_Up) {
        move(-1);
        return true;
    }
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) return accept();
    if (keyval === Gdk.KEY_Escape) {
        refs.popoverRef.current?.popdown();
        return true;
    }
    return false;
};

const SuggestionEntry = ({ words, placeholder, name }: { words: string[]; placeholder: string; name?: string }) => {
    const refs = useSuggestionRefs();
    const accept = useAcceptSuggestion(refs);
    const move = useMoveSuggestion(refs);
    const rebuild = useRebuildSuggestionList(refs, words);
    useSuggestionPopover(refs, accept);
    const handleChanged = (entry: Gtk.Entry) => rebuild(entry.getText());
    const handleKeyPressed = (keyval: number) => handleSuggestionKey(keyval, refs, move, accept);
    return (
        <GtkEntry ref={refs.entryRef} name={name} hexpand placeholderText={placeholder} onChanged={handleChanged}>
            <GtkEventControllerKey onKeyPressed={handleKeyPressed} />
        </GtkEntry>
    );
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
        <GtkDropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            renderListItem={(label: string) => renderSelectableTimeItem(label, selectedId)}
            items={times.map((t) => ({ id: t, value: t }))}
        />
    );
};

const TimesSectionedDropDown = () => {
    const [selectedId, setSelectedId] = useState(minutes[0] ?? "");

    return (
        <GtkDropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            enableSearch
            renderListItem={(label: string) => renderSelectableTimeItem(label, selectedId)}
            renderHeader={(value: string) => (
                <GtkLabel
                    label={`<big><b>${escapeMarkup(value)}</b></big>`}
                    useMarkup
                    xalign={0}
                    marginTop={10}
                    marginBottom={10}
                />
            )}
            items={[
                {
                    id: "minutes",
                    value: "Minutes",
                    section: true,
                    children: minutes.map((m) => ({ id: m, value: m })),
                },
                {
                    id: "hours",
                    value: "Hours",
                    section: true,
                    children: hours.map((h) => ({ id: h, value: h })),
                },
            ]}
        />
    );
};

const DevicesDropDown = () => {
    const [selectedId, setSelectedId] = useState(devices[0]?.id ?? "");

    return (
        <GtkDropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            renderItem={(label: string) => {
                const device = devices.find((d) => d.id === label);
                if (!device) {
                    return <GtkLabel label={label} />;
                }
                return (
                    <GtkBox spacing={10}>
                        <GtkImage iconName={device.icon} />
                        <GtkLabel label={device.title} xalign={0} hexpand />
                    </GtkBox>
                );
            }}
            renderListItem={(label: string) => {
                const device = devices.find((d) => d.id === label);
                if (!device) {
                    return <GtkLabel label={label} />;
                }
                return (
                    <GtkBox spacing={10}>
                        <GtkImage iconName={device.icon} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2}>
                            <GtkLabel label={device.title} xalign={0} />
                            <GtkLabel label={device.description} xalign={0} cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1 : 0} />
                    </GtkBox>
                );
            }}
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
    const fontAdjustment = useAdjustment({
        value: fontIndex,
        lower: -1,
        upper: getFontFamilies().length,
        stepIncrement: 1,
    });

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

                <GtkDropDown
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
                    adjustment={fontAdjustment}
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
