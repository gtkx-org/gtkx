import * as Adw from "@gtkx/ffi/adw";
import { AdwAlertDialog, createPortal, useApplication, useProperty } from "@gtkx/react";

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

    return createPortal(
        <AdwAlertDialog
            heading="Delete Note?"
            body={`\u201c${noteTitle}\u201d will be permanently deleted.`}
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "delete", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
            ]}
            defaultResponse="cancel"
            closeResponse="cancel"
            onResponse={(id) => {
                if (id === "delete") onConfirm();
                else onCancel();
            }}
        />,
        activeWindow,
    );
};
