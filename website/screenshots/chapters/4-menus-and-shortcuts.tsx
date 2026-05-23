import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkListView, GtkMenuButton, GtkScrolledWindow } from "@gtkx/react";
import { AppShell } from "../AppShell";
import { type Note, NoteCardComponent, noop, sampleNotes } from "../data";

export const Chapter4 = () => (
    <AppShell
        headerStart={<GtkButton iconName="list-add-symbolic" />}
        headerEnd={
            <GtkMenuButton iconName="open-menu-symbolic" name="app-menu">
                <GtkMenuButton.MenuItem id="new" label="New Note" accels="<Control>n" onActivate={noop} />
                <GtkMenuButton.MenuSection label="Sort">
                    <GtkMenuButton.MenuItem id="sort-title" label="By Title" onActivate={noop} />
                    <GtkMenuButton.MenuItem id="sort-date" label="By Date" onActivate={noop} />
                </GtkMenuButton.MenuSection>
                <GtkMenuButton.MenuSection>
                    <GtkMenuButton.MenuItem id="about" label="About Notes" onActivate={noop} />
                    <GtkMenuButton.MenuItem id="quit" label="Quit" accels="<Control>q" onActivate={noop} />
                </GtkMenuButton.MenuSection>
            </GtkMenuButton>
        }
    >
        <GtkScrolledWindow vexpand>
            <GtkListView
                estimatedItemHeight={80}
                selectionMode={Gtk.SelectionMode.SINGLE}
                items={sampleNotes.map((n) => ({ id: n.id, value: n }))}
                renderItem={(note: Note) => <NoteCardComponent note={note} />}
            />
        </GtkScrolledWindow>
    </AppShell>
);
