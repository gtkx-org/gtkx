import type { ListItem } from "@gtkx/components";
import { ListView } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkFileDialog,
    GtkHeaderBar,
    GtkInscription,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkProgressBar,
    GtkScrolledWindow,
    GtkSearchEntry,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { useDemo } from "../../context/demo-context.js";
import { isCancellation } from "../../is-cancellation.js";
import { useCancellable } from "../../use-cancellable.js";
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
    loadError: string | null;
    dismissLoadError: () => void;
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
        "Filter a large word list while GTKX reports progress. The demo loads `/usr/share/dict/words` when " +
        "available and uses a small built-in list otherwise.",
    keywords: ["GtkListView", "GtkFilterListModel", "GtkInscription"],
    component: ListViewWordsDemo,
    titlebar: ListViewWordsTitlebar,
    provider: ListViewWordsProvider,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 600,
};

function logError(error: unknown) {
    if (!isCancellation(error) && error instanceof Error) {
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
    reportError: (message: string) => void,
) {
    try {
        const text = await readFile(filePath, "utf8");
        setWords(splitWords(text));
        setSearchText("");
    } catch (error) {
        reportError(`Failure reading words from '${filePath}': ${String(error)}`);
    }
}

async function openWordsFile(
    dialog: Gtk.FileDialog,
    window: Gtk.Window | null,
    cancellable: Gio.Cancellable,
    loadFile: (filePath: string) => Promise<void>,
) {
    try {
        const file = await dialog.open(window, cancellable);
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
    const [fileDialog, setFileDialog] = useState<Gtk.FileDialog | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const cancellable = useCancellable();
    const scan = useMemo(() => scanWords(words), [words]);
    const { filteredItems, filterProgress } = useFilteredWords(scan, searchText);

    const handleOpen = () => {
        if (fileDialog !== null && cancellable.cancellable !== null) {
            void openWordsFile(fileDialog, window, cancellable.cancellable, (filePath) =>
                loadWordsFromFile(filePath, setWords, setSearchText, setLoadError)).finally(cancellable.renew);
        }
    };

    const value = {
        searchText,
        setSearchText,
        filteredItems,
        filterProgress,
        handleOpen,
        loadError,
        dismissLoadError: () => {
            setLoadError(null);
        },
    };

    return (
        <>
            {createPortal(
                <>
                    <GtkFileDialog ref={setFileDialog} title="Open file" />
                    {cancellable.element}
                </>,
                rootElement,
            )}
            <WordsContext.Provider value={value}>{children}</WordsContext.Provider>
        </>
    );
}

function ListViewWordsTitlebar() {
    const { handleOpen } = useWordsContext();

    return <GtkHeaderBar start={<GtkButton label="_Open" useUnderline onClicked={handleOpen} />} />;
}

function ListViewWordsDemo() {
    const { searchText, setSearchText, filteredItems, filterProgress, loadError, dismissLoadError } = useWordsContext();
    const { setWindowTitle } = useDemo();

    useEffect(() => {
        setWindowTitle(`${String(filteredItems.length)} lines`);

        return () => {
            setWindowTitle(null);
        };
    }, [filteredItems.length, setWindowTitle]);

    return (
        <>
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
            {loadError !== null && (
                <AdwAlertDialog
                    heading="Could not load words"
                    body={loadError}
                    responses={[{ id: "ok", label: "_OK" }]}
                    defaultResponse="ok"
                    closeResponse="ok"
                    onClosed={dismissLoadError}
                />
            )}
        </>
    );
}

export { listviewWordsDemo };
