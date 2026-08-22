import type { SplitViewScreenProps } from "@gtkx/navigation";
import type { RootParamList } from "../navigation.js";
import { selectionKey } from "../store/selectors.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => {
    const selection = route.params;

    return <TaskList key={selectionKey(selection)} selection={selection} />;
};
