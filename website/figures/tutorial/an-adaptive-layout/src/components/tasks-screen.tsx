import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({
    route,
}: SplitViewScreenProps<RootParamList, "Tasks">) => (
    <TaskList selection={route.params} />
);
