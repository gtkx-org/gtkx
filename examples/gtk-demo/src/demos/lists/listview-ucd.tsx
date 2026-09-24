import { ColumnView, type ColumnViewColumn } from "@gtkx/components";
import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkInscription, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import ucdDataPath from "../../../data/demos/lists/ucdnames.data?resource";
import sourceCode from "./listview-ucd.tsx?raw";

type UcdEntry = {
    codepoint: number;
    name: string;
    char: string;
    codepointStr: string;
};

type UcdSection = {
    script: string;
    entries: UcdEntry[];
};

type UcdCursor = {
    buffer: Buffer;
    offset: number;
};

type ScriptGrouping = {
    sections: UcdSection[];
    script: string;
    entries: UcdEntry[];
};

type CharacterData = {
    sections: UcdSection[];
    flat: UcdEntry[];
};

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

const scriptDisplayNames = new Intl.DisplayNames("en", { type: "script" });

const characters = parseUcdData();

const ucdCodepointColumn: ColumnViewColumn<UcdEntry> = {
    id: "codepoint",
    title: "Codepoint",
    isSortable: true,
    renderCell: ({ item }) => (
        <GtkInscription text={item.codepointStr} cssClasses={["monospace"]} marginTop={4} marginBottom={4} />
    ),
};

const ucdCharColumn: ColumnViewColumn<UcdEntry> = {
    id: "char",
    title: "Char",
    renderCell: ({ item }) => (
        <GtkInscription text={GLib.unicharIsprint(item.char) ? item.char : ""} marginTop={4} marginBottom={4} />
    ),
};

const ucdNameColumn: ColumnViewColumn<UcdEntry> = {
    id: "name",
    title: "Name",
    resizable: true,
    renderCell: ({ item }) => (
        <GtkInscription
            text={item.name}
            xalign={0}
            textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
            natChars={20}
            marginTop={4}
            marginBottom={4}
        />
    ),
};

const ucdTypeColumn = inscriptionColumn(
    "type",
    "Type",
    (item) => UNICODE_TYPE_NAMES[GLib.unicharType(item.char)] ?? "Unknown",
);

const ucdBreakTypeColumn = inscriptionColumn(
    "break-type",
    "Break Type",
    (item) => BREAK_TYPE_NAMES[GLib.unicharBreakType(item.char)] ?? "Unknown",
);

const ucdCombiningClassColumn = inscriptionColumn(
    "combining-class",
    "Combining Class",
    (item) => COMBINING_CLASS_NAMES[GLib.unicharCombiningClass(item.char)] ?? "Unknown",
);

const getCharacterData = (() => {
    let cache: CharacterData | undefined;

    return (): CharacterData => {
        cache ??= buildCharacterData();

        return cache;
    };
})();

const listviewUcdDemo: Demo = {
    id: "listview-ucd",
    title: "Lists/Characters",
    description:
        "This demo shows a multi-column representation of some parts of the Unicode Character Database, " +
        "or UCD. It also demonstrates the use of sections with headings to group items.\n\nThe dataset used " +
        "here has 33 796 items.",
    keywords: [],
    component: ListViewUcdDemo,
    sourceCode,
    defaultWidth: 800,
    defaultHeight: 400,
};

function getScriptName(value: GLib.UnicodeScript): string {
    if (value === GLib.UnicodeScript.COMMON || value === GLib.UnicodeScript.INHERITED) {
        return "No script";
    }

    if (value === GLib.UnicodeScript.UNKNOWN) {
        return "Unknown";
    }

    const tag = GLib.unicodeScriptToIso15924(value);
    const code = String.fromCodePoint(tag >>> 24, (tag >>> 16) & 0xFF, (tag >>> 8) & 0xFF, tag & 0xFF);

    return scriptDisplayNames.of(code) ?? "Unknown";
}

function readUcdBuffer(): Buffer {
    const bytes = Gio.resourcesLookupData(ucdDataPath, Gio.ResourceLookupFlags.NONE);
    const data = bytes.getData();

    if (!data) {
        throw new Error(`UCD data resource is empty: ${ucdDataPath}`);
    }

    return Buffer.from(data);
}

function nextCodepoint(cursor: UcdCursor, lastCp: number): number | null {
    if (cursor.offset + 4 > cursor.buffer.length) {
        return null;
    }

    const cp = cursor.buffer.readUInt32LE(cursor.offset);

    if (cp > 0x10_FF_FF || cp < lastCp) {
        return null;
    }

    cursor.offset += 4;

    return cp;
}

function readName(cursor: UcdCursor): string | null {
    let end = cursor.offset;

    while (end < cursor.buffer.length && cursor.buffer[end] !== 0) {
        end++;
    }

    if (end >= cursor.buffer.length) {
        return null;
    }

    const name = cursor.buffer.subarray(cursor.offset, end).toString("utf8");
    const afterName = end + 1;
    cursor.offset = afterName + ((4 - (afterName % 4)) % 4);

    return name;
}

function appendUcdEntry(entries: UcdEntry[], cp: number, name: string) {
    if (cp === 0) {
        return;
    }

    const hex = cp.toString(16).padStart(4, "0");

    entries.push({
        codepoint: cp,
        name,
        char: String.fromCodePoint(cp),
        codepointStr: `0x${hex}`,
    });
}

function parseUcdData(): UcdEntry[] {
    const cursor: UcdCursor = { buffer: readUcdBuffer(), offset: 0 };
    const entries: UcdEntry[] = [];
    let cp = nextCodepoint(cursor, -1);

    while (cp !== null) {
        const name = readName(cursor);

        if (name === null) {
            break;
        }

        appendUcdEntry(entries, cp, name);
        cp = nextCodepoint(cursor, cp);
    }

    return entries;
}

function compareByScript(a: UcdEntry, b: UcdEntry): number {
    const scriptA = GLib.unicharGetScript(a.char);
    const scriptB = GLib.unicharGetScript(b.char);

    if (scriptA !== scriptB) {
        return scriptA - scriptB;
    }

    return a.codepoint - b.codepoint;
}

function flushScriptGroup(grouping: ScriptGrouping) {
    if (grouping.entries.length > 0) {
        grouping.sections.push({ script: grouping.script, entries: grouping.entries });
    }
}

function addToScriptGroup(grouping: ScriptGrouping, entry: UcdEntry) {
    const script = getScriptName(GLib.unicharGetScript(entry.char));

    if (script === grouping.script) {
        grouping.entries.push(entry);

        return;
    }

    flushScriptGroup(grouping);
    grouping.script = script;
    grouping.entries = [entry];
}

function groupByScript(entries: UcdEntry[]): UcdSection[] {
    const grouping: ScriptGrouping = { sections: [], script: "", entries: [] };
    const sorted = entries.toSorted((a, b) => compareByScript(a, b));

    for (const entry of sorted) {
        addToScriptGroup(grouping, entry);
    }

    flushScriptGroup(grouping);

    return grouping.sections;
}

function buildCharacterData(): CharacterData {
    const sections = groupByScript(characters);

    return { sections, flat: sections.flatMap((section) => section.entries) };
}

function inscriptionColumn(id: string, title: string, label: (item: UcdEntry) => string): ColumnViewColumn<UcdEntry> {
    return {
        id,
        title,
        resizable: true,
        renderCell: ({ item }) => (
            <GtkInscription
                text={label(item)}
                cssClasses={["dim-label"]}
                xalign={0}
                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                marginTop={4}
                marginBottom={4}
            />
        ),
    };
}

const renderUcdHeader = ({ section: script }: { section: string }) => (
    <GtkLabel
        halign={Gtk.Align.START}
        cssClasses={["heading"]}
        marginTop={20}
        marginBottom={10}
        marginStart={10}
        marginEnd={20}
    >
        {script}
    </GtkLabel>
);

function ListViewUcdDemo() {
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
                <ColumnView<UcdEntry, string>
                    name="column-view"
                    showColumnSeparators
                    estimatedItemHeight={32}
                    onActivate={handleActivate}
                    renderHeader={renderUcdHeader}
                    sections={characterSections.map((section) => ({
                        id: section.script,
                        value: section.script,
                        data: section.entries.map((entry) => ({ id: entry.codepointStr, value: entry })),
                    }))}
                    columns={[
                        ucdCodepointColumn,
                        ucdCharColumn,
                        ucdNameColumn,
                        ucdTypeColumn,
                        ucdBreakTypeColumn,
                        ucdCombiningClassColumn,
                    ]}
                />
            </GtkScrolledWindow>
            <GtkLabel name="selected-char" cssClasses={[css`font-size: 80px;`]} hexpand widthChars={2}>
                {selectedChar}
            </GtkLabel>
        </GtkBox>
    );
}

export { listviewUcdDemo };
