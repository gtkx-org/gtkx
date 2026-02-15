import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkInscription,
    GtkLabel,
    GtkListView,
    GtkOverlay,
    GtkProgressBar,
    GtkScrolledWindow,
    GtkSearchEntry,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./listview-words.tsx?raw";

const DICT_FILE = "/usr/share/dict/words";

const LOREM_IPSUM =
    "lorem ipsum dolor sit amet consectetur adipisci elit sed eiusmod tempor incidunt labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat";

const FILTER_CHUNK_SIZE = 50000;

function loadInitialWords(): string[] {
    if (existsSync(DICT_FILE)) {
        try {
            return readFileSync(DICT_FILE, "utf-8")
                .split("\n")
                .map((w) => w.trim())
                .filter((w) => w.length > 0);
        } catch {}
    }
    return LOREM_IPSUM.split(" ");
}

const initialWords = loadInitialWords();

const ListViewWordsDemo = ({ window }: DemoProps) => {
    const [words, setWords] = useState(initialWords);
    const [searchText, setSearchText] = useState("");
    const [filteredWords, setFilteredWords] = useState(initialWords);
    const [filterProgress, setFilterProgress] = useState(1);
    const filterRef = useRef<{ cancelled: boolean }>({ cancelled: false });

    const loadFile = useCallback(async (filePath: string) => {
        try {
            const text = await readFile(filePath, "utf-8");
            const wordList = text
                .split("\n")
                .map((w) => w.trim())
                .filter((w) => w.length > 0);
            setWords(wordList);
            setFilteredWords(wordList);
            setSearchText("");
        } catch {}
    }, []);

    const handleOpen = useCallback(async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open file");
        try {
            const file = await dialog.openAsync(window.current);
            const path = file.getPath();
            if (path) {
                await loadFile(path);
            }
        } catch {}
    }, [window, loadFile]);

    useEffect(() => {
        filterRef.current.cancelled = true;
        const ctx = { cancelled: false };
        filterRef.current = ctx;

        if (searchText === "") {
            setFilteredWords(words);
            setFilterProgress(1);
            return;
        }

        const lower = searchText.toLowerCase();
        const result: string[] = [];
        let offset = 0;

        setFilterProgress(0);

        const filterStep = () => {
            if (ctx.cancelled) return;

            const end = Math.min(offset + FILTER_CHUNK_SIZE, words.length);
            for (let i = offset; i < end; i++) {
                const w = words[i];
                if (w?.toLowerCase().includes(lower)) {
                    result.push(w);
                }
            }
            offset = end;

            const progress = words.length > 0 ? offset / words.length : 1;
            setFilterProgress(progress);
            setFilteredWords([...result]);

            if (offset < words.length) {
                setTimeout(filterStep, 0);
            }
        };

        setTimeout(filterStep, 0);

        return () => {
            ctx.cancelled = true;
        };
    }, [words, searchText]);

    const handleSearchChanged = (entry: Gtk.SearchEntry) => {
        setSearchText(entry.getText());
    };

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkButton label="_Open" useUnderline onClicked={() => void handleOpen()} />
                    </x.ContainerSlot>
                    <x.Slot for={GtkHeaderBar} id="titleWidget">
                        <GtkLabel label={`${filteredWords.length.toLocaleString()} lines`} />
                    </x.Slot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
                <GtkSearchEntry
                    text={searchText}
                    placeholderText="Search words..."
                    onSearchChanged={handleSearchChanged}
                    hexpand
                />

                <GtkOverlay vexpand hexpand>
                    <GtkScrolledWindow vexpand hexpand>
                        <GtkListView
                            vexpand
                            hexpand
                            estimatedItemHeight={32}
                            selectionMode={Gtk.SelectionMode.NONE}
                            renderItem={(word: string | null) => (
                                <GtkInscription
                                    text={word ?? ""}
                                    xalign={0}
                                    natChars={20}
                                    textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                                />
                            )}
                        >
                            {filteredWords.map((word) => (
                                <x.ListItem key={word} id={word} value={word} />
                            ))}
                        </GtkListView>
                    </GtkScrolledWindow>
                    {filterProgress < 1 && (
                        <x.OverlayChild>
                            <GtkProgressBar
                                fraction={filterProgress}
                                halign={Gtk.Align.FILL}
                                valign={Gtk.Align.START}
                                hexpand
                            />
                        </x.OverlayChild>
                    )}
                </GtkOverlay>
            </GtkBox>
        </>
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
    defaultWidth: 400,
    defaultHeight: 600,
};
