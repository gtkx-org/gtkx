import * as Gtk from "@gtkx/gi/gtk";
import { useTranslation } from "@gtkx/i18n";
import { AdwStatusPage } from "@gtkx/jsx/adw";
import { GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { NoteEditor } from "../editor/note-editor.js";
import type { RootParamList } from "../navigation.js";
import { linkedNoteName } from "../notes/files.js";
import { useNotes } from "../notes/notes-provider.js";
import { MarkdownPreview } from "../preview/markdown-preview.js";

type NoteScreenProps = SplitViewScreenProps<RootParamList, "Note"> & {
    preview: boolean;
};

const NoteScreen = ({ route, navigation, preview }: NoteScreenProps) => {
    const { t } = useTranslation();
    const { notes, edit } = useNotes();
    const { name } = route.params;
    const note = notes?.get(name);

    const openLinkedNote = (uri: string): boolean => {
        const linked = linkedNoteName(uri);
        if (linked === null) {
            return false;
        }
        navigation.navigate("Note", { name: linked });

        return true;
    };

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
