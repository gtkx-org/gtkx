import type { DrawerNavigationState, DrawerStatus, ParamListBase } from "@react-navigation/core";

const getDrawerStatus = (state: DrawerNavigationState<ParamListBase>): DrawerStatus =>
    state.history.findLast((entry) => entry.type === "drawer")?.status ?? state.default;

export { getDrawerStatus };
