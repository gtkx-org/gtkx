import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkInscription,
    GtkListView,
    GtkOverlay,
    GtkOverlayChild,
    GtkProgressBar,
    GtkScrolledWindow,
    GtkSearchEntry,
} from "@gtkx/react";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDemo } from "../../context/demo-context.js";
import type { Demo, DemoProps, DemoProviderProps } from "../types.js";
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
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    }
    return LOREM_IPSUM.split(" ");
}

const initialWords = loadInitialWords();

const loadWordsFromFile = async (
    filePath: string,
    setWords: (words: string[]) => void,
    setSearchText: (text: string) => void,
) => {
    try {
        const text = await readFile(filePath, "utf-8");
        const wordList = text
            .split("\n")
            .map((w) => w.trim())
            .filter((w) => w.length > 0);
        setWords(wordList);
        setSearchText("");
    } catch (e) {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage(`Failure reading words from '${filePath}': ${e}`);
        dialog.show(null);
    }
};

interface FilterState {
    canceled: boolean;
}

const runFilterStep = ({
    ctx,
    words,
    lower,
    result,
    offset,
    setFilterProgress,
    setFilteredWords,
}: {
    ctx: FilterState;
    words: string[];
    lower: string;
    result: string[];
    offset: number;
    setFilterProgress: (n: number) => void;
    setFilteredWords: (w: string[]) => void;
}) => {
    if (ctx.canceled) return;

    const end = Math.min(offset + FILTER_CHUNK_SIZE, words.length);
    for (let i = offset; i < end; i++) {
        const w = words[i];
        if (w?.toLowerCase().includes(lower)) result.push(w);
    }
    const newOffset = end;
    const progress = words.length > 0 ? newOffset / words.length : 1;
    setFilterProgress(progress);
    setFilteredWords([...result]);

    if (newOffset < words.length) {
        setTimeout(
            () =>
                runFilterStep({
                    ctx,
                    words,
                    lower,
                    result,
                    offset: newOffset,
                    setFilterProgress,
                    setFilteredWords,
                }),
            0,
        );
    }
};

function useFilteredWords(words: string[], searchText: string) {
    const [filteredWords, setFilteredWords] = useState(initialWords);
    const [filterProgress, setFilterProgress] = useState(1);
    const filterRef = useRef<FilterState>({ canceled: false });

    useEffect(() => {
        filterRef.current.canceled = true;
        const ctx = { canceled: false };
        filterRef.current = ctx;

        if (searchText === "") {
            setFilteredWords(words);
            setFilterProgress(1);
            return;
        }

        const lower = searchText.toLowerCase();
        const result: string[] = [];
        setFilterProgress(0);
        setTimeout(
            () => runFilterStep({ ctx, words, lower, result, offset: 0, setFilterProgress, setFilteredWords }),
            0,
        );

        return () => {
            ctx.canceled = true;
        };
    }, [words, searchText]);

    return { filteredWords, filterProgress };
}

const WordsList = ({ filteredWords, filterProgress }: { filteredWords: string[]; filterProgress: number }) => (
    <GtkOverlay vexpand hexpand>
        <GtkScrolledWindow vexpand hexpand>
            <GtkListView
                name="list-view"
                vexpand
                hexpand
                estimatedItemHeight={32}
                selectionMode={Gtk.SelectionMode.NONE}
                items={filteredWords.map((word) => ({ id: word, value: word }))}
                renderItem={(word: string) => (
                    <GtkInscription
                        text={word}
                        xalign={0}
                        natChars={20}
                        textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
                    />
                )}
            />
        </GtkScrolledWindow>
        {filterProgress < 1 && (
            <GtkOverlayChild>
                <GtkProgressBar fraction={filterProgress} halign={Gtk.Align.FILL} valign={Gtk.Align.START} hexpand />
            </GtkOverlayChild>
        )}
    </GtkOverlay>
);

interface WordsContextValue {
    searchText: string;
    setSearchText: (value: string) => void;
    filteredWords: string[];
    filterProgress: number;
    handleOpen: () => void;
}

const WordsContext = createContext<WordsContextValue | null>(null);

const useWordsContext = (): WordsContextValue => {
    const ctx = useContext(WordsContext);
    if (!ctx) throw new Error("WordsContext is missing");
    return ctx;
};

const ListViewWordsProvider = ({ window, children }: DemoProviderProps) => {
    const [words, setWords] = useState(initialWords);
    const [searchText, setSearchText] = useState("");
    const { filteredWords, filterProgress } = useFilteredWords(words, searchText);

    const loadFile = useCallback((filePath: string) => loadWordsFromFile(filePath, setWords, setSearchText), []);

    const handleOpen = useCallback(() => {
        const run = async () => {
            const dialog = new Gtk.FileDialog();
            dialog.setTitle("Open file");
            try {
                const file = await dialog.open(window.current, null);
                const path = file.getPath();
                if (path) await loadFile(path);
            } catch (e) {
                if (e instanceof Error) console.error(e.message);
            }
        };
        void run();
    }, [window, loadFile]);

    const value = useMemo<WordsContextValue>(
        () => ({ searchText, setSearchText, filteredWords, filterProgress, handleOpen }),
        [searchText, filteredWords, filterProgress, handleOpen],
    );

    return <WordsContext.Provider value={value}>{children}</WordsContext.Provider>;
};

const ListViewWordsTitlebar = () => {
    const { handleOpen } = useWordsContext();
    return <GtkHeaderBar packStart={<GtkButton label="_Open" useUnderline onClicked={handleOpen} />} />;
};

const ListViewWordsDemo = (_: DemoProps) => {
    const { searchText, setSearchText, filteredWords, filterProgress } = useWordsContext();
    const { setWindowTitle } = useDemo();

    useEffect(() => {
        setWindowTitle(`${filteredWords.length} lines`);
        return () => setWindowTitle(null);
    }, [filteredWords.length, setWindowTitle]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkSearchEntry
                name="search-entry"
                text={searchText}
                placeholderText="Search words..."
                onSearchChanged={(entry: Gtk.SearchEntry) => setSearchText(entry.getText())}
                hexpand
            />
            <WordsList filteredWords={filteredWords} filterProgress={filterProgress} />
        </GtkBox>
    );
};

export const listviewWordsDemo: Demo = {
    id: "listview-words",
    title: "Lists/Words",
    description:
        "This demo shows filtering a long list - of words.\n\nYou should have the file `/usr/share/dict/words` installed for this demo to work.",
    keywords: ["GtkListView", "GtkFilterListModel", "GtkInscription"],
    component: ListViewWordsDemo,
    titlebar: ListViewWordsTitlebar,
    provider: ListViewWordsProvider,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 600,
};
