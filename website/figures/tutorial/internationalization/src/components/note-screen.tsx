import * as Gtk from "@gtkx/gi/gtk";
import { useTranslation } from "@gtkx/i18n";
import { AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { useSetting } from "@gtkx/react";
import { useMemo } from "react";
import { openNote, type RootParamList } from "../navigation.js";
import { linkedNoteName } from "../notes/files.js";
import { useNotes } from "../notes/notes-provider.js";
import { MarkdownPreview } from "../preview/markdown-preview.js";
import { schema, useAppSettings } from "../settings.js";
import { NoteEditor } from "../editor/note-editor.js";

const openLinkedNote = (uri: string): boolean => {
    const name = linkedNoteName(uri);
    if (name === null) {
        return false;
    }
    openNote(name);

    return true;
};

const NoteScreen = ({ route }: SplitViewScreenProps<RootParamList, "Note">) => {
    const { t } = useTranslation();
    const { notes, edit } = useNotes();
    const [preview] = useSetting(useAppSettings(), schema, "preview");
    const { name } = route.params;
    const note = notes?.get(name);
    const linkTargets = useMemo(
        () => [...(notes?.keys() ?? [])].filter((other) => other !== name),
        [notes, name],
    );

    if (note === undefined) {
        return (
            <AdwStatusPage
                iconName="edit-find-symbolic"
                title={t("Note Not Found")}
            />
        );
    }

    return (
        <GtkStack
            visibleChildName={preview ? "preview" : "editor"}
            transitionType={Gtk.StackTransitionType.CROSSFADE}
        >
            <GtkStackPage name="editor">
                <NoteEditor
                    key={name}
                    text={note.text}
                    linkTargets={linkTargets}
                    onChange={(text) => edit(name, text)}
                />
            </GtkStackPage>
            <GtkStackPage name="preview">
                <MarkdownPreview
                    text={note.body}
                    tags={note.tags}
                    onActivateLink={openLinkedNote}
                />
            </GtkStackPage>
        </GtkStack>
    );
};

export { NoteScreen };
