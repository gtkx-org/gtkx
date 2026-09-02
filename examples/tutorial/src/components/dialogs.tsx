import { useToast } from "@gtkx/components";
import { t } from "@gtkx/i18n";
import { closeTaskIfOpen } from "../navigation.js";
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
        const { moveToTrash, restore, askDeleteTask } = useStore.getState();
        if (task.deleted) {
            askDeleteTask(task.id);
            return;
        }
        closeTaskIfOpen(task.id);
        moveToTrash(task.id);
        show({
            title: t("“{{title}}” moved to Trash", { title: task.title }),
            buttonLabel: t("Undo"),
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
