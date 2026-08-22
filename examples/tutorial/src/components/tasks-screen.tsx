import type { SplitViewScreenProps } from "@gtkx/navigation";
import { useEffect } from "react";
import type { RootParamList } from "../navigation.js";
import { useStore } from "../store/index.js";
import { selectionKey } from "../store/selectors.js";
import { TaskList } from "./task-list.js";

export const TasksScreen = ({ route }: SplitViewScreenProps<RootParamList, "Tasks">) => {
    const resetSearch = useStore((state) => state.resetSearch);
    const selection = route.params;
    const key = selectionKey(selection);

    useEffect(() => {
        resetSearch();
    }, [key, resetSearch]);

    return <TaskList key={key} selection={selection} />;
};
