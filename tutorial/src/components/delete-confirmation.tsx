import * as Adw from "@gtkx/gi/adw";
import { t } from "@gtkx/i18n";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import type { Task } from "../types.js";
import { closeTaskIfOpen } from "../navigation.js";
import { useStore } from "../store/index.js";

const DeleteConfirmation = ({ task }: { task: Task }) => {
    const deleteForever = useStore((state) => state.deleteForever);
    const showDialog = useStore((state) => state.showDialog);

    return (
        <AdwAlertDialog
            heading={t("Delete Task?")}
            body={t("“{{title}}” will be permanently deleted. This cannot be undone.", { title: task.title })}
            defaultResponse="cancel"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: t("Cancel") },
                { id: "delete", label: t("Delete"), appearance: Adw.ResponseAppearance.DESTRUCTIVE },
            ]}
            onResponse={(id) => {
                if (id === "delete") {
                    closeTaskIfOpen(task.id);
                    deleteForever(task.id);
                }
                showDialog("none");
            }}
        />
    );
};

export {
    DeleteConfirmation,
};
