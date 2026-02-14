import { readdirSync, statSync } from "node:fs";
import { createRef } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkDropDown,
    GtkImage,
    GtkLabel,
    GtkMenuButton,
    GtkPopover,
    GtkScrolledWindow,
    GtkSearchEntry,
    GtkSeparator,
    GtkSpinButton,
    x,
} from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
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
    const familiesRef = createRef<Pango.FontFamily[]>([]);
    const countRef = createRef(0);
    fontMap.listFamilies(familiesRef, countRef);
    return familiesRef.value.map((f) => f.getName()).sort((a, b) => a.localeCompare(b));
}

let fontFamilies: string[] | undefined;
function getFontFamilies() {
    if (!fontFamilies) {
        fontFamilies = loadFontFamilies();
    }
    return fontFamilies;
}

function escapeMarkup(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

const SuggestionEntry = ({ words, placeholder }: { words: string[]; placeholder: string }) => {
    const [text, setText] = useState("");

    const suggestions = useMemo(() => {
        if (text.length < 1) return [];
        const lower = text.toLowerCase();
        return words.filter((w) => w.toLowerCase().includes(lower)).slice(0, 10);
    }, [text, words]);

    const hasSuggestions = suggestions.length > 0;

    return (
        <GtkBox spacing={8}>
            <GtkSearchEntry
                text={text}
                hexpand
                placeholderText={placeholder}
                onSearchChanged={(entry) => setText(entry.getText())}
            />
            <GtkMenuButton iconName="view-more-symbolic" sensitive={hasSuggestions} active={hasSuggestions}>
                <x.Slot for={GtkMenuButton} id="popover">
                    <GtkPopover hasArrow={false} position={Gtk.PositionType.BOTTOM}>
                        <GtkScrolledWindow
                            heightRequest={200}
                            widthRequest={300}
                            hscrollbarPolicy={Gtk.PolicyType.NEVER}
                        >
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                                {suggestions.map((word) => (
                                    <GtkButton key={word} cssClasses={["flat"]} onClicked={() => setText(word)}>
                                        <GtkLabel
                                            label={highlightMatch(word, text)}
                                            useMarkup
                                            halign={Gtk.Align.START}
                                            hexpand
                                        />
                                    </GtkButton>
                                ))}
                            </GtkBox>
                        </GtkScrolledWindow>
                    </GtkPopover>
                </x.Slot>
            </GtkMenuButton>
        </GtkBox>
    );
};

const TimesDropDown = () => {
    const [selectedId, setSelectedId] = useState(times[0] ?? "");

    return (
        <GtkDropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            renderItem={(label: string | null) => (
                <GtkBox spacing={10}>
                    <GtkLabel label={label ?? ""} xalign={0} hexpand />
                    <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1.0 : 0.0} />
                </GtkBox>
            )}
        >
            {times.map((t) => (
                <x.ListItem key={t} id={t} value={t} />
            ))}
        </GtkDropDown>
    );
};

const TimesSectionedDropDown = () => {
    const [selectedId, setSelectedId] = useState(minutes[0] ?? "");

    return (
        <GtkDropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            enableSearch
            renderItem={(label: string | null) => (
                <GtkBox spacing={10}>
                    <GtkLabel label={label ?? ""} xalign={0} hexpand />
                    <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1.0 : 0.0} />
                </GtkBox>
            )}
            renderHeader={(value: string | null) => (
                <GtkLabel
                    label={`<big><b>${escapeMarkup(value ?? "")}</b></big>`}
                    useMarkup
                    xalign={0}
                    marginTop={10}
                    marginBottom={10}
                />
            )}
        >
            <x.ListSection id="minutes" value="Minutes">
                {minutes.map((m) => (
                    <x.ListItem key={m} id={m} value={m} />
                ))}
            </x.ListSection>
            <x.ListSection id="hours" value="Hours">
                {hours.map((h) => (
                    <x.ListItem key={h} id={h} value={h} />
                ))}
            </x.ListSection>
        </GtkDropDown>
    );
};

const DevicesDropDown = () => {
    const [selectedId, setSelectedId] = useState(devices[0]?.id ?? "");

    return (
        <GtkDropDown
            selectedId={selectedId}
            onSelectionChanged={setSelectedId}
            renderItem={(label: string | null) => {
                const device = devices.find((d) => d.id === label);
                if (!device) {
                    return <GtkLabel label={label ?? ""} />;
                }
                return (
                    <GtkBox spacing={10}>
                        <GtkImage iconName={device.icon} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2}>
                            <GtkLabel label={device.title} xalign={0} />
                            <GtkLabel label={device.description} xalign={0} cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkImage iconName="object-select-symbolic" opacity={label === selectedId ? 1.0 : 0.0} />
                    </GtkBox>
                );
            }}
        >
            {devices.map((d) => (
                <x.ListItem key={d.id} id={d.id} value={d.id} />
            ))}
        </GtkDropDown>
    );
};

interface DirEntry {
    path: string;
    name: string;
    icon: string;
}

const DirectorySuggestionEntry = () => {
    const [text, setText] = useState("");

    const suggestions = useMemo((): DirEntry[] => {
        if (!text || !text.startsWith("/")) return [];

        const lastSlash = text.lastIndexOf("/");
        const dir = text.slice(0, lastSlash + 1);
        const prefix = text.slice(lastSlash + 1).toLowerCase();

        try {
            const entries = readdirSync(dir);
            const results: DirEntry[] = [];
            for (const name of entries) {
                if (prefix && !name.toLowerCase().startsWith(prefix)) continue;
                let isDir = false;
                try {
                    isDir = statSync(dir + name).isDirectory();
                } catch {}
                results.push({
                    path: dir + name + (isDir ? "/" : ""),
                    name,
                    icon: isDir ? "folder-symbolic" : "text-x-generic-symbolic",
                });
                if (results.length >= 10) break;
            }
            return results.sort((a, b) => a.name.localeCompare(b.name));
        } catch {
            return [];
        }
    }, [text]);

    const hasSuggestions = suggestions.length > 0;

    return (
        <GtkBox spacing={8}>
            <GtkSearchEntry
                text={text}
                hexpand
                placeholderText="Directory path\u2026"
                onSearchChanged={(entry) => setText(entry.getText())}
            />
            <GtkMenuButton iconName="view-more-symbolic" sensitive={hasSuggestions} active={hasSuggestions}>
                <x.Slot for={GtkMenuButton} id="popover">
                    <GtkPopover hasArrow={false} position={Gtk.PositionType.BOTTOM}>
                        <GtkScrolledWindow
                            heightRequest={200}
                            widthRequest={300}
                            hscrollbarPolicy={Gtk.PolicyType.NEVER}
                        >
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                                {suggestions.map((entry) => (
                                    <GtkButton
                                        key={entry.path}
                                        cssClasses={["flat"]}
                                        onClicked={() => setText(entry.path)}
                                    >
                                        <GtkBox spacing={8}>
                                            <GtkImage iconName={entry.icon} />
                                            <GtkLabel
                                                label={highlightMatch(
                                                    entry.name,
                                                    text.slice(text.lastIndexOf("/") + 1),
                                                )}
                                                useMarkup
                                                halign={Gtk.Align.START}
                                                hexpand
                                            />
                                        </GtkBox>
                                    </GtkButton>
                                ))}
                            </GtkBox>
                        </GtkScrolledWindow>
                    </GtkPopover>
                </x.Slot>
            </GtkMenuButton>
        </GtkBox>
    );
};

const ListViewSelectionsDemo = () => {
    const [fontIndex, setFontIndex] = useState(0);
    const [enableFontSearch, setEnableFontSearch] = useState(false);

    const handleFontSpinChanged = useCallback((val: number) => {
        const idx = Math.round(val);
        if (idx >= 0 && idx < getFontFamilies().length) {
            setFontIndex(idx);
        }
    }, []);

    return (
        <GtkBox spacing={20} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
                <GtkLabel label="Dropdowns" cssClasses={["title-4"]} />

                <TimesDropDown />

                <TimesSectionedDropDown />

                <GtkDropDown
                    selectedId={getFontFamilies()[fontIndex] ?? ""}
                    enableSearch={enableFontSearch}
                    onSelectionChanged={(id) => {
                        const idx = getFontFamilies().indexOf(id);
                        if (idx >= 0) setFontIndex(idx);
                    }}
                >
                    {getFontFamilies().map((f) => (
                        <x.ListItem key={f} id={f} value={f} />
                    ))}
                </GtkDropDown>

                <GtkSpinButton
                    halign={Gtk.Align.START}
                    marginStart={20}
                    value={fontIndex}
                    lower={-1}
                    upper={getFontFamilies().length}
                    stepIncrement={1}
                    onValueChanged={handleFontSpinChanged}
                />

                <GtkCheckButton
                    label="Enable search"
                    marginStart={20}
                    active={enableFontSearch}
                    onToggled={(btn) => setEnableFontSearch(btn.getActive())}
                />

                <DevicesDropDown />
            </GtkBox>

            <GtkSeparator orientation={Gtk.Orientation.VERTICAL} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={10}>
                <GtkLabel label="Suggestions" cssClasses={["title-4"]} />

                <SuggestionEntry words={suggestionWords} placeholder="Words with T or G\u2026" />

                <SuggestionEntry words={destinationWords} placeholder="Destination" />

                <DirectorySuggestionEntry />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewSelectionsDemo: Demo = {
    id: "listview-selections",
    title: "Lists/Selections",
    description:
        "GtkDropDown is a modern alternative to GtkComboBox. It uses list models and widgets for content display. This demo also shows suggestion entries for autocompletion.",
    keywords: ["dropdown", "selection", "GtkDropDown", "suggestion", "completion", "font", "PangoFontMap", "combo"],
    component: ListViewSelectionsDemo,
    sourceCode,
};
