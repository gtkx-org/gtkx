import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { selectionKey } from "../store/selectors.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({
    route,
}: SplitViewScreenProps<RootParamList, "Tasks">) => (
    <TaskList key={selectionKey(route.params)} selection={route.params} />
);
