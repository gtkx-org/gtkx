import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkScrolledWindow } from "@gtkx/react";
import { AppShell } from "../AppShell";
import { NoteCardComponent, sampleNotes } from "../data";

export const Chapter2 = () => (
    <AppShell headerStart={<GtkButton iconName="list-add-symbolic" />}>
        <GtkScrolledWindow vexpand>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                {sampleNotes.map((note) => (
                    <NoteCardComponent key={note.id} note={note} />
                ))}
            </GtkBox>
        </GtkScrolledWindow>
    </AppShell>
);
