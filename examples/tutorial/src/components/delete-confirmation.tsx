import * as Adw from "@gtkx/gi/adw";
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
            heading="Delete Task?"
            body={`“${title}” will be permanently deleted. This cannot be undone.`}
            defaultResponse="cancel"
            closeResponse="cancel"
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "delete", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
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
