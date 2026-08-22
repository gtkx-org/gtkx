import type { DrawerNavigationState, NavigationAction, ParamListBase, PartialState } from "@react-navigation/core";
import { DrawerRouter } from "@react-navigation/routers";
import { getDrawerStatus } from "./drawer-status.js";

type DrawerState = DrawerNavigationState<ParamListBase>;
type DrawerRouterFactory = typeof DrawerRouter;
type DrawerRouterInstance = ReturnType<DrawerRouterFactory>;
type StateResult = DrawerState | PartialState<DrawerState> | null;

const NAVIGATING_ACTIONS = new Set(["JUMP_TO", "NAVIGATE", "NAVIGATE_DEPRECATED"]);

const isSameRoutes = (left: DrawerState, right: DrawerState): boolean =>
    left.index === right.index &&
    left.routes.length === right.routes.length &&
    left.routes.every((route, index) => right.routes[index]?.key === route.key);

const reopenSidebar = (state: DrawerState): DrawerState => {
    if (state.default === "open") {
        return { ...state, history: state.history.filter((entry) => entry.type !== "drawer") };
    }

    return { ...state, history: [...state.history, { type: "drawer", status: "open" }] };
};

const wasSidebarHidden = (before: DrawerState, after: DrawerState): boolean =>
    getDrawerStatus(before) === "open" && getDrawerStatus(after) === "closed";

const wasSidebarShown = (before: DrawerState, after: DrawerState): boolean =>
    getDrawerStatus(before) === "closed" && getDrawerStatus(after) === "open";

const keepSidebarShown = (before: DrawerState, after: DrawerState, isCollapsed: boolean): DrawerState =>
    !isCollapsed && wasSidebarHidden(before, after) ? reopenSidebar(after) : after;

const keepSidebarShownInResult = (before: DrawerState, after: StateResult, isCollapsed: boolean): StateResult =>
    after?.stale === false ? keepSidebarShown(before, after, isCollapsed) : after;

const shouldPassBackThrough = (state: DrawerState, after: StateResult, isCollapsed: boolean): boolean =>
    !isCollapsed && after?.stale === false && isSameRoutes(state, after) && wasSidebarShown(state, after);

const resolveAction = (
    state: DrawerState,
    action: NavigationAction,
    after: StateResult,
    isCollapsed: boolean,
): StateResult => {
    if (action.type === "GO_BACK") {
        return shouldPassBackThrough(state, after, isCollapsed) ? null : after;
    }

    return NAVIGATING_ACTIONS.has(action.type) ? keepSidebarShownInResult(state, after, isCollapsed) : after;
};

const withShownSidebar = (router: DrawerRouterInstance, isCollapsed: () => boolean): DrawerRouterInstance => ({
    ...router,
    getStateForAction: (state, action, config) =>
        resolveAction(state, action, router.getStateForAction(state, action, config), isCollapsed()),
    getStateForRouteFocus: (state, key) =>
        keepSidebarShown(state, router.getStateForRouteFocus(state, key), isCollapsed()),
});

const createDrawerRouter = (isCollapsed: () => boolean): DrawerRouterFactory => (options) =>
    withShownSidebar(DrawerRouter(options), isCollapsed);

export { createDrawerRouter, type DrawerRouterFactory };
