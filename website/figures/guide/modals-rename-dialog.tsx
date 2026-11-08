import * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkEntry } from "@gtkx/jsx/gtk";

export function RenameDialog({
    onResponse,
}: {
    onResponse: (id: string) => void;
}) {
    return (
        <AdwAlertDialog
            heading="Rename"
            body="Pick a new name for this list."
            defaultResponse="rename"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: "Cancel" },
                {
                    id: "rename",
                    label: "Rename",
                    appearance: Adw.ResponseAppearance.SUGGESTED,
                },
            ]}
            onResponse={onResponse}
        >
            <GtkEntry placeholderText="List name" activatesDefault />
        </AdwAlertDialog>
    );
}
