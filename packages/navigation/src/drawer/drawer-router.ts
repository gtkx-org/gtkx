import type { DrawerNavigationState, NavigationAction, ParamListBase, PartialState } from "@react-navigation/core";
import { DrawerRouter } from "@react-navigation/routers";
import { getDrawerStatus } from "./drawer-status.js";

type DrawerState = DrawerNavigationState<ParamListBase>;
type DrawerRouterFactory = typeof DrawerRouter;
type DrawerRouterInstance = ReturnType<DrawerRouterFactory>;
type StateResult = DrawerState | PartialState<DrawerState> | null;
type Retry = (state: DrawerState) => StateResult;

type ResolvedAction = {
    state: DrawerState;
    action: NavigationAction;
    after: StateResult;
    isCollapsed: boolean;
    retry: Retry;
};

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

const withoutDrawerEntry = (state: DrawerState): DrawerState => ({
    ...state,
    history: state.history.filter((entry) => entry.type !== "drawer"),
});

const closedAgain = (state: DrawerState): DrawerState => ({
    ...state,
    history: [...state.history, { type: "drawer", status: "closed" }],
});

const backPastDrawer = (state: DrawerState, retry: Retry): StateResult => {
    const after = retry(withoutDrawerEntry(state));

    return after?.stale === false ? closedAgain(after) : after;
};

const resolveAction = ({ state, action, after, isCollapsed, retry }: ResolvedAction): StateResult => {
    if (action.type === "GO_BACK") {
        return shouldPassBackThrough(state, after, isCollapsed) ? backPastDrawer(state, retry) : after;
    }

    return NAVIGATING_ACTIONS.has(action.type) ? keepSidebarShownInResult(state, after, isCollapsed) : after;
};

const withShownSidebar = (router: DrawerRouterInstance, isCollapsed: () => boolean): DrawerRouterInstance => ({
    ...router,
    getStateForAction: (state, action, config) =>
        resolveAction({
            state,
            action,
            after: router.getStateForAction(state, action, config),
            isCollapsed: isCollapsed(),
            retry: (retried) => router.getStateForAction(retried, action, config),
        }),
    getStateForRouteFocus: (state, key) =>
        keepSidebarShown(state, router.getStateForRouteFocus(state, key), isCollapsed()),
});

const createDrawerRouter = (isCollapsed: () => boolean): DrawerRouterFactory => (options) =>
    withShownSidebar(DrawerRouter(options), isCollapsed);

export { createDrawerRouter, type DrawerRouterFactory };
