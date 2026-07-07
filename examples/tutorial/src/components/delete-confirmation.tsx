import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";
import { useApplication, useProperty } from "@gtkx/react";

export const DeleteConfirmation = ({
    noteTitle,
    onConfirm,
    onCancel,
}: {
    noteTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return (
        <Dialog parent={activeWindow}>
            <AlertDialog
                heading="Delete Note?"
                body={`“${noteTitle}” will be permanently deleted.`}
                defaultResponse="cancel"
                closeResponse="cancel"
                onResponse={(id) => {
                    if (id === "delete") onConfirm();
                    else onCancel();
                }}
            >
                <AlertDialog.Response id="cancel" label="Cancel" />
                <AlertDialog.Response id="delete" label="Delete" appearance={Adw.ResponseAppearance.DESTRUCTIVE} />
            </AlertDialog>
        </Dialog>
    );
};
