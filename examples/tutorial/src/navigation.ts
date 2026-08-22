import { createNavigationContainerRef, createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
import type { Selection } from "./types.js";

export type RootParamList = {
    Lists: undefined;
    Tasks: Selection;
    Task: { id: string };
};

export const ALL_TASKS: Selection = { kind: "smart", view: "all" };

export const Split = createSplitViewNavigator<RootParamList>();

export const navigationRef = createNavigationContainerRef<RootParamList>();

type RootNavigatorType = typeof Split;

declare module "@react-navigation/core" {
    interface RootNavigator extends RootNavigatorType {}
}

const isSelection = (params: unknown): params is Selection =>
    typeof params === "object" && params !== null && "kind" in params;

export const useSelection = (): Selection | null =>
    useNavigationState<RootParamList, Selection | null>((state) => {
        const params = state.routes.find((route) => route.name === "Tasks")?.params;
        return isSelection(params) ? params : null;
    });

export const currentSelection = (): Selection => {
    const routes = navigationRef.isReady() ? navigationRef.getRootState()?.routes : undefined;
    const params = routes?.find((route) => route.name === "Tasks")?.params;
    return isSelection(params) ? params : ALL_TASKS;
};

export const openTaskId = (): string | null => {
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
    return route?.name === "Task" ? route.params.id : null;
};

export const openTask = (selection: Selection, id: string): void => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate("Tasks", selection);
    navigationRef.navigate("Task", { id });
};

export const closeTaskIfOpen = (id: string): void => {
    if (openTaskId() === id) navigationRef.goBack();
};
