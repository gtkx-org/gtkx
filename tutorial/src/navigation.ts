import { createNavigationContainerRef, createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
import type { Selection } from "./types.js";

type RootParamList = {
    Lists: undefined;
    Tasks: Selection;
    Task: { id: string };
};

const ALL_TASKS: Selection = { kind: "smart", view: "all" };

const Split = createSplitViewNavigator<RootParamList>();

const navigationRef = createNavigationContainerRef<RootParamList>();

type PendingTask = { selection: Selection; id: string };

type RootNavigatorType = typeof Split;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootNavigatorType {}
}

const isSelection = (params: object | undefined): params is Selection =>
    params !== undefined && "kind" in params;

const useSelection = (): Selection | null =>
    useNavigationState<RootParamList, Selection | null>((state) => {
        const params = state.routes.find((route) => route.name === "Tasks")?.params;

        return isSelection(params) ? params : null;
    });

const currentSelection = (): Selection => {
    const routes = navigationRef.isReady() ? navigationRef.getRootState()?.routes : undefined;
    const params = routes?.find((route) => route.name === "Tasks")?.params;

    return isSelection(params) ? params : ALL_TASKS;
};

const openTaskId = (): string | null => {
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;

    return route?.name === "Task" ? route.params.id : null;
};

const createTaskOpener = () => {
    let pendingTask: PendingTask | null = null;
    const openTask = (selection: Selection, id: string): void => {
        if (!navigationRef.isReady()) {
            pendingTask = { selection, id };

            return;
        }
        navigationRef.navigate("Tasks", selection);
        navigationRef.navigate("Task", { id });
    };

    const openPendingTask = (): void => {
        if (pendingTask === null) {
            return;
        }
        const { selection, id } = pendingTask;
        pendingTask = null;
        openTask(selection, id);
    };

    return { openPendingTask, openTask };
};

const { openPendingTask, openTask } = createTaskOpener();

const closeTaskIfOpen = (id: string): void => {
    if (openTaskId() === id) {
        navigationRef.goBack();
    }
};

export {
    ALL_TASKS,
    closeTaskIfOpen,
    currentSelection,
    navigationRef,
    openPendingTask,
    openTask,
    openTaskId,
    type RootParamList,
    Split,
    useSelection,
};
