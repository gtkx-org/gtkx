import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkProgressBar, GtkScrolledWindow, GtkSearchEntry, x } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-words.tsx?raw";

const DICT_FILE = "/usr/share/dict/words";
const FILTER_DELAY_MS = 150;

const ListViewWordsDemo = () => {
    const [words, setWords] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [deferredSearch, setDeferredSearch] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const loadWords = () => {
            try {
                const file = Gio.fileNewForPath(DICT_FILE);
                const contentsRef = { value: [] as number[] };
                const success = file.loadContents(contentsRef, null);
                if (success && contentsRef.value.length > 0) {
                    const text = new TextDecoder().decode(new Uint8Array(contentsRef.value));
                    const wordList = text
                        .split("\n")
                        .map((w) => w.trim())
                        .filter((w) => w.length > 0);
                    setWords(wordList);
                } else {
                    throw new Error("Failed to load file");
                }
            } catch {
                setWords([
                    "Unable to load dictionary",
                    "The file /usr/share/dict/words was not found",
                    "Install a dictionary package (e.g., words or wamerican)",
                ]);
            }
            setLoading(false);
        };
        loadWords();
    }, []);

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            setDeferredSearch(searchText);
        }, FILTER_DELAY_MS);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [searchText]);

    const filteredWords = useMemo(() => {
        if (deferredSearch === "") {
            return words;
        }
        const lower = deferredSearch.toLowerCase();
        return words.filter((word) => word.toLowerCase().includes(lower));
    }, [words, deferredSearch]);

    const handleSearchChanged = (entry: Gtk.SearchEntry) => {
        setSearchText(entry.getText());
    };

    if (loading) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                vexpand
            >
                <GtkLabel label="Loading dictionary..." />
                <GtkProgressBar widthRequest={200} pulseStep={0.1} />
            </GtkBox>
        );
    }

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkBox hexpand marginStart={12} marginEnd={12} marginTop={12} marginBottom={12}>
                <GtkSearchEntry
                    text={searchText}
                    placeholderText="Search words..."
                    onSearchChanged={handleSearchChanged}
                    hexpand
                />
            </GtkBox>

            <GtkLabel
                label={`${filteredWords.length.toLocaleString()} words ${deferredSearch ? `matching "${deferredSearch}"` : ""}`}
                cssClasses={["dim-label"]}
                halign={Gtk.Align.START}
                marginStart={12}
                marginBottom={8}
            />

            <GtkScrolledWindow vexpand hexpand>
                <x.ListView<string>
                    vexpand
                    hexpand
                    estimatedItemHeight={32}
                    renderItem={(word) => (
                        <GtkLabel
                            label={word ?? ""}
                            halign={Gtk.Align.START}
                            marginStart={12}
                            marginTop={6}
                            marginBottom={6}
                        />
                    )}
                >
                    {filteredWords.map((word) => (
                        <x.ListItem key={word} id={word} value={word} />
                    ))}
                </x.ListView>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export const listviewWordsDemo: Demo = {
    id: "listview-words",
    title: "Lists/Words",
    description:
        "This demo shows a listview with a large number of words. The list is loaded from /usr/share/dict/words and filtered incrementally.",
    keywords: ["listview", "words", "dictionary", "GtkListView", "search", "filter", "incremental"],
    component: ListViewWordsDemo,
    sourceCode,
};
