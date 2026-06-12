import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import { GtkButton, GtkListView, GtkMenuButton, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { AppShell } from "../app-shell.js";
import { type Note, NoteCardComponent, noop, sampleNotes } from "../data.js";

export const Chapter4 = () => (
    <AppShell
        headerStart={<GtkButton iconName="list-add-symbolic" />}
        headerEnd={
            <GtkMenuButton
                iconName="open-menu-symbolic"
                name="app-menu"
                menuModel={
                    <GMenu
                        items={[
                            { label: "New Note", action: "win.new" },
                            {
                                label: "Sort",
                                section: [
                                    { label: "By Title", action: "win.sort-title" },
                                    { label: "By Date", action: "win.sort-date" },
                                ],
                            },
                            {
                                section: [
                                    { label: "About Notes", action: "win.about" },
                                    { label: "Quit", action: "win.quit" },
                                ],
                            },
                        ]}
                    />
                }
            />
        }
        actions={
            <>
                <GSimpleAction name="new" onActivate={noop} accels="<Control>n" />
                <GSimpleAction name="sort-title" onActivate={noop} />
                <GSimpleAction name="sort-date" onActivate={noop} />
                <GSimpleAction name="about" onActivate={noop} />
                <GSimpleAction name="quit" onActivate={noop} accels="<Control>q" />
            </>
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
