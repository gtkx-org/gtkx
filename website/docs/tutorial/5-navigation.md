# 5. Navigation & split views

A notes app benefits from a sidebar for organizing notes into categories. Adwaita provides `AdwNavigationSplitView` for responsive sidebar/content layouts and `AdwViewStack` for tabbed views.

![Notes app after this chapter](./images/5-navigation.png)

The `NotesWindow` component below still lives inside the `<AdwApplication>` wrapper from [Chapter 1](./1-window-and-header-bar.md).

## Split view layout

`AdwNavigationSplitView` creates a two-pane layout with a sidebar and content area. Each pane is an `AdwNavigationPage`, passed through the `sidebar` and `content` slot props:

```tsx
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToolbarView,
    GtkLabel,
    quit,
} from "@gtkx/react";

function NotesWindow() {
    return (
        <AdwApplicationWindow title="Notes" defaultWidth={800} defaultHeight={600} onClose={quit}>
            <AdwNavigationSplitView
                sidebarWidthFraction={0.3}
                minSidebarWidth={200}
                maxSidebarWidth={350}
                sidebar={
                    <AdwNavigationPage title="Notes">
                        <AdwToolbarView addTopBar={<AdwHeaderBar />}>
                            <GtkLabel label="Sidebar content" />
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
                content={
                    <AdwNavigationPage title="Editor">
                        <AdwToolbarView addTopBar={<AdwHeaderBar />}>
                            <GtkLabel label="Content area" />
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
            />
        </AdwApplicationWindow>
    );
}

export function App() {
    return (
        <AdwApplication applicationId="com.example.notes">
            <NotesWindow />
        </AdwApplication>
    );
}
```

The split view automatically collapses to a single pane on narrow windows, with back-navigation to return to the sidebar.

## Building the sidebar

Add category navigation using `GtkListBox` with Adwaita action rows:

```tsx
import {
    AdwActionRow,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkScrolledWindow,
} from "@gtkx/react";

interface Category {
    id: string;
    title: string;
    icon: string;
}

const categories: Category[] = [
    { id: "all", title: "All Notes", icon: "document-edit-symbolic" },
    { id: "favorites", title: "Favorites", icon: "starred-symbolic" },
    { id: "recent", title: "Recent", icon: "document-open-recent-symbolic" },
    { id: "trash", title: "Trash", icon: "user-trash-symbolic" },
];

const Sidebar = ({
    noteCounts,
    onCategoryChanged,
}: {
    noteCounts: Record<string, number>;
    onCategoryChanged: (id: string) => void;
}) => (
    <GtkScrolledWindow vexpand>
        <GtkListBox
            cssClasses={["navigation-sidebar"]}
            onRowSelected={(row) => {
                if (!row) return;
                const category = categories[row.getIndex()];
                if (category) onCategoryChanged(category.id);
            }}
        >
            {categories.map((cat) => (
                <AdwActionRow
                    key={cat.id}
                    title={cat.title}
                    addPrefix={<GtkImage iconName={cat.icon} />}
                    addSuffix={<GtkLabel label={String(noteCounts[cat.id] ?? 0)} cssClasses={["dim-label"]} />}
                />
            ))}
        </GtkListBox>
    </GtkScrolledWindow>
);
```

Notice the `addPrefix` and `addSuffix` props on `AdwActionRow` — these are slot props for placing widgets at the start and end of an action row.

## Stack navigation

For tabbed views within a pane, use `AdwViewStack` with `AdwViewStackPage` and an `AdwViewSwitcher`. Control the active page with `visibleChildName`, and read changes through `onNotifyVisibleChildName`:

```tsx
import { AdwHeaderBar, AdwToolbarView, AdwViewStack, AdwViewStackPage, AdwViewSwitcher } from "@gtkx/react";
import * as Adw from "@gtkx/gi/adw";
import { useState } from "react";

const ContentPane = () => {
    const [stack, setStack] = useState<Adw.ViewStack | null>(null);
    const [page, setPage] = useState("list");

    return (
        <AdwToolbarView
            addTopBar={<AdwHeaderBar titleWidget={<AdwViewSwitcher stack={stack} />} />}
        >
            <AdwViewStack
                ref={setStack}
                visibleChildName={page}
                onNotifyVisibleChildName={(name) => setPage(name ?? "list")}
            >
                <AdwViewStackPage id="list" title="List" iconName="view-list-symbolic">
                    {/* Notes list from previous chapters */}
                </AdwViewStackPage>
                <AdwViewStackPage id="grid" title="Grid" iconName="view-grid-symbolic">
                    {/* Grid view of notes */}
                </AdwViewStackPage>
            </AdwViewStack>
        </AdwToolbarView>
    );
};
```

The `AdwViewSwitcher` automatically renders tabs that correspond to the stack pages. Link them via the `ref`/`stack` pattern shown above.

## Stack-based navigation

For push/pop navigation (like navigating into a note detail view), use `AdwNavigationView` with `AdwNavigationPage` children. Each page carries a `tag`; the view pushes a page when it mounts and pops it when it unmounts. Drive the active page declaratively with `visiblePageTag`, and react to navigation through `onPushed` and `onPopped`:

```tsx
import { AdwHeaderBar, AdwNavigationPage, AdwNavigationView, AdwToolbarView } from "@gtkx/react";
import { useState } from "react";

const NotesBrowser = () => {
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    return (
        <AdwNavigationView
            visiblePageTag={selectedNote ? `note-${selectedNote.id}` : "list"}
            onPopped={() => setSelectedNote(null)}
        >
            <AdwNavigationPage tag="list" title="Notes">
                <AdwToolbarView addTopBar={<AdwHeaderBar />}>
                    {/* Notes list — onClick calls setSelectedNote(note) */}
                </AdwToolbarView>
            </AdwNavigationPage>

            {selectedNote && (
                <AdwNavigationPage tag={`note-${selectedNote.id}`} title={selectedNote.title}>
                    <AdwToolbarView addTopBar={<AdwHeaderBar />}>
                        {/* Note editor */}
                    </AdwToolbarView>
                </AdwNavigationPage>
            )}
        </AdwNavigationView>
    );
};
```

The `AdwHeaderBar` inside a navigation page automatically shows a back button when there's a page to pop. Pressing it fires `onPopped`, which clears `selectedNote` and unmounts the detail page.

## Complete layout

Here's how the pieces fit together:

```tsx
function NotesWindow() {
    const [notes] = useState<Note[]>([ /* ... */ ]);
    const [category, setCategory] = useState("all");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const selectedNote = notes.find((n) => n.id === selectedId);

    const categoryTitles: Record<string, string> = {
        all: "All Notes",
        favorites: "Favorites",
        recent: "Recent",
        trash: "Trash",
    };

    return (
        <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={quit}>
            <AdwNavigationSplitView
                sidebarWidthFraction={0.25}
                minSidebarWidth={200}
                maxSidebarWidth={300}
                sidebar={
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
                                noteCounts={{ all: notes.length, favorites: 0, recent: notes.length, trash: 0 }}
                                onCategoryChanged={setCategory}
                            />
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
                content={
                    <AdwNavigationPage title={selectedNote?.title ?? categoryTitles[category] ?? "Notes"}>
                        <AdwToolbarView
                            addTopBar={
                                <AdwHeaderBar
                                    packEnd={
                                        <GtkMenuButton iconName="open-menu-symbolic" tooltipText="Main Menu">
                                            {/* ... menu items */}
                                        </GtkMenuButton>
                                    }
                                />
                            }
                        >
                            {/* Notes list filtered by category */}
                        </AdwToolbarView>
                    </AdwNavigationPage>
                }
            />
        </AdwApplicationWindow>
    );
}

export function App() {
    return (
        <AdwApplication applicationId="com.example.notes">
            <NotesWindow />
        </AdwApplication>
    );
}
```

## Search

Most content-centric GNOME apps provide search. `GtkSearchBar` slides into view when activated and connects to a `GtkSearchEntry`:

```tsx
import { GtkButton, GtkSearchBar, GtkSearchEntry } from "@gtkx/react";
import * as Gtk from "@gtkx/gi/gtk";
import { useRef, useState } from "react";

const [searchMode, setSearchMode] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const searchEntryRef = useRef<Gtk.SearchEntry | null>(null);

// Add a search button to the header bar:
<AdwHeaderBar
    packStart={
        <GtkButton
            iconName="system-search-symbolic"
            tooltipText="Search (Ctrl+F)"
            onClicked={() => setSearchMode(!searchMode)}
        />
    }
/>

// Place the search bar below the header bar, inside the content area:
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
```

Then filter your data based on `searchQuery`:

```tsx
const filteredNotes = searchQuery
    ? notes.filter(
          (n) =>
              n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              n.body.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : notes;
```

When the list is empty, show a search-specific `AdwStatusPage`:

```tsx
<AdwStatusPage
    vexpand
    iconName={searchQuery ? "system-search-symbolic" : "document-edit-symbolic"}
    title={searchQuery ? "No Results Found" : "No Notes Yet"}
    description={searchQuery ? `No notes match "${searchQuery}"` : "Press + or Ctrl+N to create your first note"}
/>
```

## Next

In the [next chapter](./6-dialogs-and-animations.md), you'll add confirmation dialogs and smooth animations.
