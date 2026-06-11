import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkColumnView, GtkColumnViewColumn, GtkInscription, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-ucd.tsx?raw";
import { path as ucdDataPath } from "./ucdnames.data";

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

const SCRIPT_NAMES = new Map<number, string>([
    [GLib.UnicodeScript.COMMON, "No script"],
    [GLib.UnicodeScript.INHERITED, "No script"],
    [GLib.UnicodeScript.ARABIC, "Arabic"],
    [GLib.UnicodeScript.ARMENIAN, "Armenian"],
    [GLib.UnicodeScript.BENGALI, "Bengali"],
    [GLib.UnicodeScript.BOPOMOFO, "Bopomofo"],
    [GLib.UnicodeScript.CHEROKEE, "Cherokee"],
    [GLib.UnicodeScript.COPTIC, "Coptic"],
    [GLib.UnicodeScript.CYRILLIC, "Cyrillic"],
    [GLib.UnicodeScript.DESERET, "Deseret"],
    [GLib.UnicodeScript.DEVANAGARI, "Devanagari"],
    [GLib.UnicodeScript.ETHIOPIC, "Ethiopic"],
    [GLib.UnicodeScript.GEORGIAN, "Georgian"],
    [GLib.UnicodeScript.GOTHIC, "Gothic"],
    [GLib.UnicodeScript.GREEK, "Greek"],
    [GLib.UnicodeScript.GUJARATI, "Gujarati"],
    [GLib.UnicodeScript.GURMUKHI, "Gurmukhi"],
    [GLib.UnicodeScript.HAN, "Han"],
    [GLib.UnicodeScript.HANGUL, "Hangul"],
    [GLib.UnicodeScript.HEBREW, "Hebrew"],
    [GLib.UnicodeScript.HIRAGANA, "Hiragana"],
    [GLib.UnicodeScript.KANNADA, "Kannada"],
    [GLib.UnicodeScript.KATAKANA, "Katakana"],
    [GLib.UnicodeScript.KHMER, "Khmer"],
    [GLib.UnicodeScript.LAO, "Lao"],
    [GLib.UnicodeScript.LATIN, "Latin"],
    [GLib.UnicodeScript.MALAYALAM, "Malayalam"],
    [GLib.UnicodeScript.MONGOLIAN, "Mongolian"],
    [GLib.UnicodeScript.MYANMAR, "Myanmar"],
    [GLib.UnicodeScript.OGHAM, "Ogham"],
    [GLib.UnicodeScript.OLD_ITALIC, "Old Italic"],
    [GLib.UnicodeScript.ORIYA, "Oriya"],
    [GLib.UnicodeScript.RUNIC, "Runic"],
    [GLib.UnicodeScript.SINHALA, "Sinhala"],
    [GLib.UnicodeScript.SYRIAC, "Syriac"],
    [GLib.UnicodeScript.TAMIL, "Tamil"],
    [GLib.UnicodeScript.TELUGU, "Telugu"],
    [GLib.UnicodeScript.THAANA, "Thaana"],
    [GLib.UnicodeScript.THAI, "Thai"],
    [GLib.UnicodeScript.TIBETAN, "Tibetan"],
    [GLib.UnicodeScript.CANADIAN_ABORIGINAL, "Canadian Aboriginal"],
    [GLib.UnicodeScript.YI, "Yi"],
    [GLib.UnicodeScript.TAGALOG, "Tagalog"],
    [GLib.UnicodeScript.HANUNOO, "Hanunoo"],
    [GLib.UnicodeScript.BUHID, "Buhid"],
    [GLib.UnicodeScript.TAGBANWA, "Tagbanwa"],
    [GLib.UnicodeScript.BRAILLE, "Braille"],
    [GLib.UnicodeScript.CYPRIOT, "Cypriot"],
    [GLib.UnicodeScript.LIMBU, "Limbu"],
    [GLib.UnicodeScript.OSMANYA, "Osmanya"],
    [GLib.UnicodeScript.SHAVIAN, "Shavian"],
    [GLib.UnicodeScript.LINEAR_B, "Linear B"],
    [GLib.UnicodeScript.TAI_LE, "Tai Le"],
    [GLib.UnicodeScript.UGARITIC, "Ugaritic"],
    [GLib.UnicodeScript.NEW_TAI_LUE, "New Tai Lue"],
    [GLib.UnicodeScript.BUGINESE, "Buginese"],
    [GLib.UnicodeScript.GLAGOLITIC, "Glagolitic"],
    [GLib.UnicodeScript.TIFINAGH, "Tifinagh"],
    [GLib.UnicodeScript.SYLOTI_NAGRI, "Syloti Nagri"],
    [GLib.UnicodeScript.OLD_PERSIAN, "Old Persian"],
    [GLib.UnicodeScript.KHAROSHTHI, "Kharoshthi"],
    [GLib.UnicodeScript.UNKNOWN, "Unknown"],
    [GLib.UnicodeScript.BALINESE, "Balinese"],
    [GLib.UnicodeScript.CUNEIFORM, "Cuneiform"],
    [GLib.UnicodeScript.PHOENICIAN, "Phoenician"],
    [GLib.UnicodeScript.PHAGS_PA, "Phags-pa"],
    [GLib.UnicodeScript.NKO, "N'Ko"],
    [GLib.UnicodeScript.KAYAH_LI, "Kayah Li"],
    [GLib.UnicodeScript.LEPCHA, "Lepcha"],
    [GLib.UnicodeScript.REJANG, "Rejang"],
    [GLib.UnicodeScript.SUNDANESE, "Sundanese"],
    [GLib.UnicodeScript.SAURASHTRA, "Saurashtra"],
    [GLib.UnicodeScript.CHAM, "Cham"],
    [GLib.UnicodeScript.OL_CHIKI, "Ol Chiki"],
    [GLib.UnicodeScript.VAI, "Vai"],
    [GLib.UnicodeScript.CARIAN, "Carian"],
    [GLib.UnicodeScript.LYCIAN, "Lycian"],
    [GLib.UnicodeScript.LYDIAN, "Lydian"],
    [GLib.UnicodeScript.AVESTAN, "Avestan"],
    [GLib.UnicodeScript.BAMUM, "Bamum"],
    [GLib.UnicodeScript.EGYPTIAN_HIEROGLYPHS, "Egyptian Hieroglyphs"],
    [GLib.UnicodeScript.IMPERIAL_ARAMAIC, "Imperial Aramaic"],
    [GLib.UnicodeScript.INSCRIPTIONAL_PAHLAVI, "Inscriptional Pahlavi"],
    [GLib.UnicodeScript.INSCRIPTIONAL_PARTHIAN, "Inscriptional Parthian"],
    [GLib.UnicodeScript.JAVANESE, "Javanese"],
    [GLib.UnicodeScript.KAITHI, "Kaithi"],
    [GLib.UnicodeScript.LISU, "Lisu"],
    [GLib.UnicodeScript.MEETEI_MAYEK, "Meetei Mayek"],
    [GLib.UnicodeScript.OLD_SOUTH_ARABIAN, "Old South Arabian"],
    [GLib.UnicodeScript.OLD_TURKIC, "Old Turkic"],
    [GLib.UnicodeScript.SAMARITAN, "Samaritan"],
    [GLib.UnicodeScript.TAI_THAM, "Tai Tham"],
    [GLib.UnicodeScript.TAI_VIET, "Tai Viet"],
    [GLib.UnicodeScript.BATAK, "Batak"],
    [GLib.UnicodeScript.BRAHMI, "Brahmi"],
    [GLib.UnicodeScript.MANDAIC, "Mandaic"],
    [GLib.UnicodeScript.CHAKMA, "Chakma"],
    [GLib.UnicodeScript.MEROITIC_CURSIVE, "Meroitic Cursive"],
    [GLib.UnicodeScript.MEROITIC_HIEROGLYPHS, "Meroitic Hieroglyphs"],
    [GLib.UnicodeScript.MIAO, "Miao"],
    [GLib.UnicodeScript.SHARADA, "Sharada"],
    [GLib.UnicodeScript.SORA_SOMPENG, "Sora Sompeng"],
    [GLib.UnicodeScript.TAKRI, "Takri"],
    [GLib.UnicodeScript.BASSA_VAH, "Bassa"],
    [GLib.UnicodeScript.CAUCASIAN_ALBANIAN, "Caucasian Albanian"],
    [GLib.UnicodeScript.DUPLOYAN, "Duployan"],
    [GLib.UnicodeScript.ELBASAN, "Elbasan"],
    [GLib.UnicodeScript.GRANTHA, "Grantha"],
    [GLib.UnicodeScript.KHOJKI, "Khojki"],
    [GLib.UnicodeScript.KHUDAWADI, "Khudawadi, Sindhi"],
    [GLib.UnicodeScript.LINEAR_A, "Linear A"],
    [GLib.UnicodeScript.MAHAJANI, "Mahajani"],
    [GLib.UnicodeScript.MANICHAEAN, "Manichaean"],
    [GLib.UnicodeScript.MENDE_KIKAKUI, "Mende Kikakui"],
    [GLib.UnicodeScript.MODI, "Modi"],
    [GLib.UnicodeScript.MRO, "Mro"],
    [GLib.UnicodeScript.NABATAEAN, "Nabataean"],
    [GLib.UnicodeScript.OLD_NORTH_ARABIAN, "Old North Arabian"],
    [GLib.UnicodeScript.OLD_PERMIC, "Old Permic"],
    [GLib.UnicodeScript.PAHAWH_HMONG, "Pahawh Hmong"],
    [GLib.UnicodeScript.PALMYRENE, "Palmyrene"],
    [GLib.UnicodeScript.PAU_CIN_HAU, "Pau Cin Hau"],
    [GLib.UnicodeScript.PSALTER_PAHLAVI, "Psalter Pahlavi"],
    [GLib.UnicodeScript.SIDDHAM, "Siddham"],
    [GLib.UnicodeScript.TIRHUTA, "Tirhuta"],
    [GLib.UnicodeScript.WARANG_CITI, "Warang Citi"],
    [GLib.UnicodeScript.AHOM, "Ahom"],
    [GLib.UnicodeScript.ANATOLIAN_HIEROGLYPHS, "Anatolian Hieroglyphs"],
    [GLib.UnicodeScript.HATRAN, "Hatran"],
    [GLib.UnicodeScript.MULTANI, "Multani"],
    [GLib.UnicodeScript.OLD_HUNGARIAN, "Old Hungarian"],
    [GLib.UnicodeScript.SIGNWRITING, "Signwriting"],
    [GLib.UnicodeScript.ADLAM, "Adlam"],
    [GLib.UnicodeScript.BHAIKSUKI, "Bhaiksuki"],
    [GLib.UnicodeScript.MARCHEN, "Marchen"],
    [GLib.UnicodeScript.NEWA, "Newa"],
    [GLib.UnicodeScript.OSAGE, "Osage"],
    [GLib.UnicodeScript.TANGUT, "Tangut"],
    [GLib.UnicodeScript.MASARAM_GONDI, "Masaram Gondi"],
    [GLib.UnicodeScript.NUSHU, "Nushu"],
    [GLib.UnicodeScript.SOYOMBO, "Soyombo"],
    [GLib.UnicodeScript.ZANABAZAR_SQUARE, "Zanabazar Square"],
    [GLib.UnicodeScript.DOGRA, "Dogra"],
    [GLib.UnicodeScript.GUNJALA_GONDI, "Gunjala Gondi"],
    [GLib.UnicodeScript.HANIFI_ROHINGYA, "Hanifi Rohingya"],
    [GLib.UnicodeScript.MAKASAR, "Makasar"],
    [GLib.UnicodeScript.MEDEFAIDRIN, "Medefaidrin"],
    [GLib.UnicodeScript.OLD_SOGDIAN, "Old Sogdian"],
    [GLib.UnicodeScript.SOGDIAN, "Sogdian"],
    [GLib.UnicodeScript.ELYMAIC, "Elym"],
    [GLib.UnicodeScript.NANDINAGARI, "Nand"],
    [GLib.UnicodeScript.NYIAKENG_PUACHUE_HMONG, "Rohg"],
    [GLib.UnicodeScript.WANCHO, "Wcho"],
    [GLib.UnicodeScript.CHORASMIAN, "Chorasmian"],
    [GLib.UnicodeScript.DIVES_AKURU, "Dives Akuru"],
    [GLib.UnicodeScript.KHITAN_SMALL_SCRIPT, "Khitan small script"],
    [GLib.UnicodeScript.YEZIDI, "Yezidi"],
]);

function getScriptName(value: number): string {
    return SCRIPT_NAMES.get(value) ?? "Unknown";
}

function parseUcdData(): UcdEntry[] {
    const bytes = Gio.resourcesLookupData(ucdDataPath, Gio.ResourceLookupFlags.NONE);
    const data = bytes.getData();
    if (!data) {
        throw new Error(`UCD data resource is empty: ${ucdDataPath}`);
    }
    const buffer = Buffer.from(data);
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
        const sa = GLib.unicharGetScript(a.char);
        const sb = GLib.unicharGetScript(b.char);
        if (sa !== sb) return sa - sb;
        return a.codepoint - b.codepoint;
    });

    const sections: UcdSection[] = [];
    let currentScript = "";
    let currentEntries: UcdEntry[] = [];

    for (const entry of sorted) {
        const script = getScriptName(GLib.unicharGetScript(entry.char));
        if (script === currentScript) {
            currentEntries.push(entry);
        } else {
            if (currentEntries.length > 0) {
                sections.push({ script: currentScript, entries: currentEntries });
            }
            currentScript = script;
            currentEntries = [entry];
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

const renderUcdHeader = (script: string) => (
    <GtkLabel
        label={script}
        halign={Gtk.Align.START}
        cssClasses={["heading"]}
        marginTop={20}
        marginBottom={10}
        marginStart={10}
        marginEnd={20}
    />
);

const UcdCodepointColumn = () => (
    <GtkColumnViewColumn
        id="codepoint"
        title="Codepoint"
        sortable
        renderCell={(item: UcdEntry) => (
            <GtkInscription text={item.codepointStr} cssClasses={["monospace"]} marginTop={4} marginBottom={4} />
        )}
    />
);

const UcdCharColumn = () => (
    <GtkColumnViewColumn
        id="char"
        title="Char"
        renderCell={(item: UcdEntry) => (
            <GtkInscription text={GLib.unicharIsprint(item.char) ? item.char : ""} marginTop={4} marginBottom={4} />
        )}
    />
);

const UcdNameColumn = () => (
    <GtkColumnViewColumn
        id="name"
        title="Name"
        resizable
        renderCell={(item: UcdEntry) => (
            <GtkInscription
                text={item.name}
                xalign={0}
                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                natChars={20}
                marginTop={4}
                marginBottom={4}
            />
        )}
    />
);

interface UcdInscriptionColumnProps {
    id: string;
    title: string;
    label: (item: UcdEntry) => string;
}

const UcdInscriptionColumn = ({ id, title, label }: UcdInscriptionColumnProps) => (
    <GtkColumnViewColumn
        id={id}
        title={title}
        resizable
        renderCell={(item: UcdEntry) => (
            <GtkInscription
                text={label(item)}
                cssClasses={["dim-label"]}
                xalign={0}
                textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                marginTop={4}
                marginBottom={4}
            />
        )}
    />
);

const UcdTypeColumn = () => (
    <UcdInscriptionColumn
        id="type"
        title="Type"
        label={(item) => UNICODE_TYPE_NAMES[GLib.unicharType(item.char)] ?? "Unknown"}
    />
);

const UcdBreakTypeColumn = () => (
    <UcdInscriptionColumn
        id="break-type"
        title="Break Type"
        label={(item) => BREAK_TYPE_NAMES[GLib.unicharBreakType(item.char)] ?? "Unknown"}
    />
);

const UcdCombiningClassColumn = () => (
    <UcdInscriptionColumn
        id="combining-class"
        title="Combining Class"
        label={(item) => COMBINING_CLASS_NAMES[GLib.unicharCombiningClass(item.char)] ?? "Unknown"}
    />
);

const ListViewUcdDemo = () => {
    const [selectedChar, setSelectedChar] = useState("");
    const { sections: characterSections, flat: flatSorted } = getCharacterData();

    const handleActivate = (position: number) => {
        const entry = flatSorted[position];
        if (entry) setSelectedChar(entry.char);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
            <GtkScrolledWindow propagateNaturalWidth vexpand>
                <GtkColumnView<UcdEntry, string>
                    name="column-view"
                    showColumnSeparators
                    estimatedRowHeight={32}
                    onActivate={handleActivate}
                    renderHeader={renderUcdHeader}
                    items={characterSections.map((section) => ({
                        id: section.script,
                        value: section.script,
                        section: true,
                        children: section.entries.map((entry) => ({ id: entry.codepointStr, value: entry })),
                    }))}
                >
                    <UcdCodepointColumn />
                    <UcdCharColumn />
                    <UcdNameColumn />
                    <UcdTypeColumn />
                    <UcdBreakTypeColumn />
                    <UcdCombiningClassColumn />
                </GtkColumnView>
            </GtkScrolledWindow>
            <GtkLabel
                name="selected-char"
                label={selectedChar}
                cssClasses={[css`font-size: 80px;`]}
                hexpand
                widthChars={2}
            />
        </GtkBox>
    );
};

export const listviewUcdDemo: Demo = {
    id: "listview-ucd",
    title: "Lists/Characters",
    description:
        "This demo shows a multi-column representation of some parts of the Unicode Character Database, or UCD. It also demonstrates the use of sections with headings to group items.\n\nThe dataset used here has 33 796 items.",
    keywords: [],
    component: ListViewUcdDemo,
    sourceCode,
    defaultWidth: 800,
    defaultHeight: 400,
};
