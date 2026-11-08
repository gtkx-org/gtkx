import { useTranslation } from "@gtkx/i18n";
import { AdwStatusPage } from "@gtkx/jsx/adw";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { NoteEditor } from "../editor/note-editor.js";
import type { RootParamList } from "../navigation.js";
import { useNotes } from "../notes/notes-provider.js";

const NoteScreen = ({ route }: SplitViewScreenProps<RootParamList, "Note">) => {
    const { t } = useTranslation();
    const { notes } = useNotes();
    const { name } = route.params;
    const note = notes?.get(name);

    if (note === undefined) {
        return (
            <AdwStatusPage
                iconName="edit-find-symbolic"
                title={t("Note Not Found")}
            />
        );
    }

    return <NoteEditor key={name} text={note.text} />;
};

export { NoteScreen };
