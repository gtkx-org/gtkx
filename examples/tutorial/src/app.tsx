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

export function App() {
    const [compactMode] = useSetting(schemaId, "compact-mode", "boolean");
    const [fontSize] = useSetting(schemaId, "font-size", "int");

    const [notes, setNotes] = useState<Note[]>([
        { id: "1", title: "Welcome", body: "Your first note!", createdAt: new Date() },
        { id: "2", title: "Shopping List", body: "Milk, eggs, bread", createdAt: new Date() },
        {
            id: "3",
            title: "Meeting Notes",
            body: "Discuss project timeline and deliverables",
            createdAt: new Date(),
        },
    ]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [category, setCategory] = useState<string>("all");
    const [viewMode, setViewMode] = useState("list");
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [showPreferences, setShowPreferences] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

    const selectedNote = notes.find((n) => n.id === selectedId);

    const activeNotes = notes.filter((n) => !n.deleted);
    const trashedNotes = notes.filter((n) => n.deleted);
    const favoriteNotes = activeNotes.filter((n) => n.favorite);

    const getCategoryNotes = () => {
        if (category === "trash") return trashedNotes;
        if (category === "favorites") return favoriteNotes;
        return activeNotes;
    };
    const categoryNotes = getCategoryNotes();

    const filteredNotes = searchQuery
        ? categoryNotes.filter(
              (n) =>
                  n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  n.body.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : categoryNotes;

    const addNote = () => {
        const note: Note = {
            id: crypto.randomUUID(),
            title: "Untitled",
            body: "",
            createdAt: new Date(),
        };
        setNotes([note, ...notes]);
    };

    const updateNote = useCallback((id: string, fields: Partial<Pick<Note, "title" | "body">>) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...fields } : n)));
    }, []);

    const categoryTitles: Record<string, string> = {
        all: "All Notes",
        favorites: "Favorites",
        recent: "Recent",
        trash: "Trash",
    };

    const deleteSelected = () => {
        if (selectedNote) setNoteToDelete(selectedNote);
    };

    const restoreNote = useCallback((id: string) => {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deleted: false } : n)));
    }, []);

    const confirmDelete = useCallback(() => {
        if (!noteToDelete) return;

        const deletedNote = noteToDelete;
        if (selectedId === deletedNote.id) setSelectedId(null);
        setNoteToDelete(null);

        if (deletedNote.deleted) {
            setNotes(notes.filter((n) => n.id !== deletedNote.id));

            const toast = new Adw.Toast(`\u201c${deletedNote.title}\u201d permanently deleted`);
            toastOverlayRef.current?.addToast(toast);
        } else {
            setNotes(notes.map((n) => (n.id === deletedNote.id ? { ...n, deleted: true } : n)));

            const toast = new Adw.Toast(`\u201c${deletedNote.title}\u201d moved to Trash`);
            toast.buttonLabel = "Undo";
            toast.connect("button-clicked", () => restoreNote(deletedNote.id));
            toastOverlayRef.current?.addToast(toast);
        }
    }, [noteToDelete, notes, selectedId, restoreNote]);

    const searchEntryRef = useRef<Gtk.SearchEntry | null>(null);

    return (
        <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={quit}>
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

            <AdwNavigationSplitView sidebarWidthFraction={0.25} minSidebarWidth={200} maxSidebarWidth={300}>
                <AdwNavigationSplitView.Page id="sidebar" title="Notes">
                    <AdwToolbarView>
                        <AdwToolbarView.AddTopBar>
                            <AdwHeaderBar>
                                <AdwHeaderBar.PackStart>
                                    <GtkButton
                                        iconName="list-add-symbolic"
                                        tooltipText="New Note (Ctrl+N)"
                                        onClicked={addNote}
                                    />
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

                <AdwNavigationSplitView.Page
                    id="content"
                    title={selectedNote?.title ?? categoryTitles[category] ?? "Notes"}
                >
                    <AdwToolbarView>
                        <AdwToolbarView.AddTopBar>
                            <AdwHeaderBar
                                titleWidget={
                                    selectedNote ? undefined : (
                                        <AdwToggleGroup
                                            activeName={viewMode}
                                            onActiveChanged={(_index, name) => setViewMode(name ?? "list")}
                                            toggles={[
                                                {
                                                    id: "list",
                                                    iconName: "view-list-symbolic",
                                                    tooltip: "List View",
                                                },
                                                {
                                                    id: "grid",
                                                    iconName: "view-grid-symbolic",
                                                    tooltip: "Grid View",
                                                },
                                            ]}
                                        />
                                    )
                                }
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
                                    <GtkMenuButton iconName="open-menu-symbolic" tooltipText="Main Menu">
                                        <GtkMenuButton.MenuItem
                                            id="new"
                                            label="New Note"
                                            onActivate={addNote}
                                            accels="<Control>n"
                                        />
                                        <GtkMenuButton.MenuSection>
                                            <GtkMenuButton.MenuItem
                                                id="preferences"
                                                label="Preferences"
                                                onActivate={() => setShowPreferences(true)}
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
                                            <GtkMenuButton.MenuItem
                                                id="about"
                                                label="About Notes"
                                                onActivate={() => setShowAbout(true)}
                                            />
                                        </GtkMenuButton.MenuSection>
                                    </GtkMenuButton>
                                </AdwHeaderBar.PackEnd>
                            </AdwHeaderBar>
                        </AdwToolbarView.AddTopBar>

                        <AdwToastOverlay ref={toastOverlayRef}>
                            {selectedNote ? (
                                <NoteEditor
                                    note={selectedNote}
                                    onUpdate={(fields) => updateNote(selectedNote.id, fields)}
                                />
                            ) : (
                                <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                                    <GtkSearchBar
                                        searchModeEnabled={searchMode}
                                        onSearchModeChanged={setSearchMode}
                                        keyCaptureWidget={searchEntryRef.current}
                                    >
                                        <GtkSearchEntry
                                            ref={searchEntryRef}
                                            placeholderText="Search notes\u2026"
                                            onSearchChanged={(self) => setSearchQuery(self.text ?? "")}
                                        />
                                    </GtkSearchBar>

                                    {filteredNotes.length > 0 ? (
                                        viewMode === "list" ? (
                                            <GtkScrolledWindow vexpand>
                                                <GtkListView
                                                    estimatedItemHeight={compactMode ? 50 : 80}
                                                    selectionMode={Gtk.SelectionMode.SINGLE}
                                                    selected={selectedId ? [selectedId] : []}
                                                    onSelectionChanged={(ids) => setSelectedId(ids[0] ?? null)}
                                                    items={filteredNotes.map((note) => ({
                                                        id: note.id,
                                                        value: note,
                                                    }))}
                                                    renderItem={(note) => (
                                                        <NoteCard
                                                            note={note}
                                                            compact={compactMode}
                                                            fontSize={fontSize}
                                                        />
                                                    )}
                                                />
                                            </GtkScrolledWindow>
                                        ) : (
                                            <GtkScrolledWindow vexpand>
                                                <GtkGridView
                                                    minColumns={2}
                                                    maxColumns={4}
                                                    selectionMode={Gtk.SelectionMode.SINGLE}
                                                    selected={selectedId ? [selectedId] : []}
                                                    onSelectionChanged={(ids) => setSelectedId(ids[0] ?? null)}
                                                    items={filteredNotes.map((note) => ({
                                                        id: note.id,
                                                        value: note,
                                                    }))}
                                                    renderItem={(note) => (
                                                        <NoteCard
                                                            note={note}
                                                            compact={compactMode}
                                                            fontSize={fontSize}
                                                        />
                                                    )}
                                                />
                                            </GtkScrolledWindow>
                                        )
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
                    </AdwToolbarView>
                </AdwNavigationSplitView.Page>
            </AdwNavigationSplitView>

            {noteToDelete && (
                <DeleteConfirmation
                    noteTitle={noteToDelete.title}
                    onConfirm={confirmDelete}
                    onCancel={() => setNoteToDelete(null)}
                />
            )}

            {showPreferences && <Preferences onClose={() => setShowPreferences(false)} />}
            {showAbout && <About onClose={() => setShowAbout(false)} />}
        </AdwApplicationWindow>
    );
}
