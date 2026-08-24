import type { SplitViewScreenProps } from "@gtkx/navigation";
import { useEffect } from "react";
import { type RootParamList, useSelection } from "../navigation.js";
import { useStore } from "../store/index.js";
import { TaskDetail } from "./task-detail.js";

export const TaskScreen = ({ navigation, route }: SplitViewScreenProps<RootParamList, "Task">) => {
    const task = useStore((state) => state.tasks.find((candidate) => candidate.id === route.params.id));
    const selection = useSelection();
    const isTrash = selection?.kind === "smart" && selection.view === "trash";
    const hasVisibleTask = task !== undefined && (!task.deleted || isTrash);

    useEffect(() => {
        if (!hasVisibleTask) {
            navigation.goBack();
        }
    }, [hasVisibleTask, navigation]);

    return hasVisibleTask ? <TaskDetail key={task.id} task={task} /> : null;
};
