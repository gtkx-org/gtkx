import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, GtkSearchEntry, x } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-words.tsx?raw";

interface WordItem {
    id: string;
    word: string;
    definition: string;
    partOfSpeech: string;
}

const dictionary: WordItem[] = [
    {
        id: "aberration",
        word: "Aberration",
        definition: "A departure from what is normal or expected",
        partOfSpeech: "noun",
    },
    { id: "benevolent", word: "Benevolent", definition: "Well-meaning and kindly", partOfSpeech: "adjective" },
    { id: "cacophony", word: "Cacophony", definition: "A harsh discordant mixture of sounds", partOfSpeech: "noun" },
    { id: "deftly", word: "Deftly", definition: "In a skillful and nimble way", partOfSpeech: "adverb" },
    { id: "ebullient", word: "Ebullient", definition: "Cheerful and full of energy", partOfSpeech: "adjective" },
    {
        id: "facetious",
        word: "Facetious",
        definition: "Treating serious issues with deliberately inappropriate humor",
        partOfSpeech: "adjective",
    },
    {
        id: "garrulous",
        word: "Garrulous",
        definition: "Excessively talkative, especially on trivial matters",
        partOfSpeech: "adjective",
    },
    {
        id: "harbinger",
        word: "Harbinger",
        definition: "A person or thing that announces the approach of another",
        partOfSpeech: "noun",
    },
    {
        id: "iconoclast",
        word: "Iconoclast",
        definition: "A person who attacks cherished beliefs or institutions",
        partOfSpeech: "noun",
    },
    {
        id: "juxtapose",
        word: "Juxtapose",
        definition: "Place side by side for contrasting effect",
        partOfSpeech: "verb",
    },
    { id: "kudos", word: "Kudos", definition: "Praise and honor received for an achievement", partOfSpeech: "noun" },
    {
        id: "laconic",
        word: "Laconic",
        definition: "Using very few words; brief and concise",
        partOfSpeech: "adjective",
    },
    {
        id: "mellifluous",
        word: "Mellifluous",
        definition: "Sweet or musical; pleasant to hear",
        partOfSpeech: "adjective",
    },
    { id: "nefarious", word: "Nefarious", definition: "Wicked or criminal", partOfSpeech: "adjective" },
    {
        id: "obfuscate",
        word: "Obfuscate",
        definition: "Render obscure, unclear, or unintelligible",
        partOfSpeech: "verb",
    },
    {
        id: "perfunctory",
        word: "Perfunctory",
        definition: "Carried out with minimum effort or reflection",
        partOfSpeech: "adjective",
    },
    {
        id: "quixotic",
        word: "Quixotic",
        definition: "Exceedingly idealistic; unrealistic and impractical",
        partOfSpeech: "adjective",
    },
    {
        id: "recalcitrant",
        word: "Recalcitrant",
        definition: "Having an obstinately uncooperative attitude",
        partOfSpeech: "adjective",
    },
    {
        id: "sycophant",
        word: "Sycophant",
        definition: "A person who acts obsequiously toward someone important",
        partOfSpeech: "noun",
    },
    {
        id: "taciturn",
        word: "Taciturn",
        definition: "Reserved or uncommunicative in speech",
        partOfSpeech: "adjective",
    },
    {
        id: "ubiquitous",
        word: "Ubiquitous",
        definition: "Present, appearing, or found everywhere",
        partOfSpeech: "adjective",
    },
    {
        id: "vicarious",
        word: "Vicarious",
        definition: "Experienced in the imagination through another person",
        partOfSpeech: "adjective",
    },
    {
        id: "wistful",
        word: "Wistful",
        definition: "Having or showing a feeling of vague longing",
        partOfSpeech: "adjective",
    },
    {
        id: "xenophobia",
        word: "Xenophobia",
        definition: "Dislike of or prejudice against people from other countries",
        partOfSpeech: "noun",
    },
    {
        id: "youthful",
        word: "Youthful",
        definition: "Young or seeming young; characteristic of youth",
        partOfSpeech: "adjective",
    },
    { id: "zealous", word: "Zealous", definition: "Having or showing zeal; fervent", partOfSpeech: "adjective" },
];

type FilterType = "all" | "noun" | "verb" | "adjective" | "adverb";

const ListViewWordsDemo = () => {
    const [searchText, setSearchText] = useState("");
    const [filterType, setFilterType] = useState<FilterType>("all");
    const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);

    const filteredWords = useMemo(() => {
        return dictionary.filter((word) => {
            const matchesSearch =
                searchText === "" ||
                word.word.toLowerCase().includes(searchText.toLowerCase()) ||
                word.definition.toLowerCase().includes(searchText.toLowerCase());
            const matchesFilter = filterType === "all" || word.partOfSpeech === filterType;
            return matchesSearch && matchesFilter;
        });
    }, [searchText, filterType]);

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const word = filteredWords[position];
        if (word) {
            setSelectedWord(word);
        }
    };

    const getCounts = () => {
        return {
            noun: dictionary.filter((w) => w.partOfSpeech === "noun").length,
            verb: dictionary.filter((w) => w.partOfSpeech === "verb").length,
            adjective: dictionary.filter((w) => w.partOfSpeech === "adjective").length,
            adverb: dictionary.filter((w) => w.partOfSpeech === "adverb").length,
        };
    };

    const counts = getCounts();

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Word List" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="ListView with search filtering and category buttons. Type in the search box to filter words by name or definition. Use the filter buttons to show only specific parts of speech."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Dictionary">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkSearchEntry
                        text={searchText}
                        placeholderText="Search words or definitions..."
                        onSearchChanged={(entry) => setSearchText(entry.getText())}
                    />

                    <GtkBox spacing={8}>
                        <GtkButton
                            label={`All (${dictionary.length})`}
                            onClicked={() => setFilterType("all")}
                            cssClasses={filterType === "all" ? ["suggested-action"] : ["flat"]}
                        />
                        <GtkButton
                            label={`Nouns (${counts.noun})`}
                            onClicked={() => setFilterType("noun")}
                            cssClasses={filterType === "noun" ? ["suggested-action"] : ["flat"]}
                        />
                        <GtkButton
                            label={`Verbs (${counts.verb})`}
                            onClicked={() => setFilterType("verb")}
                            cssClasses={filterType === "verb" ? ["suggested-action"] : ["flat"]}
                        />
                        <GtkButton
                            label={`Adjectives (${counts.adjective})`}
                            onClicked={() => setFilterType("adjective")}
                            cssClasses={filterType === "adjective" ? ["suggested-action"] : ["flat"]}
                        />
                        <GtkButton
                            label={`Adverbs (${counts.adverb})`}
                            onClicked={() => setFilterType("adverb")}
                            cssClasses={filterType === "adverb" ? ["suggested-action"] : ["flat"]}
                        />
                    </GtkBox>

                    <GtkLabel
                        label={`Showing ${filteredWords.length} words`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<WordItem>
                            estimatedItemHeight={52}
                            showSeparators
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={12} marginTop={10} marginBottom={10} marginStart={12} marginEnd={12}>
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        hexpand
                                        valign={Gtk.Align.CENTER}
                                    >
                                        <GtkBox spacing={8}>
                                            <GtkLabel
                                                label={item?.word ?? ""}
                                                halign={Gtk.Align.START}
                                                cssClasses={["heading"]}
                                            />
                                            <GtkLabel
                                                label={item?.partOfSpeech ?? ""}
                                                cssClasses={["caption"]}
                                                halign={Gtk.Align.START}
                                            />
                                        </GtkBox>
                                        <GtkLabel
                                            label={item?.definition ?? ""}
                                            cssClasses={["dim-label"]}
                                            halign={Gtk.Align.START}
                                            ellipsize={3}
                                        />
                                    </GtkBox>
                                </GtkBox>
                            )}
                        >
                            {filteredWords.map((word) => (
                                <x.ListItem key={word.id} id={word.id} value={word} />
                            ))}
                        </x.ListView>
                    </GtkScrolledWindow>

                    {filteredWords.length === 0 && (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            halign={Gtk.Align.CENTER}
                            marginTop={24}
                            marginBottom={24}
                        >
                            <GtkLabel label="No words found" cssClasses={["title-3", "dim-label"]} />
                            <GtkLabel label="Try a different search term or filter" cssClasses={["dim-label"]} />
                        </GtkBox>
                    )}

                    {selectedWord && (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            cssClasses={["card"]}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkBox spacing={12}>
                                <GtkLabel label={selectedWord.word} cssClasses={["title-2"]} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label={selectedWord.partOfSpeech}
                                    cssClasses={["dim-label"]}
                                    valign={Gtk.Align.CENTER}
                                />
                            </GtkBox>
                            <GtkLabel label={selectedWord.definition} wrap halign={Gtk.Align.START} />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Search Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="The search filters both word names and definitions in real-time using useMemo for efficient re-computation. Combined with category buttons, this shows how to implement multi-criteria filtering on a ListView."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewWordsDemo: Demo = {
    id: "listview-words",
    title: "Word List",
    description: "ListView with search filtering and category buttons",
    keywords: ["listview", "words", "dictionary", "GtkListView", "search", "filter", "useMemo"],
    component: ListViewWordsDemo,
    sourceCode,
};
