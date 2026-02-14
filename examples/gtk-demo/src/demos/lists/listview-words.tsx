import { existsSync } from "node:fs";
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

const ListViewWordsDemo = ({ window }: DemoProps) => {
    const [words, setWords] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [filteredWords, setFilteredWords] = useState<string[]>([]);
    const [filterProgress, setFilterProgress] = useState(1);
    const filterRef = useRef<{ cancelled: boolean }>({ cancelled: false });

    const loadFile = useCallback(async (filePath: string) => {
        setLoading(true);
        try {
            const text = await readFile(filePath, "utf-8");
            const wordList = text
                .split("\n")
                .map((w) => w.trim())
                .filter((w) => w.length > 0);
            setWords(wordList);
            setFilteredWords(wordList);
        } catch {
            const fallback = LOREM_IPSUM.split(" ");
            setWords(fallback);
            setFilteredWords(fallback);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (existsSync(DICT_FILE)) {
            void loadFile(DICT_FILE);
        } else {
            const fallback = LOREM_IPSUM.split(" ");
            setWords(fallback);
            setFilteredWords(fallback);
            setLoading(false);
        }
    }, [loadFile]);

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
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    hexpand
                    marginStart={12}
                    marginEnd={12}
                    marginTop={12}
                    marginBottom={12}
                    spacing={4}
                >
                    <GtkSearchEntry
                        text={searchText}
                        placeholderText="Search words..."
                        onSearchChanged={handleSearchChanged}
                        hexpand
                    />
                </GtkBox>

                <GtkOverlay vexpand hexpand>
                    <GtkScrolledWindow vexpand hexpand>
                        <GtkListView
                            vexpand
                            hexpand
                            estimatedItemHeight={32}
                            renderItem={(word: string | null) => (
                                <GtkInscription
                                    text={word ?? ""}
                                    xalign={0}
                                    natChars={20}
                                    textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                                    marginStart={12}
                                    marginTop={6}
                                    marginBottom={6}
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
