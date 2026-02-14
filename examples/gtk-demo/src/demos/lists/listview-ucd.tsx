import { readFileSync } from "node:fs";
import { css } from "@gtkx/css";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkColumnView, GtkInscription, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-ucd.tsx?raw";
import ucdDataPath from "./ucdnames.data";

interface UcdEntry {
    codepoint: number;
    name: string;
    char: string;
    codepointStr: string;
}

const UNICODE_TYPE_NAMES = [
    "Other, Control",
    "Other, Format",
    "Other, Not Assigned",
    "Other, Private Use",
    "Other, Surrogate",
    "Letter, Lowercase",
    "Letter, Modifier",
    "Letter, Other",
    "Letter, Titlecase",
    "Letter, Uppercase",
    "Mark, Spacing",
    "Mark, Enclosing",
    "Mark, Nonspacing",
    "Number, Decimal Digit",
    "Number, Letter",
    "Number, Other",
    "Punctuation, Connector",
    "Punctuation, Dash",
    "Punctuation, Close",
    "Punctuation, Final quote",
    "Punctuation, Initial quote",
    "Punctuation, Other",
    "Punctuation, Open",
    "Symbol, Currency",
    "Symbol, Modifier",
    "Symbol, Math",
    "Symbol, Other",
    "Separator, Line",
    "Separator, Paragraph",
    "Separator, Space",
];

const BREAK_TYPE_NAMES = [
    "Mandatory Break",
    "Carriage Return",
    "Line Feed",
    "Attached Characters and Combining Marks",
    "Surrogates",
    "Zero Width Space",
    "Inseparable",
    'Non-breaking ("Glue")',
    "Contingent Break Opportunity",
    "Space",
    "Break Opportunity After",
    "Break Opportunity Before",
    "Break Opportunity Before and After",
    "Hyphen",
    "Nonstarter",
    "Opening Punctuation",
    "Closing Punctuation",
    "Ambiguous Quotation",
    "Exclamation/Interrogation",
    "Ideographic",
    "Numeric",
    "Infix Separator (Numeric)",
    "Symbols Allowing Break After",
    "Ordinary Alphabetic and Symbol Characters",
    "Prefix (Numeric)",
    "Postfix (Numeric)",
    "Complex Content Dependent (South East Asian)",
    "Ambiguous (Alphabetic or Ideographic)",
    "Unknown",
    "Next Line",
    "Word Joiner",
    "Hangul L Jamo",
    "Hangul V Jamo",
    "Hangul T Jamo",
    "Hangul LV Syllable",
    "Hangul LVT Syllable",
    "Closing Parenthesis",
    "Conditional Japanese Starter",
    "Hebrew Letter",
    "Regional Indicator",
    "Emoji Base",
    "Emoji Modifier",
    "Zero Width Joiner",
];

const COMBINING_CLASS_NAMES: Record<number, string> = {
    0: "Not Reordered",
    1: "Overlay",
    7: "Nukta",
    8: "Kana Voicing",
    9: "Virama",
    10: "CCC10 (Hebrew)",
    11: "CCC11 (Hebrew)",
    12: "CCC12 (Hebrew)",
    13: "CCC13 (Hebrew)",
    14: "CCC14 (Hebrew)",
    15: "CCC15 (Hebrew)",
    16: "CCC16 (Hebrew)",
    17: "CCC17 (Hebrew)",
    18: "CCC18 (Hebrew)",
    19: "CCC19 (Hebrew)",
    20: "CCC20 (Hebrew)",
    21: "CCC21 (Hebrew)",
    22: "CCC22 (Hebrew)",
    23: "CCC23 (Hebrew)",
    24: "CCC24 (Hebrew)",
    25: "CCC25 (Hebrew)",
    26: "CCC26 (Hebrew)",
    27: "CCC27 (Arabic)",
    28: "CCC28 (Arabic)",
    29: "CCC29 (Arabic)",
    30: "CCC30 (Arabic)",
    31: "CCC31 (Arabic)",
    32: "CCC32 (Arabic)",
    33: "CCC33 (Arabic)",
    34: "CCC34 (Arabic)",
    35: "CCC35 (Arabic)",
    36: "CCC36 (Syriac)",
    84: "CCC84 (Telugu)",
    85: "CCC85 (Telugu)",
    103: "CCC103 (Thai)",
    107: "CCC107 (Thai)",
    118: "CCC118 (Lao)",
    122: "CCC122 (Lao)",
    129: "CCC129 (Tibetan)",
    130: "CCC130 (Tibetan)",
    133: "CCC133 (Tibetan)",
    200: "Attached Below Left",
    202: "Attached Below",
    214: "Attached Above",
    216: "Attached Above Right",
    218: "Below Left",
    220: "Below",
    222: "Below Right",
    224: "Left",
    226: "Right",
    228: "Above Left",
    230: "Above",
    232: "Above Right",
    233: "Double Below",
    234: "Double Above",
    240: "Iota Subscript",
    255: "Invalid",
};

let scriptNameCache: Map<number, string> | null = null;

function getScriptName(value: number): string {
    if (!scriptNameCache) {
        scriptNameCache = new Map<number, string>();
        for (const [key, val] of Object.entries(GLib.UnicodeScript)) {
            if (typeof val === "number") {
                scriptNameCache.set(
                    val,
                    key
                        .split("_")
                        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                        .join(" "),
                );
            }
        }
    }
    return scriptNameCache.get(value) ?? String(value);
}

function parseUcdData(): UcdEntry[] {
    const buffer = readFileSync(ucdDataPath);
    const entries: UcdEntry[] = [];
    let offset = 0;
    let lastCp = -1;

    while (offset + 4 <= buffer.length) {
        const cp = buffer.readUInt32LE(offset);
        if (cp > 0x10ffff || cp < lastCp) {
            break;
        }

        offset += 4;

        let end = offset;
        while (end < buffer.length && buffer[end] !== 0) {
            end++;
        }
        if (end >= buffer.length) {
            break;
        }

        const name = buffer.subarray(offset, end).toString("utf-8");
        offset = end + 1;
        const padding = (4 - (offset % 4)) % 4;
        offset += padding;

        lastCp = cp;

        if (cp === 0) {
            continue;
        }

        const char = String.fromCodePoint(cp);
        const hex = cp.toString(16).padStart(4, "0");

        entries.push({
            codepoint: cp,
            name,
            char,
            codepointStr: `0x${hex}`,
        });
    }

    return entries;
}

const characters = parseUcdData();

interface UcdSection {
    script: string;
    entries: UcdEntry[];
}

function groupByScript(entries: UcdEntry[]): UcdSection[] {
    const sorted = [...entries].sort((a, b) => {
        const sa = GLib.unicharGetScript(a.codepoint);
        const sb = GLib.unicharGetScript(b.codepoint);
        if (sa !== sb) return sa - sb;
        return a.codepoint - b.codepoint;
    });

    const sections: UcdSection[] = [];
    let currentScript = "";
    let currentEntries: UcdEntry[] = [];

    for (const entry of sorted) {
        const script = getScriptName(GLib.unicharGetScript(entry.codepoint));
        if (script !== currentScript) {
            if (currentEntries.length > 0) {
                sections.push({ script: currentScript, entries: currentEntries });
            }
            currentScript = script;
            currentEntries = [entry];
        } else {
            currentEntries.push(entry);
        }
    }
    if (currentEntries.length > 0) {
        sections.push({ script: currentScript, entries: currentEntries });
    }

    return sections;
}

let cachedData: { sections: UcdSection[]; flat: UcdEntry[] } | undefined;

function getCharacterData() {
    if (!cachedData) {
        const sections = groupByScript(characters);
        cachedData = { sections, flat: sections.flatMap((s) => s.entries) };
    }
    return cachedData;
}

const ListViewUcdDemo = () => {
    const [selectedChar, setSelectedChar] = useState("");
    const { sections: characterSections, flat: flatSorted } = getCharacterData();

    const handleActivate = (position: number) => {
        const entry = flatSorted[position];
        if (entry) {
            setSelectedChar(entry.char);
        }
    };

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
            <GtkScrolledWindow propagateNaturalWidth vexpand>
                <GtkColumnView
                    showColumnSeparators
                    estimatedRowHeight={32}
                    onActivate={handleActivate}
                    renderHeader={(script: string | null) => (
                        <GtkLabel
                            label={script ?? ""}
                            halign={Gtk.Align.START}
                            cssClasses={["heading"]}
                            marginTop={20}
                            marginBottom={10}
                            marginStart={10}
                            marginEnd={20}
                        />
                    )}
                >
                    <x.ColumnViewColumn
                        id="codepoint"
                        title="Codepoint"
                        sortable
                        renderCell={(item: UcdEntry | null) => (
                            <GtkInscription
                                text={item?.codepointStr ?? ""}
                                cssClasses={["monospace"]}
                                marginTop={4}
                                marginBottom={4}
                            />
                        )}
                    />
                    <x.ColumnViewColumn
                        id="char"
                        title="Char"
                        renderCell={(item: UcdEntry | null) => (
                            <GtkInscription
                                text={item && GLib.unicharIsprint(item.codepoint) ? item.char : ""}
                                marginTop={4}
                                marginBottom={4}
                            />
                        )}
                    />
                    <x.ColumnViewColumn
                        id="name"
                        title="Name"
                        resizable
                        renderCell={(item: UcdEntry | null) => (
                            <GtkInscription
                                text={item?.name ?? ""}
                                xalign={0}
                                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                                natChars={20}
                                marginTop={4}
                                marginBottom={4}
                            />
                        )}
                    />
                    <x.ColumnViewColumn
                        id="type"
                        title="Type"
                        resizable
                        renderCell={(item: UcdEntry | null) => (
                            <GtkInscription
                                text={item ? (UNICODE_TYPE_NAMES[GLib.unicharType(item.codepoint)] ?? "Unknown") : ""}
                                cssClasses={["dim-label"]}
                                xalign={0}
                                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                                marginTop={4}
                                marginBottom={4}
                            />
                        )}
                    />
                    <x.ColumnViewColumn
                        id="break-type"
                        title="Break Type"
                        resizable
                        renderCell={(item: UcdEntry | null) => (
                            <GtkInscription
                                text={
                                    item ? (BREAK_TYPE_NAMES[GLib.unicharBreakType(item.codepoint)] ?? "Unknown") : ""
                                }
                                cssClasses={["dim-label"]}
                                xalign={0}
                                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                                marginTop={4}
                                marginBottom={4}
                            />
                        )}
                    />
                    <x.ColumnViewColumn
                        id="combining-class"
                        title="Combining Class"
                        resizable
                        renderCell={(item: UcdEntry | null) => (
                            <GtkInscription
                                text={
                                    item
                                        ? (COMBINING_CLASS_NAMES[GLib.unicharCombiningClass(item.codepoint)] ??
                                          "Unknown")
                                        : ""
                                }
                                cssClasses={["dim-label"]}
                                xalign={0}
                                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                                marginTop={4}
                                marginBottom={4}
                            />
                        )}
                    />
                    {characterSections.map((section) => (
                        <x.ListSection key={section.script} id={section.script} value={section.script}>
                            {section.entries.map((entry) => (
                                <x.ListItem key={entry.codepointStr} id={entry.codepointStr} value={entry} />
                            ))}
                        </x.ListSection>
                    ))}
                </GtkColumnView>
            </GtkScrolledWindow>
            <GtkLabel label={selectedChar} cssClasses={[css`font-size: 80px;`]} hexpand widthChars={2} />
        </GtkBox>
    );
};

export const listviewUcdDemo: Demo = {
    id: "listview-ucd",
    title: "Lists/Characters",
    description: "Unicode character database browser with grid and list views",
    keywords: ["listview", "unicode", "characters", "GtkListView", "GtkGridView", "ucd", "codepoint"],
    component: ListViewUcdDemo,
    sourceCode,
    defaultWidth: 800,
    defaultHeight: 400,
};
