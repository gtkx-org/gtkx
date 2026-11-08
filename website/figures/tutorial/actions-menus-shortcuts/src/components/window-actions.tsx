import { useToast } from "@gtkx/components";
import * as GLib from "@gtkx/gi/glib";
import { t } from "@gtkx/i18n";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { openNote } from "../navigation.js";
import { useNotes } from "../notes/notes-provider.js";
import type { Dialog } from "./dialogs.js";

const message = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const useNoteCommands = () => {
    const { create } = useNotes();
    const { show } = useToast();

    const showError = (error: unknown): void => {
        show({ useMarkup: false, title: message(error) });
    };

    const newNote = async (): Promise<void> => {
        openNote(await create(t("Untitled"), ""));
    };

    return {
        newNote: () => newNote().catch(showError),
    };
};

type WindowActionsProps = {
    preview: boolean;
    onPreviewChange: (preview: boolean) => void;
    onShowDialog: (dialog: Dialog) => void;
};

const WindowActions = ({
    preview,
    onPreviewChange,
    onShowDialog,
}: WindowActionsProps) => {
    const { notes } = useNotes();
    const { newNote } = useNoteCommands();

    return (
        <>
            <GSimpleAction
                name="new-note"
                enabled={notes !== null}
                onActivate={() => void newNote()}
            />
            <GSimpleAction
                name="preview"
                state={GLib.Variant.newBoolean(preview)}
                onChangeState={(value) => {
                    if (value !== null) {
                        onPreviewChange(value.getBoolean());
                    }
                }}
            />
            <GSimpleAction
                name="shortcuts"
                onActivate={() => onShowDialog({ kind: "shortcuts" })}
            />
            <GSimpleAction
                name="about"
                onActivate={() => onShowDialog({ kind: "about" })}
            />
        </>
    );
};

export { WindowActions };
