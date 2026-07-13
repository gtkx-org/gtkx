import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";

export const DeleteConfirmation = ({
    taskTitle,
    onConfirm,
    onCancel,
}: {
    taskTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    return (
        <Dialog>
            <AlertDialog
                heading="Delete Task?"
                body={`“${taskTitle}” will be permanently deleted. This cannot be undone.`}
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
