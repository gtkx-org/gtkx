import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { useStore } from "../store/index.js";
import { TaskDetail } from "./task-detail.js";

export const TaskScreen = ({ route }: SplitViewScreenProps<RootParamList, "Task">) => {
    const task = useStore((state) => state.tasks.find((candidate) => candidate.id === route.params.id));

    return task ? <TaskDetail key={task.id} task={task} /> : null;
};
