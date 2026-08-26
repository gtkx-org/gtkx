import { t } from "@gtkx/i18n";
import { GtkButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import { useRequestDeleteTask } from "./dialogs.js";

export const TaskButtons = ({ id }: { id: string }) => {
    const requestDeleteTask = useRequestDeleteTask();
    const setImportant = useStore((state) => state.setImportant);
    const task = useStore((state) => state.tasks.find((candidate) => candidate.id === id));

    if (!task) return null;

    return (
        <>
            <GtkToggleButton
                iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
                active={task.important}
                tooltipText={t("Important")}
                onToggled={(self) => setImportant(task.id, self.active)}
            />
            <GtkButton
                iconName="user-trash-symbolic"
                tooltipText={t("Delete (Delete)")}
                onClicked={() => requestDeleteTask(task)}
            />
        </>
    );
};
