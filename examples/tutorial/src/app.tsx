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
import { Preferences } from "./components/preferences.js";
import { Sidebar } from "./components/sidebar.js";
import type { Note } from "./types.js";

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

    const filteredNotes = searchQuery
        ? notes.filter(
              (n) =>
                  n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  n.body.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : notes;

    const addNote = () => {
        const note: Note = {
            id: crypto.randomUUID(),
            title: "Untitled",
            body: "",
            createdAt: new Date(),
        };
        setNotes([note, ...notes]);
    };

    const categoryTitles: Record<string, string> = {
        all: "All Notes",
        favorites: "Favorites",
        recent: "Recent",
        trash: "Trash",
    };

    const deleteSelected = () => {
        if (selectedNote) setNoteToDelete(selectedNote);
    };

    const confirmDelete = useCallback(() => {
        if (!noteToDelete) return;

        const deletedNote = noteToDelete;
        const deletedIndex = notes.indexOf(deletedNote);
        setNotes(notes.filter((n) => n.id !== deletedNote.id));
        if (selectedId === deletedNote.id) setSelectedId(null);
        setNoteToDelete(null);

        const toast = new Adw.Toast(`\u201c${deletedNote.title}\u201d deleted`);
        toast.buttonLabel = "Undo";
        toast.connect("button-clicked", () => {
            setNotes((prev) => {
                const restored = [...prev];
                restored.splice(deletedIndex, 0, deletedNote);
                return restored;
            });
        });
        toastOverlayRef.current?.addToast(toast);
    }, [noteToDelete, notes, selectedId]);

    const searchEntryRef = useRef<Gtk.SearchEntry | null>(null);

    return (
        <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={quit}>
            <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                <GtkShortcutController.Shortcut trigger="<Control>n" onActivate={addNote} />
                <GtkShortcutController.Shortcut trigger="Delete" onActivate={deleteSelected} disabled={!selectedId} />
                <GtkShortcutController.Shortcut trigger="<Control>f" onActivate={() => setSearchMode(true)} />
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
                                all: notes.length,
                                favorites: 0,
                                recent: notes.length,
                                trash: 0,
                            }}
                            onCategoryChanged={setCategory}
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
                                }
                            >
                                <AdwHeaderBar.PackStart>
                                    <GtkButton
                                        iconName="system-search-symbolic"
                                        tooltipText="Search (Ctrl+F)"
                                        onClicked={() => setSearchMode(!searchMode)}
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
                                                    <NoteCard note={note} compact={compactMode} fontSize={fontSize} />
                                                )}
                                            />
                                        </GtkScrolledWindow>
                                    ) : (
                                        <GtkScrolledWindow vexpand>
                                            <GtkBox
                                                orientation={Gtk.Orientation.VERTICAL}
                                                spacing={8}
                                                marginTop={12}
                                                marginBottom={12}
                                                marginStart={12}
                                                marginEnd={12}
                                            >
                                                {filteredNotes.map((note) => (
                                                    <NoteCard
                                                        key={note.id}
                                                        note={note}
                                                        compact={compactMode}
                                                        fontSize={fontSize}
                                                    />
                                                ))}
                                            </GtkBox>
                                        </GtkScrolledWindow>
                                    )
                                ) : (
                                    <AdwStatusPage
                                        vexpand
                                        iconName={searchQuery ? "system-search-symbolic" : "document-edit-symbolic"}
                                        title={searchQuery ? "No Results Found" : "No Notes Yet"}
                                        description={
                                            searchQuery
                                                ? `No notes match \u201c${searchQuery}\u201d`
                                                : "Press + or Ctrl+N to create your first note"
                                        }
                                    />
                                )}
                            </GtkBox>
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

export default App;
