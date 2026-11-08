import { useToast } from "@gtkx/components";
import * as GLib from "@gtkx/gi/glib";
import { t } from "@gtkx/i18n";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useSetting } from "@gtkx/react";
import { closeNoteIfOpen, openNote } from "../navigation.js";
import { useNotes } from "../notes/notes-provider.js";
import { schema, useAppSettings } from "../settings.js";
import type { Dialog } from "./dialogs.js";

const message = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const useNoteCommands = () => {
    const { notes, create, rename, trash } = useNotes();
    const { show } = useToast();

    const showError = (error: unknown): void => {
        show({ useMarkup: false, title: message(error) });
    };

    const newNote = async (): Promise<void> => {
        openNote(await create(t("Untitled"), ""));
    };

    const renameNote = async (from: string, to: string): Promise<void> => {
        await rename(from, to);
        openNote(to);
    };

    const trashNote = async (name: string): Promise<void> => {
        const text = notes?.get(name)?.text ?? "";
        closeNoteIfOpen(name);
        await trash(name);
        show({
            useMarkup: false,
            title: t("“{{name}}” moved to Trash", { name }),
            buttonLabel: t("Undo"),
            onButtonClicked: () => {
                create(name, text).then(openNote, showError);
            },
        });
    };

    return {
        newNote: () => newNote().catch(showError),
        renameNote: (from: string, to: string) =>
            renameNote(from, to).catch(showError),
        trashNote: (name: string) => trashNote(name).catch(showError),
        showError,
    };
};

type WindowActionsProps = {
    openName: string | null;
    onShowDialog: (dialog: Dialog) => void;
};

const WindowActions = ({ openName, onShowDialog }: WindowActionsProps) => {
    const { notes } = useNotes();
    const { newNote, trashNote } = useNoteCommands();
    const [preview, setPreview] = useSetting(
        useAppSettings(),
        schema,
        "preview",
    );

    return (
        <>
            <GSimpleAction
                name="new-note"
                enabled={notes !== null}
                onActivate={() => void newNote()}
            />
            <GSimpleAction
                name="rename-note"
                enabled={openName !== null}
                onActivate={() => {
                    if (openName !== null) {
                        onShowDialog({ kind: "rename", name: openName });
                    }
                }}
            />
            <GSimpleAction
                name="trash-note"
                enabled={openName !== null}
                onActivate={() => {
                    if (openName !== null) {
                        void trashNote(openName);
                    }
                }}
            />
            <GSimpleAction
                name="preview"
                state={GLib.Variant.newBoolean(preview)}
                onChangeState={(value) => {
                    if (value !== null) {
                        setPreview(value.getBoolean());
                    }
                }}
            />
            <GSimpleAction
                name="preferences"
                onActivate={() => onShowDialog({ kind: "preferences" })}
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

export { useNoteCommands, WindowActions };
