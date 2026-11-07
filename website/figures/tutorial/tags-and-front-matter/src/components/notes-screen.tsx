import { DropDown, ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { useTranslation } from "@gtkx/i18n";
import { AdwSpinner, AdwStatusPage } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkCallbackAction,
    GtkLabel,
    GtkScrolledWindow,
    GtkSearchEntry,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
} from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { useState } from "react";
import { type RootParamList, useOpenNoteName } from "../navigation.js";
import type { Note } from "../notes/note.js";
import { useNotes } from "../notes/notes-provider.js";
import { useNoteSearch } from "../search/use-note-search.js";

const ALL_NOTES = "";

const allTags = (notes: Iterable<Note>): string[] =>
    [...new Set([...notes].flatMap((note) => note.tags))].sort((a, b) =>
        a.localeCompare(b),
    );

const TagFilter = ({
    tags,
    tag,
    onChange,
}: {
    tags: string[];
    tag: string;
    onChange: (tag: string) => void;
}) => {
    const { t } = useTranslation();

    return (
        <DropDown
            tooltipText={t("Filter by Tag")}
            items={[
                { id: ALL_NOTES, value: t("All Notes") },
                ...tags.map((name) => ({ id: name, value: `#${name}` })),
            ]}
            selectedId={tag}
            onSelectionChanged={(id) => onChange(id ?? ALL_NOTES)}
        />
    );
};

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
            cssClasses={["dim-label", "caption"]}
        />
    </GtkBox>
);

const FocusShortcut = ({ target }: { target: Gtk.Widget | null }) => (
    <GtkShortcutController
        scope={Gtk.ShortcutScope.GLOBAL}
        shortcuts={
            <GtkShortcut
                trigger={<GtkShortcutTrigger accelerator="<Control>f" />}
                action={
                    <GtkCallbackAction
                        callback={() => target?.grabFocus() ?? false}
                    />
                }
            />
        }
    />
);

const NotesScreen = ({
    navigation,
}: SplitViewScreenProps<RootParamList, "Notes">) => {
    const { t } = useTranslation();
    const { notes } = useNotes();
    const openName = useOpenNoteName();
    const [query, setQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState(ALL_NOTES);
    const [searchEntry, setSearchEntry] = useState<Gtk.SearchEntry | null>(
        null,
    );
    const matches = useNoteSearch(notes, query.trim());

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

    const tags = allTags(notes.values());
    const tag = tags.includes(selectedTag) ? selectedTag : ALL_NOTES;
    const shown = [...notes.values()]
        .filter((note) => tag === ALL_NOTES || note.tags.includes(tag))
        .filter((note) => matches === null || matches.has(note.name))
        .sort((a, b) => b.modified - a.modified);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            controllers={<FocusShortcut target={searchEntry} />}
        >
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={6}
                marginTop={6}
                marginBottom={6}
                marginStart={6}
                marginEnd={6}
            >
                <GtkSearchEntry
                    ref={setSearchEntry}
                    accessibleLabel={t("Search Notes")}
                    placeholderText={t("Search notes")}
                    text={query}
                    onSearchChanged={(entry) => setQuery(entry.getText())}
                    onStopSearch={() => setQuery("")}
                />
                {tags.length > 0 && (
                    <TagFilter
                        tags={tags}
                        tag={tag}
                        onChange={setSelectedTag}
                    />
                )}
            </GtkBox>
            {shown.length === 0 ? (
                <AdwStatusPage
                    iconName="edit-find-symbolic"
                    title={t("No Results Found")}
                    vexpand
                    cssClasses={["compact"]}
                />
            ) : (
                <GtkScrolledWindow
                    vexpand
                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                >
                    <ListView<Note>
                        items={shown.map((note) => ({
                            id: note.name,
                            value: note,
                        }))}
                        isFlat
                        cssClasses={["navigation-sidebar"]}
                        selectionMode={Gtk.SelectionMode.SINGLE}
                        selectedIds={openName === null ? [] : [openName]}
                        onSelectionChanged={([name]) => {
                            if (name !== undefined) {
                                navigation.navigate("Note", { name });
                            }
                        }}
                        rowProps={({ item }) => ({
                            accessibleLabel: item.name,
                        })}
                        renderItem={({ item }) => <NoteRow note={item} />}
                    />
                </GtkScrolledWindow>
            )}
        </GtkBox>
    );
};

export { NotesScreen };
