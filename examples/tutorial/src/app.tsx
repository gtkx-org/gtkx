import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationSplitView,
    AdwStatusPage,
    AdwToastOverlay,
    AdwToggleGroup,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkGridView,
    GtkListView,
    GtkMenuButton,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkShortcutController,
    quit,
    useSetting,
} from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import schemaId from "../com.gtkx.tutorial.gschema.xml";
import { About } from "./components/about.js";
import { DeleteConfirmation } from "./components/delete-confirmation.js";
import { NoteCard } from "./components/note-card.js";
import { NoteEditor } from "./components/note-editor.js";
import { Preferences } from "./components/preferences.js";
import { Sidebar } from "./components/sidebar.js";
import type { Note } from "./types.js";

const getEmptyStateIcon = (searchQuery: string, category: string): string => {
    if (searchQuery) return "system-search-symbolic";
    if (category === "trash") return "user-trash-symbolic";
    if (category === "favorites") return "starred-symbolic";
    return "document-edit-symbolic";
};

const getEmptyStateTitle = (searchQuery: string, category: string): string => {
    if (searchQuery) return "No Results Found";
    if (category === "trash") return "Trash is Empty";
    if (category === "favorites") return "No Favorites";
    return "No Notes Yet";
};

const getEmptyStateDescription = (searchQuery: string, category: string): string => {
    if (searchQuery) return `No notes match “${searchQuery}”`;
    if (category === "trash") return "Deleted notes will appear here";
    if (category === "favorites") return "Star notes to find them here";
    return "Press + or Ctrl+N to create your first note";
};

const CATEGORY_TITLES: Record<string, string> = {
    all: "All Notes",
    favorites: "Favorites",
    recent: "Recent",
    trash: "Trash",
};

const INITIAL_NOTES: Note[] = [
    { id: "1", title: "Welcome", body: "Your first note!", createdAt: new Date() },
    { id: "2", title: "Shopping List", body: "Milk, eggs, bread", createdAt: new Date() },
    {
        id: "3",
        title: "Meeting Notes",
        body: "Discuss project timeline and deliverables",
        createdAt: new Date(),
    },
];

interface NoteListContentProps {
    viewMode: string;
    compactMode: boolean | undefined;
    fontSize: number | undefined;
    filteredNotes: Note[];
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
}

function NoteListContent({
    viewMode,
    compactMode,
    fontSize,
    filteredNotes,
    selectedId,
    setSelectedId,
}: Readonly<NoteListContentProps>) {
    const items = filteredNotes.map((note) => ({ id: note.id, value: note }));
    const selected = selectedId ? [selectedId] : [];
    const renderItem = (note: Note) => <NoteCard note={note} compact={compactMode} fontSize={fontSize} />;
    const onSelectionChanged = (ids: string[]) => setSelectedId(ids[0] ?? null);

    if (viewMode === "list") {
        return (
            <GtkScrolledWindow vexpand>
                <GtkListView
                    estimatedItemHeight={compactMode ? 50 : 80}
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    selected={selected}
                    onSelectionChanged={onSelectionChanged}
                    items={items}
                    renderItem={renderItem}
                />
            </GtkScrolledWindow>
        );
    }

    return (
        <GtkScrolledWindow vexpand>
            <GtkGridView
                minColumns={2}
                maxColumns={4}
                selectionMode={Gtk.SelectionMode.SINGLE}
                selected={selected}
                onSelectionChanged={onSelectionChanged}
                items={items}
                renderItem={renderItem}
            />
        </GtkScrolledWindow>
    );
}

const useNotesState = (toastOverlayRef: React.RefObject<Adw.ToastOverlay | null>) => {
    const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

    const selectedNote = notes.find((n) => n.id === selectedId);
    const activeNotes = notes.filter((n) => !n.deleted);
    const trashedNotes = notes.filter((n) => n.deleted);
    const favoriteNotes = activeNotes.filter((n) => n.favorite);

    const addNote = useCallback(() => {
        const note: Note = { id: crypto.randomUUID(), title: "Untitled", body: "", createdAt: new Date() };
        setNotes((prev) => [note, ...prev]);
    }, []);

    const updateNote = useCallback((id: string, fields: Partial<Pick<Note, "title" | "body">>) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields } : n)));
    }, []);

    const restoreNote = useCallback((id: string) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deleted: false } : n)));
    }, []);

    const confirmDelete = useCallback(() => {
        if (!noteToDelete) return;
        const deletedNote = noteToDelete;
        if (selectedId === deletedNote.id) setSelectedId(null);
        setNoteToDelete(null);

        if (deletedNote.deleted) {
            setNotes((prev) => prev.filter((n) => n.id !== deletedNote.id));
            toastOverlayRef.current?.addToast(Adw.Toast.new(`“${deletedNote.title}” permanently deleted`));
            return;
        }

        setNotes((prev) => prev.map((n) => (n.id === deletedNote.id ? { ...n, deleted: true } : n)));
        const toast = Adw.Toast.new(`“${deletedNote.title}” moved to Trash`);
        toast.buttonLabel = "Undo";
        toast.connect("button-clicked", () => restoreNote(deletedNote.id));
        toastOverlayRef.current?.addToast(toast);
    }, [noteToDelete, selectedId, restoreNote, toastOverlayRef]);

    return {
        notes,
        selectedId,
        setSelectedId,
        selectedNote,
        activeNotes,
        trashedNotes,
        favoriteNotes,
        noteToDelete,
        setNoteToDelete,
        addNote,
        updateNote,
        confirmDelete,
    };
};

const MainMenu = ({
    onAddNote,
    onPreferences,
    onAbout,
}: {
    onAddNote: () => void;
    onPreferences: () => void;
    onAbout: () => void;
}) => (
    <GtkMenuButton iconName="open-menu-symbolic" tooltipText="Main Menu">
        <GtkMenuButton.MenuItem id="new" label="New Note" onActivate={onAddNote} accels="<Control>n" />
        <GtkMenuButton.MenuSection>
            <GtkMenuButton.MenuItem
                id="preferences"
                label="Preferences"
                onActivate={onPreferences}
                accels="<Control>comma"
            />
            <GtkMenuButton.MenuItem
                id="shortcuts"
                label="Keyboard Shortcuts"
                onActivate={() => {}}
                accels="<Control>question"
            />
        </GtkMenuButton.MenuSection>
        <GtkMenuButton.MenuSection>
            <GtkMenuButton.MenuItem id="about" label="About Notes" onActivate={onAbout} />
        </GtkMenuButton.MenuSection>
    </GtkMenuButton>
);

const ViewModeToggle = ({ viewMode, onChange }: { viewMode: string; onChange: (name: string) => void }) => (
    <AdwToggleGroup
        activeName={viewMode}
        onActiveChanged={(_index, name) => onChange(name ?? "list")}
        toggles={[
            { id: "list", iconName: "view-list-symbolic", tooltip: "List View" },
            { id: "grid", iconName: "view-grid-symbolic", tooltip: "Grid View" },
        ]}
    />
);

interface ContentPageProps {
    selectedNote: Note | undefined;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    category: string;
    viewMode: string;
    setViewMode: (m: string) => void;
    searchMode: boolean;
    setSearchMode: (m: boolean) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    filteredNotes: Note[];
    compactMode: boolean | undefined;
    fontSize: number | undefined;
    addNote: () => void;
    updateNote: (id: string, fields: Partial<Pick<Note, "title" | "body">>) => void;
    deleteSelected: () => void;
    onPreferences: () => void;
    onAbout: () => void;
    toastOverlayRef: React.RefObject<Adw.ToastOverlay | null>;
}

const ContentHeaderBar = ({
    selectedNote,
    selectedId,
    setSelectedId,
    viewMode,
    setViewMode,
    searchMode,
    setSearchMode,
    deleteSelected,
    addNote,
    onPreferences,
    onAbout,
}: Pick<
    ContentPageProps,
    | "selectedNote"
    | "selectedId"
    | "setSelectedId"
    | "viewMode"
    | "setViewMode"
    | "searchMode"
    | "setSearchMode"
    | "deleteSelected"
    | "addNote"
    | "onPreferences"
    | "onAbout"
>) => (
    <AdwHeaderBar
        titleWidget={selectedNote ? undefined : <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />}
    >
        <AdwHeaderBar.PackStart>
            {selectedNote ? (
                <GtkButton
                    iconName="go-previous-symbolic"
                    tooltipText="Back to list"
                    onClicked={() => setSelectedId(null)}
                />
            ) : (
                <GtkButton
                    iconName="system-search-symbolic"
                    tooltipText="Search (Ctrl+F)"
                    onClicked={() => setSearchMode(!searchMode)}
                />
            )}
            <GtkButton
                iconName="user-trash-symbolic"
                tooltipText="Delete Note (Delete)"
                sensitive={!!selectedId}
                onClicked={deleteSelected}
            />
        </AdwHeaderBar.PackStart>
        <AdwHeaderBar.PackEnd>
            <MainMenu onAddNote={addNote} onPreferences={onPreferences} onAbout={onAbout} />
        </AdwHeaderBar.PackEnd>
    </AdwHeaderBar>
);

const ContentBody = ({
    selectedNote,
    setSelectedId,
    searchMode,
    setSearchMode,
    setSearchQuery,
    searchQuery,
    category,
    viewMode,
    compactMode,
    fontSize,
    filteredNotes,
    selectedId,
    updateNote,
    toastOverlayRef,
}: Pick<
    ContentPageProps,
    | "selectedNote"
    | "setSelectedId"
    | "searchMode"
    | "setSearchMode"
    | "setSearchQuery"
    | "searchQuery"
    | "category"
    | "viewMode"
    | "compactMode"
    | "fontSize"
    | "filteredNotes"
    | "selectedId"
    | "updateNote"
    | "toastOverlayRef"
>) => {
    const searchEntryRef = useRef<Gtk.SearchEntry | null>(null);
    return (
        <AdwToastOverlay ref={toastOverlayRef}>
            {selectedNote ? (
                <NoteEditor note={selectedNote} onUpdate={(fields) => updateNote(selectedNote.id, fields)} />
            ) : (
                <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                    <GtkSearchBar
                        searchModeEnabled={searchMode}
                        onSearchModeChanged={setSearchMode}
                        keyCaptureWidget={searchEntryRef.current}
                    >
                        <GtkSearchEntry
                            ref={searchEntryRef}
                            placeholderText="Search notes…"
                            onSearchChanged={(self) => setSearchQuery(self.text ?? "")}
                        />
                    </GtkSearchBar>

                    {filteredNotes.length > 0 ? (
                        <NoteListContent
                            viewMode={viewMode}
                            compactMode={compactMode}
                            fontSize={fontSize}
                            filteredNotes={filteredNotes}
                            selectedId={selectedId}
                            setSelectedId={setSelectedId}
                        />
                    ) : (
                        <AdwStatusPage
                            vexpand
                            iconName={getEmptyStateIcon(searchQuery, category)}
                            title={getEmptyStateTitle(searchQuery, category)}
                            description={getEmptyStateDescription(searchQuery, category)}
                        />
                    )}
                </GtkBox>
            )}
        </AdwToastOverlay>
    );
};

const ContentPage = (props: ContentPageProps) => (
    <AdwNavigationSplitView.Page
        id="content"
        title={props.selectedNote?.title ?? CATEGORY_TITLES[props.category] ?? "Notes"}
    >
        <AdwToolbarView>
            <AdwToolbarView.AddTopBar>
                <ContentHeaderBar {...props} />
            </AdwToolbarView.AddTopBar>
            <ContentBody {...props} />
        </AdwToolbarView>
    </AdwNavigationSplitView.Page>
);

interface SidebarPageProps {
    activeNotes: Note[];
    trashedNotes: Note[];
    favoriteNotes: Note[];
    addNote: () => void;
    setCategory: (id: string) => void;
    setSelectedId: (id: string | null) => void;
}

const SidebarPage = ({
    activeNotes,
    trashedNotes,
    favoriteNotes,
    addNote,
    setCategory,
    setSelectedId,
}: SidebarPageProps) => (
    <AdwNavigationSplitView.Page id="sidebar" title="Notes">
        <AdwToolbarView>
            <AdwToolbarView.AddTopBar>
                <AdwHeaderBar>
                    <AdwHeaderBar.PackStart>
                        <GtkButton iconName="list-add-symbolic" tooltipText="New Note (Ctrl+N)" onClicked={addNote} />
                    </AdwHeaderBar.PackStart>
                </AdwHeaderBar>
            </AdwToolbarView.AddTopBar>
            <Sidebar
                noteCounts={{
                    all: activeNotes.length,
                    favorites: favoriteNotes.length,
                    recent: activeNotes.length,
                    trash: trashedNotes.length,
                }}
                onCategoryChanged={(id) => {
                    setCategory(id);
                    setSelectedId(null);
                }}
            />
        </AdwToolbarView>
    </AdwNavigationSplitView.Page>
);

const filterNotes = (notes: Note[], searchQuery: string): Note[] => {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
};

interface FilteredNotesArgs {
    category: string;
    searchQuery: string;
    activeNotes: Note[];
    trashedNotes: Note[];
    favoriteNotes: Note[];
}

const useFilteredNotes = ({
    category,
    searchQuery,
    activeNotes,
    trashedNotes,
    favoriteNotes,
}: FilteredNotesArgs): Note[] => {
    const categoryNotes = category === "trash" ? trashedNotes : category === "favorites" ? favoriteNotes : activeNotes;
    return filterNotes(categoryNotes, searchQuery);
};

interface AppShortcutsProps {
    selectedId: string | null;
    addNote: () => void;
    deleteSelected: () => void;
    setSearchMode: (m: boolean) => void;
    setSelectedId: (id: string | null) => void;
}

const AppShortcuts = ({ selectedId, addNote, deleteSelected, setSearchMode, setSelectedId }: AppShortcutsProps) => (
    <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
        <GtkShortcutController.Shortcut trigger="<Control>n" onActivate={addNote} />
        <GtkShortcutController.Shortcut trigger="Delete" onActivate={deleteSelected} disabled={!selectedId} />
        <GtkShortcutController.Shortcut trigger="<Control>f" onActivate={() => setSearchMode(true)} />
        <GtkShortcutController.Shortcut
            trigger="Escape"
            onActivate={() => setSelectedId(null)}
            disabled={!selectedId}
        />
    </GtkShortcutController>
);

interface AppModalsProps {
    noteToDelete: Note | null;
    setNoteToDelete: (n: Note | null) => void;
    confirmDelete: () => void;
    showPreferences: boolean;
    setShowPreferences: (s: boolean) => void;
    showAbout: boolean;
    setShowAbout: (s: boolean) => void;
}

const AppModals = ({
    noteToDelete,
    setNoteToDelete,
    confirmDelete,
    showPreferences,
    setShowPreferences,
    showAbout,
    setShowAbout,
}: AppModalsProps) => (
    <>
        {noteToDelete && (
            <DeleteConfirmation
                noteTitle={noteToDelete.title}
                onConfirm={confirmDelete}
                onCancel={() => setNoteToDelete(null)}
            />
        )}
        {showPreferences && <Preferences onClose={() => setShowPreferences(false)} />}
        {showAbout && <About onClose={() => setShowAbout(false)} />}
    </>
);

interface AppViewState {
    category: string;
    setCategory: (c: string) => void;
    viewMode: string;
    setViewMode: (m: string) => void;
    searchMode: boolean;
    setSearchMode: (m: boolean) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

const useAppViewState = (): AppViewState => {
    const [category, setCategory] = useState<string>("all");
    const [viewMode, setViewMode] = useState("list");
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    return { category, setCategory, viewMode, setViewMode, searchMode, setSearchMode, searchQuery, setSearchQuery };
};

const useDialogState = () => {
    const [showPreferences, setShowPreferences] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    return { showPreferences, setShowPreferences, showAbout, setShowAbout };
};

interface AppBodyProps {
    notes: ReturnType<typeof useNotesState>;
    view: AppViewState;
    dialogs: ReturnType<typeof useDialogState>;
    filteredNotes: Note[];
    compactMode: boolean | undefined;
    fontSize: number | undefined;
    deleteSelected: () => void;
    toastOverlayRef: React.RefObject<Adw.ToastOverlay | null>;
}

const AppBody = ({
    notes,
    view,
    dialogs,
    filteredNotes,
    compactMode,
    fontSize,
    deleteSelected,
    toastOverlayRef,
}: AppBodyProps) => (
    <AdwNavigationSplitView sidebarWidthFraction={0.25} minSidebarWidth={200} maxSidebarWidth={300}>
        <SidebarPage
            activeNotes={notes.activeNotes}
            trashedNotes={notes.trashedNotes}
            favoriteNotes={notes.favoriteNotes}
            addNote={notes.addNote}
            setCategory={view.setCategory}
            setSelectedId={notes.setSelectedId}
        />
        <ContentPage
            selectedNote={notes.selectedNote}
            selectedId={notes.selectedId}
            setSelectedId={notes.setSelectedId}
            category={view.category}
            viewMode={view.viewMode}
            setViewMode={view.setViewMode}
            searchMode={view.searchMode}
            setSearchMode={view.setSearchMode}
            searchQuery={view.searchQuery}
            setSearchQuery={view.setSearchQuery}
            filteredNotes={filteredNotes}
            compactMode={compactMode}
            fontSize={fontSize}
            addNote={notes.addNote}
            updateNote={notes.updateNote}
            deleteSelected={deleteSelected}
            onPreferences={() => dialogs.setShowPreferences(true)}
            onAbout={() => dialogs.setShowAbout(true)}
            toastOverlayRef={toastOverlayRef}
        />
    </AdwNavigationSplitView>
);

export function App() {
    const [compactMode] = useSetting(schemaId, "compact-mode", "boolean");
    const [fontSize] = useSetting(schemaId, "font-size", "int");
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);
    const view = useAppViewState();
    const dialogs = useDialogState();
    const notes = useNotesState(toastOverlayRef);
    const filteredNotes = useFilteredNotes({
        category: view.category,
        searchQuery: view.searchQuery,
        activeNotes: notes.activeNotes,
        trashedNotes: notes.trashedNotes,
        favoriteNotes: notes.favoriteNotes,
    });
    const deleteSelected = () => {
        if (notes.selectedNote) notes.setNoteToDelete(notes.selectedNote);
    };

    return (
        <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={quit}>
            <AppShortcuts
                selectedId={notes.selectedId}
                addNote={notes.addNote}
                deleteSelected={deleteSelected}
                setSearchMode={view.setSearchMode}
                setSelectedId={notes.setSelectedId}
            />
            <AppBody
                notes={notes}
                view={view}
                dialogs={dialogs}
                filteredNotes={filteredNotes}
                compactMode={compactMode}
                fontSize={fontSize}
                deleteSelected={deleteSelected}
                toastOverlayRef={toastOverlayRef}
            />
            <AppModals
                noteToDelete={notes.noteToDelete}
                setNoteToDelete={notes.setNoteToDelete}
                confirmDelete={notes.confirmDelete}
                showPreferences={dialogs.showPreferences}
                setShowPreferences={dialogs.setShowPreferences}
                showAbout={dialogs.showAbout}
                setShowAbout={dialogs.setShowAbout}
            />
        </AdwApplicationWindow>
    );
}
