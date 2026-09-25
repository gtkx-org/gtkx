import { ListItemFactory, type ListItemRenderer } from "@gtkx/components";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkFileDialog,
    GtkFilterListModel,
    GtkHeaderBar,
    GtkInscription,
    GtkListView,
    GtkNoSelection,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkProgressBar,
    GtkScrolledWindow,
    GtkSearchEntry,
    GtkStringFilter,
    GtkStringList,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useProperty } from "@gtkx/react";
import { getClassType } from "@gtkx/runtime";
import { errorMessage } from "@gtkx/utils";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { useDemo } from "../../context/demo-context.js";
import { isCancellation } from "../../is-cancellation.js";
import { useCancellable } from "../../use-cancellable.js";
import sourceCode from "./listview-words.tsx?raw";

type WordsContextValue = {
    words: string[];
    searchText: string;
    setSearchText: (value: string) => void;
    handleOpen: () => void;
    isLoading: boolean;
    loadError: string | null;
    dismissLoadError: () => void;
};

type WordsListProps = {
    words: string[];
    searchText: string;
};

type WordsModelProps = {
    expression: Gtk.PropertyExpression;
    isIncremental: boolean;
    onFiltered: (model: Gtk.FilterListModel | null) => void;
    onSource: (model: Gtk.StringList | null) => void;
    searchText: string;
};

type WordsViewProps = WordsModelProps & {
    filterProgress: number;
    pending: number;
};

const DICT_FILE = "/usr/share/dict/words";

const LOREM_IPSUM =
    "lorem ipsum dolor sit amet consectetur adipisci elit sed eiusmod tempor incidunt labore et dolore " +
    "magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea " +
    "commodi consequat";

const INCREMENTAL_FILTER_MIN_WORDS = 10_000;
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

function splitWords(text: string): string[] {
    return text
        .split("\n")
        .map((word) => word.trim())
        .filter((word) => word.length > 0);
}

async function readWords(file: Gio.File, cancellable: Gio.Cancellable): Promise<string[]> {
    const [contents] = await file.loadContentsAsync(cancellable);

    return splitWords(new TextDecoder().decode(contents));
}

function useInitialWords(onLoaded: (words: string[]) => void, onError: (message: string) => void) {
    const { cancellable, element } = useCancellable();

    useEffect(() => {
        if (cancellable === null) {
            return;
        }

        void readWords(Gio.File.newForPath(DICT_FILE), cancellable).then(onLoaded).catch((error: unknown) => {
            if (isCancellation(error)) {
                return;
            }

            onLoaded(LOREM_IPSUM.split(" "));

            if (!(error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.NOT_FOUND)) {
                onError(errorMessage(error));
            }
        });
    }, [cancellable, onLoaded, onError]);

    return createPortal(element, rootElement);
}

function useWordsFileDialog(
    window: Gtk.Window | null,
    onLoaded: (words: string[]) => void,
    onError: (message: string) => void,
) {
    const [dialog, setDialog] = useState<Gtk.FileDialog | null>(null);
    const [isOpening, setIsOpening] = useState(false);
    const cancellable = useCancellable();
    const handleOpen = async () => {
        if (dialog === null || cancellable.cancellable === null) {
            return;
        }

        setIsOpening(true);

        try {
            const file = await dialog.open(window, cancellable.cancellable);
            onLoaded(await readWords(file, cancellable.cancellable));
        } catch (error) {
            if (!isCancellation(error)) {
                onError(errorMessage(error));
            }
        } finally {
            setIsOpening(false);
            cancellable.renew();
        }
    };

    return {
        isOpening,
        handleOpen: () => void handleOpen(),
        portal: createPortal(
            <>
                <GtkFileDialog ref={setDialog} title="Open file" />
                {cancellable.element}
            </>,
            rootElement,
        ),
    };
}

function useWordsContext(): WordsContextValue {
    const ctx = useContext(WordsContext);

    if (!ctx) {
        throw new Error("WordsContext is missing");
    }

    return ctx;
}

const renderWord: ListItemRenderer<Gtk.StringObject> = ({ item }) => {
    return (
        <GtkInscription
            text={item.getString()}
            xalign={0}
            natChars={20}
            textOverflow={Gtk.InscriptionOverflow.ELLIPSIZE_END}
        />
    );
};

function filterMode(searchText: string, isIncremental: boolean): string {
    if (searchText === "") {
        return "unfiltered";
    }

    return isIncremental ? "incremental" : "synchronous";
}

function WordsModel({ expression, isIncremental, onFiltered, onSource, searchText }: WordsModelProps) {
    const filter = searchText === ""
        ? null
        : (
                <GtkStringFilter
                    expression={expression}
                    ignoreCase
                    matchMode={Gtk.StringFilterMatchMode.SUBSTRING}
                    search={searchText}
                />
            );

    /* TODO: Keep mode-keyed remounts until GTK safely disables incremental filtering without a pending bitset.
     * https://github.com/gtkx-org/gtkx/issues/738
     */
    return (
        <GtkNoSelection
            model={(
                <GtkFilterListModel
                    key={filterMode(searchText, isIncremental)}
                    ref={onFiltered}
                    filter={filter}
                    incremental={isIncremental}
                    model={<GtkStringList ref={onSource} />}
                />
            )}
        />
    );
}

const progressOverlay = (pending: number, fraction: number) =>
    pending > 0 && (
        <GtkOverlayLayoutChild>
            <GtkProgressBar
                accessibleLabel="Filtering words"
                fraction={fraction}
                halign={Gtk.Align.FILL}
                valign={Gtk.Align.START}
                hexpand
            />
        </GtkOverlayLayoutChild>
    );

function WordsView(props: WordsViewProps) {
    const { pending, filterProgress, ...model } = props;

    return (
        <GtkOverlay vexpand hexpand overlays={progressOverlay(pending, filterProgress)}>
            <GtkScrolledWindow vexpand hexpand>
                <GtkListView
                    name="list-view"
                    vexpand
                    hexpand
                    model={<WordsModel {...model} />}
                    factory={(
                        <ListItemFactory<Gtk.StringObject>
                            estimatedItemHeight={32}
                            renderItem={renderWord}
                        />
                    )}
                />
            </GtkScrolledWindow>
        </GtkOverlay>
    );
}

function WordsList({ words, searchText }: WordsListProps) {
    const [source, setSource] = useState<Gtk.StringList | null>(null);
    const [filtered, setFiltered] = useState<Gtk.FilterListModel | null>(null);
    const [expression] = useState(() =>
        Gtk.PropertyExpression.new(getClassType(Gtk.StringObject), null, "string"));
    const pending = useProperty(filtered, "pending") ?? 0;
    const visibleCount = useProperty(filtered, "nItems") ?? 0;
    const filterProgress = words.length === 0 ? 1 : 1 - pending / words.length;
    const isIncremental = searchText !== "" && words.length >= INCREMENTAL_FILTER_MIN_WORDS;
    const { setWindowTitle } = useDemo();

    useEffect(() => {
        if (source === null) {
            return;
        }

        source.splice(0, source.getNItems(), words);
    }, [source, words]);

    useEffect(() => {
        const suffix = visibleCount === 1 ? "line" : "lines";
        setWindowTitle(`${String(visibleCount)} ${suffix}`);

        return () => {
            setWindowTitle(null);
        };
    }, [setWindowTitle, visibleCount]);

    return (
        <WordsView
            expression={expression}
            filterProgress={filterProgress}
            isIncremental={isIncremental}
            onFiltered={setFiltered}
            onSource={setSource}
            pending={pending}
            searchText={searchText}
        />
    );
}

function ListViewWordsProvider({ window, children }: DemoProviderProps) {
    const [words, setWords] = useState<string[] | null>(null);
    const [searchText, setSearchText] = useState("");
    const [loadError, setLoadError] = useState<string | null>(null);
    const initialWords = useInitialWords(setWords, setLoadError);
    const handleLoaded = useCallback((loaded: string[]) => {
        setWords(loaded);
        setSearchText("");
    }, []);
    const { handleOpen, isOpening, portal } = useWordsFileDialog(window, handleLoaded, setLoadError);

    const value = {
        words: words ?? [],
        searchText,
        setSearchText,
        handleOpen,
        isLoading: words === null || isOpening,
        loadError,
        dismissLoadError: () => {
            setLoadError(null);
        },
    };

    return (
        <>
            {initialWords}
            {portal}
            <WordsContext.Provider value={value}>{children}</WordsContext.Provider>
        </>
    );
}

function ListViewWordsTitlebar() {
    const { handleOpen, isLoading } = useWordsContext();

    return (
        <GtkHeaderBar start={<GtkButton label="_Open" useUnderline sensitive={!isLoading} onClicked={handleOpen} />} />
    );
}

function ListViewWordsDemo() {
    const { words, searchText, setSearchText, loadError, dismissLoadError } = useWordsContext();

    return (
        <>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
                <GtkSearchEntry
                    name="search-entry"
                    accessibleLabel="Search words"
                    text={searchText}
                    placeholderText="Search words…"
                    onSearchChanged={(entry: Gtk.SearchEntry) => {
                        setSearchText(entry.getText());
                    }}
                    hexpand
                />
                <WordsList words={words} searchText={searchText} />
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
