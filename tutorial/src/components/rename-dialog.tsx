import * as Adw from "@gtkx/gi/adw";
import { t } from "@gtkx/i18n";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkEntry } from "@gtkx/jsx/gtk";
import { useState } from "react";
import { isValidName } from "../notes/files.js";
import { useNotes } from "../notes/notes-provider.js";

type RenameDialogProps = {
    name: string;
    onRename: (name: string) => void;
    onClose: () => void;
};

const RenameDialog = ({ name, onRename, onClose }: RenameDialogProps) => {
    const { notes } = useNotes();
    const [draft, setDraft] = useState(name);
    const canRename = draft !== name && isValidName(draft) && notes?.has(draft) !== true;

    return (
        <AdwAlertDialog
            heading={t("Rename Note")}
            defaultResponse="rename"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: t("Cancel") },
                {
                    id: "rename",
                    label: t("Rename"),
                    appearance: Adw.ResponseAppearance.SUGGESTED,
                    isEnabled: canRename,
                },
            ]}
            onResponse={(id) => {
                if (id === "rename" && canRename) {
                    onRename(draft);
                }
                onClose();
            }}
        >
            <GtkEntry
                text={draft}
                accessibleLabel={t("Note name")}
                activatesDefault
                onChanged={(self) => {
                    setDraft(self.text);
                }}
            />
        </AdwAlertDialog>
    );
};

export { RenameDialog };
