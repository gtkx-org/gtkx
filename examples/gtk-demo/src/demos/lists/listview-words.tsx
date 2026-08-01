import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkInscription,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkProgressBar,
    GtkScrolledWindow,
    GtkSearchEntry,
} from "@gtkx/jsx/gtk";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createContext, type RefObject, useContext, useEffect, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { useDemo } from "../../context/demo-context.js";
import sourceCode from "./listview-words.tsx?raw";

type FilterState = {
    wasCanceled: boolean;
};

type FilterStep = {
    ctx: FilterState;
    words: string[];
    lower: string;
    result: string[];
    offset: number;
    onChunk: (matched: string[], progress: number) => void;
};

type FilterResult = {
    search: string;
    words: string[];
    progress: number;
};

type WordsContextValue = {
    searchText: string;
    setSearchText: (value: string) => void;
    filteredWords: string[];
    filterProgress: number;
    handleOpen: () => void;
};

type WordsListProps = {
    filteredWords: string[];
    filterProgress: number;
};

const DICT_FILE = "/usr/share/dict/words";

const LOREM_IPSUM =
    "lorem ipsum dolor sit amet consectetur adipisci elit sed eiusmod tempor incidunt labore et dolore " +
    "magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea " +
    "commodi consequat";

const FILTER_CHUNK_SIZE = 50_000;
const initialWords = loadInitialWords();
const WordsContext = createContext<WordsContextValue | null>(null);

const listviewWordsDemo: Demo = {
    id: "listview-words",
    title: "Lists/Words",
    description:
        "This demo shows filtering a long list - of words.\n\nYou should have the file " +
        "`/usr/share/dict/words` installed for this demo to work.",
    keywords: ["GtkListView", "GtkFilterListModel", "GtkInscription"],
    component: ListViewWordsDemo,
    titlebar: ListViewWordsTitlebar,
    provider: ListViewWordsProvider,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 600,
};

function logError(error: unknown) {
    if (error instanceof Error) {
        console.error(error.message);
    }
}

function splitWords(text: string): string[] {
    return text
        .split("\n")
        .map((word) => word.trim())
        .filter((word) => word.length > 0);
}

function readDictionaryWords(): string[] | null {
    try {
        return splitWords(readFileSync(DICT_FILE, "utf8"));
    } catch (error) {
        logError(error);

        return null;
    }
}

function loadInitialWords(): string[] {
    const words = existsSync(DICT_FILE) ? readDictionaryWords() : null;

    return words ?? LOREM_IPSUM.split(" ");
}

async function loadWordsFromFile(
    filePath: string,
    setWords: (words: string[]) => void,
    setSearchText: (text: string) => void,
) {
    try {
        const text = await readFile(filePath, "utf8");
        setWords(splitWords(text));
        setSearchText("");
    } catch (error) {
        const dialog = new Gtk.AlertDialog();
        dialog.setMessage(`Failure reading words from '${filePath}': ${String(error)}`);
        dialog.show(null);
    }
}

async function openWordsFile(
    window: RefObject<Gtk.Window | null>,
    loadFile: (filePath: string) => Promise<void>,
) {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Open file");

    try {
        const file = await dialog.open(window.current, null);
        const path = file.getPath();

        if (path) {
            await loadFile(path);
        }
    } catch (error) {
        logError(error);
    }
}

function collectMatches(step: FilterStep, end: number) {
    for (let index = step.offset; index < end; index++) {
        const word = step.words[index];

        if (word?.toLowerCase().includes(step.lower)) {
            step.result.push(word);
        }
    }
}

function runFilterStep(step: FilterStep) {
    if (step.ctx.wasCanceled) {
        return;
    }

    const total = step.words.length;
    const end = Math.min(step.offset + FILTER_CHUNK_SIZE, total);
    collectMatches(step, end);
    step.onChunk([...step.result], total > 0 ? end / total : 1);

    if (end < total) {
        setTimeout(() => {
            runFilterStep({ ...step, offset: end });
        }, 0);
    }
}

function selectFilteredWords(words: string[], searchText: string, result: FilterResult | null) {
    if (searchText === "") {
        return { filteredWords: words, filterProgress: 1 };
    }

    if (result === null) {
        return { filteredWords: words, filterProgress: 0 };
    }

    if (result.search !== searchText) {
        return { filteredWords: result.words, filterProgress: 0 };
    }

    return { filteredWords: result.words, filterProgress: result.progress };
}

function useFilteredWords(words: string[], searchText: string) {
    const [result, setResult] = useState<FilterResult | null>(null);
    const filterRef = useRef<FilterState>({ wasCanceled: false });

    useEffect(() => {
        filterRef.current.wasCanceled = true;

        if (searchText === "") {
            return;
        }

        const ctx: FilterState = { wasCanceled: false };
        filterRef.current = ctx;

        setTimeout(() => {
            runFilterStep({
                ctx,
                words,
                lower: searchText.toLowerCase(),
                result: [],
                offset: 0,
                onChunk: (matched, progress) => {
                    setResult({ search: searchText, words: matched, progress });
                },
            });
        }, 0);

        return () => {
            ctx.wasCanceled = true;
        };
    }, [words, searchText]);

    return selectFilteredWords(words, searchText, result);
}

function useWordsContext(): WordsContextValue {
    const ctx = useContext(WordsContext);

    if (!ctx) {
        throw new Error("WordsContext is missing");
    }

    return ctx;
}

function renderWord({ item: word }: { item: string }) {
    return (
        <GtkInscription
            text={word}
            xalign={0}
            natChars={20}
            textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
        />
    );
}

const WordsList = ({ filteredWords, filterProgress }: WordsListProps) => (
    <GtkOverlay
        vexpand
        hexpand
        overlays={
            filterProgress < 1 && (
                <GtkOverlayLayoutChild>
                    <GtkProgressBar
                        fraction={filterProgress}
                        halign={Gtk.Align.FILL}
                        valign={Gtk.Align.START}
                        hexpand
                    />
                </GtkOverlayLayoutChild>
            )
        }
    >
        <GtkScrolledWindow vexpand hexpand>
            <ListView
                name="list-view"
                vexpand
                hexpand
                estimatedItemHeight={32}
                selectionMode={Gtk.SelectionMode.NONE}
                items={filteredWords.map((word) => ({ id: word, value: word }))}
                renderItem={renderWord}
            />
        </GtkScrolledWindow>
    </GtkOverlay>
);

function ListViewWordsProvider({ window, children }: DemoProviderProps) {
    const [words, setWords] = useState(initialWords);
    const [searchText, setSearchText] = useState("");
    const { filteredWords, filterProgress } = useFilteredWords(words, searchText);

    const handleOpen = () => {
        void openWordsFile(window, (filePath) => loadWordsFromFile(filePath, setWords, setSearchText));
    };

    const value = {
        searchText,
        setSearchText,
        filteredWords,
        filterProgress,
        handleOpen,
    };

    return <WordsContext.Provider value={value}>{children}</WordsContext.Provider>;
}

function ListViewWordsTitlebar() {
    const { handleOpen } = useWordsContext();

    return <GtkHeaderBar start={<GtkButton label="_Open" useUnderline onClicked={handleOpen} />} />;
}

function ListViewWordsDemo() {
    const { searchText, setSearchText, filteredWords, filterProgress } = useWordsContext();
    const { setWindowTitle } = useDemo();

    useEffect(() => {
        setWindowTitle(`${String(filteredWords.length)} lines`);

        return () => {
            setWindowTitle(null);
        };
    }, [filteredWords.length, setWindowTitle]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkSearchEntry
                name="search-entry"
                text={searchText}
                placeholderText="Search words..."
                onSearchChanged={(entry: Gtk.SearchEntry) => {
                    setSearchText(entry.getText());
                }}
                hexpand
            />
            <WordsList filteredWords={filteredWords} filterProgress={filterProgress} />
        </GtkBox>
    );
}

export { listviewWordsDemo };
