import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwStatusPage,
    AdwToastOverlay,
    AdwToggle,
    AdwToggleGroup,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GMenu, GMenuItem, GSimpleAction } from "@gtkx/jsx/gio";
import {
    GtkBox,
    GtkButton,
    GtkMenuButton,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkSearchEntry,
    GtkShortcut,
    GtkShortcutController,
} from "@gtkx/jsx/gtk";
import { GtkGridView, GtkListView, quit, useApplication, useSetting } from "@gtkx/react";
import { useRef, useState } from "react";
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

    const addNote = () => {
        const note: Note = { id: crypto.randomUUID(), title: "Untitled", body: "", createdAt: new Date() };
        setNotes((prev) => [note, ...prev]);
    };

    const updateNote = (id: string, fields: Partial<Pick<Note, "title" | "body">>) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields } : n)));
    };

    const restoreNote = (id: string) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deleted: false } : n)));
    };

    const confirmDelete = () => {
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
        toast.once("button-clicked", () => restoreNote(deletedNote.id));
        toastOverlayRef.current?.addToast(toast);
    };

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

const showShortcutsDialog = (window: Gtk.Window): void => {
    const dialog = new Adw.ShortcutsDialog();

    const general = Adw.ShortcutsSection.new("General");
    general.add(Adw.ShortcutsItem.new("New note", "<Control>n"));
    general.add(Adw.ShortcutsItem.new("Search notes", "<Control>f"));
    general.add(Adw.ShortcutsItem.new("Preferences", "<Control>comma"));
    general.add(Adw.ShortcutsItem.new("Keyboard shortcuts", "<Control>question"));
    dialog.add(general);

    const editing = Adw.ShortcutsSection.new("Editing");
    editing.add(Adw.ShortcutsItem.new("Delete note", "Delete"));
    editing.add(Adw.ShortcutsItem.new("Close note", "Escape"));
    dialog.add(editing);

    dialog.present(window);
};

const MainMenu = () => (
    <GtkMenuButton
        iconName="open-menu-symbolic"
        tooltipText="Main Menu"
        menuModel={
            <GMenu>
                <GMenuItem label="New Note" action="win.new" />
                <GMenuItem section>
                    <GMenu>
                        <GMenuItem label="Preferences" action="win.preferences" />
                        <GMenuItem label="Keyboard Shortcuts" action="win.shortcuts" />
                    </GMenu>
                </GMenuItem>
                <GMenuItem section>
                    <GMenu>
                        <GMenuItem label="About Notes" action="win.about" />
                    </GMenu>
                </GMenuItem>
            </GMenu>
        }
    />
);

const ViewModeToggle = ({ viewMode, onChange }: { viewMode: string; onChange: (name: string) => void }) => (
    <AdwToggleGroup activeName={viewMode} onNotifyActiveName={(name) => onChange(name ?? "list")}>
        <AdwToggle name="list" iconName="view-list-symbolic" tooltip="List View" />
        <AdwToggle name="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
    </AdwToggleGroup>
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
    updateNote: (id: string, fields: Partial<Pick<Note, "title" | "body">>) => void;
    deleteSelected: () => void;
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
>) => (
    <AdwHeaderBar
        titleWidget={selectedNote ? undefined : <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />}
        packStart={
            <>
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
            </>
        }
        packEnd={<MainMenu />}
    />
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
                        onNotifySearchModeEnabled={(enabled) => setSearchMode(enabled ?? false)}
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
    <AdwNavigationPage title={props.selectedNote?.title ?? CATEGORY_TITLES[props.category] ?? "Notes"}>
        <AdwToolbarView addTopBar={<ContentHeaderBar {...props} />}>
            <ContentBody {...props} />
        </AdwToolbarView>
    </AdwNavigationPage>
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
    <AdwNavigationPage title="Notes">
        <AdwToolbarView
            addTopBar={
                <AdwHeaderBar
                    packStart={
                        <GtkButton iconName="list-add-symbolic" tooltipText="New Note (Ctrl+N)" onClicked={addNote} />
                    }
                />
            }
        >
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
    </AdwNavigationPage>
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

const shortcut = (accelerator: string, run: () => void, enabled = true) => (
    <GtkShortcut
        trigger={enabled ? Gtk.ShortcutTrigger.parseString(accelerator) : Gtk.NeverTrigger.get()}
        action={Gtk.CallbackAction.new(() => {
            run();
            return true;
        })}
    />
);

const AppShortcuts = ({ selectedId, addNote, deleteSelected, setSearchMode, setSelectedId }: AppShortcutsProps) => (
    <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
        {shortcut("<Control>n", addNote)}
        {shortcut("Delete", deleteSelected, Boolean(selectedId))}
        {shortcut("<Control>f", () => setSearchMode(true))}
        {shortcut("Escape", () => setSelectedId(null), Boolean(selectedId))}
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
    filteredNotes: Note[];
    compactMode: boolean | undefined;
    fontSize: number | undefined;
    deleteSelected: () => void;
    toastOverlayRef: React.RefObject<Adw.ToastOverlay | null>;
}

const AppBody = ({
    notes,
    view,
    filteredNotes,
    compactMode,
    fontSize,
    deleteSelected,
    toastOverlayRef,
}: AppBodyProps) => (
    <AdwNavigationSplitView
        sidebarWidthFraction={0.25}
        minSidebarWidth={200}
        maxSidebarWidth={300}
        sidebar={
            <SidebarPage
                activeNotes={notes.activeNotes}
                trashedNotes={notes.trashedNotes}
                favoriteNotes={notes.favoriteNotes}
                addNote={notes.addNote}
                setCategory={view.setCategory}
                setSelectedId={notes.setSelectedId}
            />
        }
        content={
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
                updateNote={notes.updateNote}
                deleteSelected={deleteSelected}
                toastOverlayRef={toastOverlayRef}
            />
        }
    />
);

function NotesWindow() {
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
    const app = useApplication();
    const onShortcuts = () => {
        const window = app.getActiveWindow();
        if (window) showShortcutsDialog(window);
    };

    return (
        <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={quit}>
            <GSimpleAction name="new" onActivate={notes.addNote} accels="<Control>n" />
            <GSimpleAction
                name="preferences"
                onActivate={() => dialogs.setShowPreferences(true)}
                accels="<Control>comma"
            />
            <GSimpleAction name="shortcuts" onActivate={onShortcuts} accels="<Control>question" />
            <GSimpleAction name="about" onActivate={() => dialogs.setShowAbout(true)} />
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

export function App() {
    return (
        <AdwApplication>
            <NotesWindow />
        </AdwApplication>
    );
}
