import type { ListItem } from "@gtkx/components";
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
import { createContext, type RefObject, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { useDemo } from "../../context/demo-context.js";
import sourceCode from "./listview-words.tsx?raw";

type FilterState = {
    wasCanceled: boolean;
};

type WordScan = {
    items: ListItem<string>[];
    lower: string[];
};

type FilterStep = {
    ctx: FilterState;
    scan: WordScan;
    needle: string;
    matched: WordScan;
    offset: number;
    onChunk: (matched: WordScan, progress: number) => void;
};

type FilterResult = {
    words: WordScan;
    search: string;
    scan: WordScan;
    progress: number;
};

type WordsContextValue = {
    searchText: string;
    setSearchText: (value: string) => void;
    filteredItems: ListItem<string>[];
    filterProgress: number;
    handleOpen: () => void;
};

type WordsListProps = {
    filteredItems: ListItem<string>[];
    filterProgress: number;
};

const DICT_FILE = "/usr/share/dict/words";

const LOREM_IPSUM =
    "lorem ipsum dolor sit amet consectetur adipisci elit sed eiusmod tempor incidunt labore et dolore " +
    "magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea " +
    "commodi consequat";

const FILTER_CHUNK_SIZE = 50_000;
const NO_MATCHES: ListItem<string>[] = [];
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

function scanWords(words: string[]): WordScan {
    const scan: WordScan = { items: [], lower: [] };

    for (const word of words) {
        scan.items.push({ id: word, value: word });
        scan.lower.push(word.toLowerCase());
    }

    return scan;
}

function collectMatches(step: FilterStep, end: number) {
    for (let index = step.offset; index < end; index++) {
        const item = step.scan.items[index];
        const lower = step.scan.lower[index];

        if (item !== undefined && lower?.includes(step.needle)) {
            step.matched.items.push(item);
            step.matched.lower.push(lower);
        }
    }
}

function runFilterStep(step: FilterStep) {
    if (step.ctx.wasCanceled) {
        return;
    }

    const total = step.scan.items.length;
    const end = Math.min(step.offset + FILTER_CHUNK_SIZE, total);
    collectMatches(step, end);
    step.onChunk({ items: [...step.matched.items], lower: [...step.matched.lower] }, total > 0 ? end / total : 1);

    if (end < total) {
        setTimeout(() => {
            runFilterStep({ ...step, offset: end });
        }, 0);
    }
}

function canNarrow(previous: FilterResult | null, words: WordScan, searchText: string): previous is FilterResult {
    return previous?.words === words && previous.progress === 1 && searchText.startsWith(previous.search);
}

function selectFilteredWords(words: WordScan, searchText: string, result: FilterResult | null) {
    if (searchText === "") {
        return { filteredItems: words.items, filterProgress: 1 };
    }

    if (result?.words !== words || result.search !== searchText) {
        return { filteredItems: NO_MATCHES, filterProgress: 0 };
    }

    return { filteredItems: result.scan.items, filterProgress: result.progress };
}

function startFilter(step: Omit<FilterStep, "matched" | "offset">) {
    setTimeout(() => {
        runFilterStep({ ...step, matched: { items: [], lower: [] }, offset: 0 });
    }, 0);
}

function useFilteredWords(words: WordScan, searchText: string) {
    const [result, setResult] = useState<FilterResult | null>(null);
    const filterRef = useRef<FilterState>({ wasCanceled: false });
    const lastRef = useRef<FilterResult | null>(null);

    useEffect(() => {
        filterRef.current.wasCanceled = true;
        lastRef.current = canNarrow(lastRef.current, words, searchText) ? lastRef.current : null;

        if (searchText === "") {
            return;
        }

        const ctx: FilterState = { wasCanceled: false };
        filterRef.current = ctx;

        startFilter({
            ctx,
            scan: lastRef.current?.scan ?? words,
            needle: searchText.toLowerCase(),
            onChunk: (matched, progress) => {
                const next: FilterResult = { words, search: searchText, scan: matched, progress };
                lastRef.current = next;
                setResult(next);
            },
        });

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

const WordsList = ({ filteredItems, filterProgress }: WordsListProps) => (
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
                items={filteredItems}
                renderItem={renderWord}
            />
        </GtkScrolledWindow>
    </GtkOverlay>
);

function ListViewWordsProvider({ window, children }: DemoProviderProps) {
    const [words, setWords] = useState(initialWords);
    const [searchText, setSearchText] = useState("");
    const scan = useMemo(() => scanWords(words), [words]);
    const { filteredItems, filterProgress } = useFilteredWords(scan, searchText);

    const handleOpen = () => {
        void openWordsFile(window, (filePath) => loadWordsFromFile(filePath, setWords, setSearchText));
    };

    const value = {
        searchText,
        setSearchText,
        filteredItems,
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
    const { searchText, setSearchText, filteredItems, filterProgress } = useWordsContext();
    const { setWindowTitle } = useDemo();

    useEffect(() => {
        setWindowTitle(`${String(filteredItems.length)} lines`);

        return () => {
            setWindowTitle(null);
        };
    }, [filteredItems.length, setWindowTitle]);

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
            <WordsList filteredItems={filteredItems} filterProgress={filterProgress} />
        </GtkBox>
    );
}

export { listviewWordsDemo };
