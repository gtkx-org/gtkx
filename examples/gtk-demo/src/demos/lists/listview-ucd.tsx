import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, GtkSearchEntry, x } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-ucd.tsx?raw";

interface UnicodeChar {
    id: string;
    codepoint: number;
    char: string;
    name: string;
    category: string;
    block: string;
}

const unicodeBlocks: { name: string; start: number; end: number }[] = [
    { name: "Basic Latin", start: 0x0020, end: 0x007f },
    { name: "Latin-1 Supplement", start: 0x00a0, end: 0x00ff },
    { name: "Latin Extended-A", start: 0x0100, end: 0x017f },
    { name: "Greek and Coptic", start: 0x0370, end: 0x03ff },
    { name: "Cyrillic", start: 0x0400, end: 0x04ff },
    { name: "General Punctuation", start: 0x2000, end: 0x206f },
    { name: "Currency Symbols", start: 0x20a0, end: 0x20cf },
    { name: "Letterlike Symbols", start: 0x2100, end: 0x214f },
    { name: "Number Forms", start: 0x2150, end: 0x218f },
    { name: "Arrows", start: 0x2190, end: 0x21ff },
    { name: "Mathematical Operators", start: 0x2200, end: 0x22ff },
    { name: "Miscellaneous Technical", start: 0x2300, end: 0x23ff },
    { name: "Box Drawing", start: 0x2500, end: 0x257f },
    { name: "Block Elements", start: 0x2580, end: 0x259f },
    { name: "Geometric Shapes", start: 0x25a0, end: 0x25ff },
    { name: "Miscellaneous Symbols", start: 0x2600, end: 0x26ff },
    { name: "Dingbats", start: 0x2700, end: 0x27bf },
];

const generateBlockChars = (block: { name: string; start: number; end: number }): UnicodeChar[] => {
    const chars: UnicodeChar[] = [];
    const limit = Math.min(block.end, block.start + 63);
    for (let cp = block.start; cp <= limit; cp++) {
        try {
            const char = String.fromCodePoint(cp);
            if (cp < 0x0020 || (cp >= 0x007f && cp < 0x00a0)) continue;
            chars.push({
                id: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
                codepoint: cp,
                char,
                name: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
                category: "Letter",
                block: block.name,
            });
        } catch {}
    }
    return chars;
};

const ListViewUcdDemo = () => {
    const [selectedBlock, setSelectedBlock] = useState(unicodeBlocks[0]?.name ?? "Basic Latin");
    const [searchText, setSearchText] = useState("");
    const [selectedChar, setSelectedChar] = useState<UnicodeChar | null>(null);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const characters = useMemo(() => {
        const block = unicodeBlocks.find((b) => b.name === selectedBlock);
        if (!block) return [];
        return generateBlockChars(block);
    }, [selectedBlock]);

    const filteredCharacters = useMemo(() => {
        if (searchText === "") return characters;
        const search = searchText.toLowerCase();
        return characters.filter(
            (c) =>
                c.char.includes(searchText) ||
                c.id.toLowerCase().includes(search) ||
                c.name.toLowerCase().includes(search),
        );
    }, [characters, searchText]);

    const handleActivate = (_view: Gtk.GridView | Gtk.ListView, position: number) => {
        const char = filteredCharacters[position];
        if (char) {
            setSelectedChar(char);
        }
    };

    const formatCodepoint = (cp: number): string => {
        return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Unicode Character Browser" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Browse Unicode characters by block. Demonstrates a character database browser with both grid and list views, showing character glyphs, codepoints, and names."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox spacing={16}>
                <GtkFrame label="Unicode Blocks">
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={8}
                        marginBottom={8}
                        marginStart={8}
                        marginEnd={8}
                        widthRequest={200}
                    >
                        <GtkScrolledWindow heightRequest={400} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            <x.ListView<{ name: string }>
                                estimatedItemHeight={40}
                                showSeparators
                                onActivate={(_list, position) => {
                                    const block = unicodeBlocks[position];
                                    if (block) {
                                        setSelectedBlock(block.name);
                                    }
                                }}
                                renderItem={(item) => (
                                    <GtkLabel
                                        label={item?.name ?? ""}
                                        halign={Gtk.Align.START}
                                        marginTop={8}
                                        marginBottom={8}
                                        marginStart={12}
                                        marginEnd={12}
                                        cssClasses={item?.name === selectedBlock ? ["heading"] : []}
                                    />
                                )}
                            >
                                {unicodeBlocks.map((block) => (
                                    <x.ListItem key={block.name} id={block.name} value={{ name: block.name }} />
                                ))}
                            </x.ListView>
                        </GtkScrolledWindow>
                    </GtkBox>
                </GtkFrame>

                <GtkFrame label={selectedBlock} hexpand>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkBox spacing={8}>
                            <GtkSearchEntry
                                text={searchText}
                                placeholderText="Search characters..."
                                onSearchChanged={(entry) => setSearchText(entry.getText())}
                                hexpand
                            />
                            <GtkButton
                                iconName="view-grid-symbolic"
                                onClicked={() => setViewMode("grid")}
                                cssClasses={viewMode === "grid" ? ["suggested-action"] : ["flat"]}
                                tooltipText="Grid view"
                            />
                            <GtkButton
                                iconName="view-list-symbolic"
                                onClicked={() => setViewMode("list")}
                                cssClasses={viewMode === "list" ? ["suggested-action"] : ["flat"]}
                                tooltipText="List view"
                            />
                        </GtkBox>

                        <GtkLabel
                            label={`${filteredCharacters.length} characters`}
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.START}
                        />

                        <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                            {viewMode === "grid" ? (
                                <x.GridView<UnicodeChar>
                                    estimatedItemHeight={78}
                                    minColumns={6}
                                    maxColumns={12}
                                    onActivate={handleActivate}
                                    renderItem={(item) => (
                                        <GtkBox
                                            orientation={Gtk.Orientation.VERTICAL}
                                            spacing={2}
                                            cssClasses={["card"]}
                                            halign={Gtk.Align.CENTER}
                                            valign={Gtk.Align.CENTER}
                                            widthRequest={60}
                                            heightRequest={70}
                                            marginTop={4}
                                            marginBottom={4}
                                            marginStart={4}
                                            marginEnd={4}
                                        >
                                            <GtkLabel label={item?.char ?? ""} cssClasses={["title-1"]} marginTop={4} />
                                            <GtkLabel
                                                label={item?.id ?? ""}
                                                cssClasses={["dim-label", "caption", "monospace"]}
                                                marginBottom={4}
                                            />
                                        </GtkBox>
                                    )}
                                >
                                    {filteredCharacters.map((char) => (
                                        <x.ListItem key={char.id} id={char.id} value={char} />
                                    ))}
                                </x.GridView>
                            ) : (
                                <x.ListView<UnicodeChar>
                                    estimatedItemHeight={48}
                                    showSeparators
                                    onActivate={handleActivate}
                                    renderItem={(item) => (
                                        <GtkBox
                                            spacing={16}
                                            marginTop={8}
                                            marginBottom={8}
                                            marginStart={12}
                                            marginEnd={12}
                                        >
                                            <GtkLabel
                                                label={item?.char ?? ""}
                                                cssClasses={["title-2"]}
                                                widthRequest={40}
                                            />
                                            <GtkLabel
                                                label={item?.id ?? ""}
                                                cssClasses={["monospace"]}
                                                widthRequest={80}
                                            />
                                            <GtkLabel
                                                label={item?.name ?? ""}
                                                cssClasses={["dim-label"]}
                                                hexpand
                                                halign={Gtk.Align.START}
                                            />
                                        </GtkBox>
                                    )}
                                >
                                    {filteredCharacters.map((char) => (
                                        <x.ListItem key={char.id} id={char.id} value={char} />
                                    ))}
                                </x.ListView>
                            )}
                        </GtkScrolledWindow>

                        {selectedChar && (
                            <GtkBox spacing={24} cssClasses={["card"]} marginTop={8}>
                                <GtkLabel
                                    label={selectedChar.char}
                                    cssClasses={["title-1"]}
                                    marginStart={24}
                                    marginTop={16}
                                    marginBottom={16}
                                />
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    valign={Gtk.Align.CENTER}
                                    hexpand
                                >
                                    <GtkLabel
                                        label={formatCodepoint(selectedChar.codepoint)}
                                        cssClasses={["heading", "monospace"]}
                                        halign={Gtk.Align.START}
                                    />
                                    <GtkLabel
                                        label={`Block: ${selectedChar.block}`}
                                        cssClasses={["dim-label"]}
                                        halign={Gtk.Align.START}
                                    />
                                    <GtkLabel
                                        label={`Decimal: ${selectedChar.codepoint}`}
                                        cssClasses={["dim-label", "caption"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} valign={Gtk.Align.CENTER}>
                                    <GtkLabel label="HTML Entity" cssClasses={["dim-label", "caption"]} />
                                    <GtkLabel label={`&#${selectedChar.codepoint};`} cssClasses={["monospace"]} />
                                </GtkBox>
                            </GtkBox>
                        )}
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Characters are generated dynamically for each Unicode block using String.fromCodePoint(). The view toggles between GridView for visual browsing and ListView for detailed inspection. useMemo optimizes character generation and filtering."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
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
};
