import { useTranslation } from "@gtkx/i18n";
import { AdwStatusPage } from "@gtkx/jsx/adw";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { useNotes } from "../notes/notes-provider.js";
import { NoteEditor } from "./note-editor.js";

const NoteScreen = ({ route }: SplitViewScreenProps<RootParamList, "Note">) => {
    const { t } = useTranslation();
    const { notes, edit } = useNotes();
    const { name } = route.params;
    const note = notes?.get(name);

    if (note === undefined) {
        return <AdwStatusPage iconName="edit-find-symbolic" title={t("Note Not Found")} />;
    }

    return <NoteEditor key={name} text={note.text} onChange={(text) => edit(name, text)} />;
};

export { NoteScreen };
