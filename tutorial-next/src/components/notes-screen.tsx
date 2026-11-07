import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { useTranslation } from "@gtkx/i18n";
import { AdwSpinner, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import * as Pango from "@gtkx/gi/pango";
import { type RootParamList, useOpenNoteName } from "../navigation.js";
import type { Note } from "../notes/files.js";
import { useNotes } from "../notes/notes-provider.js";

const excerpt = (text: string): string =>
    text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line !== "" && !line.startsWith("#")) ?? "";

const NoteRow = ({ note }: { note: Note }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} marginTop={8} marginBottom={8}>
        <GtkLabel label={note.name} xalign={0} ellipsize={Pango.EllipsizeMode.END} cssClasses={["heading"]} />
        <GtkLabel
            label={excerpt(note.text)}
            xalign={0}
            ellipsize={Pango.EllipsizeMode.END}
            singleLineMode
            cssClasses={["dim-label", "caption"]}
        />
    </GtkBox>
);

const NotesScreen = ({ navigation }: SplitViewScreenProps<RootParamList, "Notes">) => {
    const { t } = useTranslation();
    const { notes } = useNotes();
    const openName = useOpenNoteName();

    if (notes === null) {
        return <AdwSpinner />;
    }

    if (notes.size === 0) {
        return (
            <AdwStatusPage
                iconName="document-new-symbolic"
                title={t("No Notes")}
                description={t("Notes are Markdown files in your notes folder")}
                cssClasses={["compact"]}
            >
                <GtkButton
                    label={t("New Note")}
                    actionName="win.new-note"
                    halign={Gtk.Align.CENTER}
                    cssClasses={["pill", "suggested-action"]}
                />
            </AdwStatusPage>
        );
    }

    const sorted = [...notes.values()].sort((a, b) => b.modified - a.modified);

    return (
        <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <ListView<Note>
                items={sorted.map((note) => ({ id: note.name, value: note }))}
                isFlat
                cssClasses={["navigation-sidebar"]}
                selectionMode={Gtk.SelectionMode.SINGLE}
                selectedIds={openName === null ? [] : [openName]}
                onSelectionChanged={([name]) => {
                    if (name !== undefined) {
                        navigation.navigate("Note", { name });
                    }
                }}
                rowProps={({ item }) => ({ accessibleLabel: item.name })}
                renderItem={({ item }) => <NoteRow note={item} />}
            />
        </GtkScrolledWindow>
    );
};

export { NotesScreen };
