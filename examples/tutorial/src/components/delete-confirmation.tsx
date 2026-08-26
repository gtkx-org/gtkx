import * as Adw from "@gtkx/gi/adw";
import { t } from "@gtkx/i18n";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { closeTaskIfOpen } from "../navigation.js";
import { useStore } from "../store/index.js";

export const DeleteConfirmation = () => {
    const taskToDelete = useStore((state) => state.taskToDelete);
    const tasks = useStore((state) => state.tasks);
    const deleteForever = useStore((state) => state.deleteForever);
    const askDeleteTask = useStore((state) => state.askDeleteTask);
    const title = tasks.find((task) => task.id === taskToDelete)?.title ?? "";

    return (
        <AdwAlertDialog
            heading={t("Delete Task?")}
            body={t("“{{title}}” will be permanently deleted. This cannot be undone.", { title })}
            defaultResponse="cancel"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: t("Cancel") },
                { id: "delete", label: t("Delete"), appearance: Adw.ResponseAppearance.DESTRUCTIVE },
            ]}
            onResponse={(id) => {
                if (id === "delete" && taskToDelete !== null) {
                    closeTaskIfOpen(taskToDelete);
                    deleteForever(taskToDelete);
                }
                askDeleteTask(null);
            }}
        />
    );
};
