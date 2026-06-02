import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkListView, GtkScrolledWindow } from "@gtkx/react";
import { AppShell } from "../app-shell";
import { type Note, NoteCardComponent, sampleNotes } from "../data";

export const Chapter3 = () => (
    <AppShell headerStart={<GtkButton iconName="list-add-symbolic" />}>
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
