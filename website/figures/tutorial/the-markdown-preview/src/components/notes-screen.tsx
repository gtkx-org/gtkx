import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { useTranslation } from "@gtkx/i18n";
import { AdwSpinner, AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { type RootParamList, useOpenNoteName } from "../navigation.js";
import type { Note } from "../notes/note.js";
import { useNotes } from "../notes/notes-provider.js";

const NoteRow = ({ note }: { note: Note }) => (
    <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={2}
        marginTop={8}
        marginBottom={8}
    >
        <GtkLabel
            label={note.name}
            xalign={0}
            ellipsize={Pango.EllipsizeMode.END}
            cssClasses={["heading"]}
        />
        <GtkLabel
            label={note.excerpt}
            xalign={0}
            ellipsize={Pango.EllipsizeMode.END}
            singleLineMode
            cssClasses={["dimmed", "caption"]}
        />
    </GtkBox>
);

const NotesScreen = ({
    navigation,
}: SplitViewScreenProps<RootParamList, "Notes">) => {
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
            />
        );
    }

    const shown = [...notes.values()].sort((a, b) => b.modified - a.modified);

    return (
        <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER}>
            <ListView<Note>
                items={shown.map((note) => ({ id: note.name, value: note }))}
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
