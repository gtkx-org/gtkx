import { useToast } from "@gtkx/components/adw";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";
import { About } from "./about.js";
import { DeleteConfirmation } from "./delete-confirmation.js";
import { NewListDialog } from "./new-list-dialog.js";
import { Preferences } from "./preferences.js";
import { Shortcuts } from "./shortcuts.js";

export const useRequestDeleteTask = (): ((task: Task) => void) => {
    const { show } = useToast();

    return (task) => {
        const { moveToTrash, restore, askDeleteTask, selectedTaskId, closeTask } = useStore.getState();
        if (task.deleted) {
            askDeleteTask(task.id);
            return;
        }
        moveToTrash(task.id);
        if (selectedTaskId === task.id) closeTask();
        show({
            title: `“${task.title}” moved to Trash`,
            buttonLabel: "Undo",
            onButtonClicked: () => restore(task.id),
        });
    };
};

export const Dialogs = () => {
    const dialog = useStore((state) => state.dialog);
    const showDialog = useStore((state) => state.showDialog);
    const close = () => showDialog("none");

    switch (dialog) {
        case "about":
            return <About onClose={close} />;
        case "shortcuts":
            return <Shortcuts onClose={close} />;
        case "preferences":
            return <Preferences onClose={close} />;
        case "new-list":
            return <NewListDialog />;
        case "delete-task":
            return <DeleteConfirmation />;
        case "none":
            return null;
    }
};
