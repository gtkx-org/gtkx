import { createSplitViewNavigator, useNavigationState } from "@gtkx/navigation";
import type { Selection } from "./types.js";

export type RootParamList = {
    Lists: undefined;
    Tasks: Selection;
};

export const Split = createSplitViewNavigator<RootParamList>();

const isSelection = (params: object | undefined): params is Selection =>
    params !== undefined && "kind" in params;

export const useSelection = (): Selection | null =>
    useNavigationState<RootParamList, Selection | null>((state) => {
        const params = state.routes.find(
            (route) => route.name === "Tasks",
        )?.params;
        return isSelection(params) ? params : null;
    });

export const ALL_TASKS: Selection = { kind: "smart", view: "all" };
