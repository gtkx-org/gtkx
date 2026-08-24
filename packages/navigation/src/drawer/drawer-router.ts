import type { DrawerNavigationState, NavigationAction, ParamListBase, PartialState } from "@react-navigation/core";
import { DrawerRouter } from "@react-navigation/routers";
import { getDrawerStatus } from "./drawer-status.js";

type DrawerState = DrawerNavigationState<ParamListBase> & {
    gtkxCollapsed?: boolean;
    gtkxPinned?: boolean;
};

type DrawerRouterFactory = typeof DrawerRouter;
type DrawerRouterInstance = ReturnType<DrawerRouterFactory>;
type StateResult = DrawerState | PartialState<DrawerState> | null;
type Retry = (state: DrawerState) => StateResult;
type RouterConfig = Parameters<DrawerRouterInstance["getInitialState"]>[0];
type RouteNamesConfig = Parameters<DrawerRouterInstance["getStateForRouteNamesChange"]>[1];
type DrawerAction = Parameters<DrawerRouterInstance["getStateForAction"]>[1];
type RehydratedState = Parameters<DrawerRouterInstance["getRehydratedState"]>[0];

type DrawerRouterContext = {
    router: DrawerRouterInstance;
    initialMode: CollapsedMode;
};

type CollapsedMode = { isCollapsed: boolean; isPinned: boolean };

type ResolvedAction = {
    state: DrawerState;
    action: NavigationAction;
    after: StateResult;
    isCollapsed: boolean;
    retry: Retry;
};

const SET_DRAWER_COLLAPSED = "GTKX_SET_DRAWER_COLLAPSED";
const NAVIGATING_ACTIONS = new Set(["JUMP_TO", "NAVIGATE", "NAVIGATE_DEPRECATED"]);

const isSameRoutes = (left: DrawerState, right: DrawerState): boolean =>
    left.index === right.index &&
    left.routes.length === right.routes.length &&
    left.routes.every((route, index) => right.routes[index]?.key === route.key);

const reopenSidebar = (state: DrawerState): DrawerState => {
    const history = state.history.filter((entry) => entry.type !== "drawer");

    if (state.default === "open") {
        return { ...state, history };
    }

    return { ...state, history: [...history, { type: "drawer", status: "open" }] };
};

const closeSidebar = (state: DrawerState): DrawerState => {
    const history = state.history.filter((entry) => entry.type !== "drawer");

    if (state.default === "closed") {
        return { ...state, history };
    }

    return { ...state, history: [...history, { type: "drawer", status: "closed" }] };
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

const getCollapsedModeFromAction = (action: NavigationAction): CollapsedMode | undefined => {
    if (action.type !== SET_DRAWER_COLLAPSED || action.payload === undefined || !("collapsed" in action.payload)) {
        return undefined;
    }

    if (typeof action.payload.collapsed !== "boolean") {
        return undefined;
    }

    const isPinned = "pinSidebar" in action.payload && action.payload.pinSidebar === true;

    return { isCollapsed: action.payload.collapsed, isPinned };
};

const isDrawerCollapsed = (
    state: DrawerState | PartialState<DrawerState>,
    isCollapsedFallback = false,
): boolean =>
    "gtkxCollapsed" in state && typeof state.gtkxCollapsed === "boolean"
        ? state.gtkxCollapsed
        : isCollapsedFallback;

const isDrawerPinned = (
    state: DrawerState | PartialState<DrawerState>,
    isPinnedFallback = false,
): boolean =>
    "gtkxPinned" in state && typeof state.gtkxPinned === "boolean"
        ? state.gtkxPinned
        : isPinnedFallback;

const withMode = (state: DrawerState, mode: CollapsedMode): DrawerState => ({
    ...state,
    gtkxCollapsed: mode.isCollapsed,
    gtkxPinned: mode.isPinned,
});

const withCollapsedMode = (state: DrawerState, mode: CollapsedMode): DrawerState => {
    let normalized = state;

    if (!mode.isPinned) {
        normalized = mode.isCollapsed ? closeSidebar(state) : reopenSidebar(state);
    }

    return withMode(normalized, mode);
};

const withModeInResult = (state: StateResult, mode: CollapsedMode): StateResult =>
    state === null
        ? null
        : { ...state, gtkxCollapsed: mode.isCollapsed, gtkxPinned: mode.isPinned };

const closeAfterFocusedRouteChange = (before: DrawerState, after: DrawerState, isCollapsed: boolean): DrawerState => {
    const beforeKey = before.routes[before.index]?.key;
    const afterKey = after.routes[after.index]?.key;

    return isCollapsed && beforeKey !== afterKey && getDrawerStatus(after) === "open" ? closeSidebar(after) : after;
};

const closeAfterAction = (
    before: DrawerState,
    action: NavigationAction,
    after: DrawerState,
    isCollapsed: boolean,
): DrawerState => isCollapsed && NAVIGATING_ACTIONS.has(action.type) && getDrawerStatus(after) === "open"
    ? closeSidebar(after)
    : closeAfterFocusedRouteChange(before, after, isCollapsed);

const getInitialState = (
    router: DrawerRouterInstance,
    initialMode: CollapsedMode,
    config: RouterConfig,
): DrawerState => withMode(router.getInitialState(config), initialMode);

const getRehydratedState = (
    router: DrawerRouterInstance,
    initialMode: CollapsedMode,
    state: RehydratedState,
    config: RouterConfig,
): DrawerState => {
    const mode = {
        isCollapsed: isDrawerCollapsed(state, initialMode.isCollapsed),
        isPinned: isDrawerPinned(state, initialMode.isPinned),
    };

    return withMode(router.getRehydratedState(state, config), mode);
};

const getStateForRouteNamesChange = (
    router: DrawerRouterInstance,
    initialMode: CollapsedMode,
    state: DrawerState,
    config: RouteNamesConfig,
): DrawerState => {
    const mode = {
        isCollapsed: isDrawerCollapsed(state, initialMode.isCollapsed),
        isPinned: isDrawerPinned(state, initialMode.isPinned),
    };

    const after = withMode(router.getStateForRouteNamesChange(state, config), mode);

    return closeAfterFocusedRouteChange(state, after, mode.isCollapsed);
};

const getStateForAction = (
    context: DrawerRouterContext,
    state: DrawerState,
    action: DrawerAction,
    config: RouterConfig,
): StateResult => {
    const collapsedMode = getCollapsedModeFromAction(action);

    if (collapsedMode !== undefined) {
        const isTargetedHere = action.target === undefined || action.target === state.key;

        return isTargetedHere ? withCollapsedMode(state, collapsedMode) : null;
    }

    const mode = {
        isCollapsed: isDrawerCollapsed(state, context.initialMode.isCollapsed),
        isPinned: isDrawerPinned(state, context.initialMode.isPinned),
    };

    const after = resolveAction({
        state,
        action,
        after: context.router.getStateForAction(state, action, config),
        isCollapsed: mode.isCollapsed,
        retry: (retried) => context.router.getStateForAction(retried, action, config),
    });

    const closed = after?.stale === false
        ? closeAfterAction(state, action, after, mode.isCollapsed)
        : after;

    return withModeInResult(closed, mode);
};

const getStateForRouteFocus = (
    router: DrawerRouterInstance,
    initialMode: CollapsedMode,
    state: DrawerState,
    key: string,
): DrawerState => {
    const mode = {
        isCollapsed: isDrawerCollapsed(state, initialMode.isCollapsed),
        isPinned: isDrawerPinned(state, initialMode.isPinned),
    };

    const after = keepSidebarShown(state, router.getStateForRouteFocus(state, key), mode.isCollapsed);
    const closed = closeAfterFocusedRouteChange(state, after, mode.isCollapsed);

    return withMode(closed, mode);
};

const withShownSidebar = (router: DrawerRouterInstance, initialMode: CollapsedMode): DrawerRouterInstance => ({
    ...router,
    getInitialState: getInitialState.bind(undefined, router, initialMode),
    getRehydratedState: getRehydratedState.bind(undefined, router, initialMode),
    getStateForRouteNamesChange: getStateForRouteNamesChange.bind(undefined, router, initialMode),
    getStateForAction: getStateForAction.bind(undefined, { router, initialMode }),
    getStateForRouteFocus: getStateForRouteFocus.bind(undefined, router, initialMode),
});

const createDrawerRouter = (isInitiallyCollapsed: boolean, isInitiallyPinned: boolean): DrawerRouterFactory =>
    (options) => withShownSidebar(DrawerRouter(options), {
        isCollapsed: isInitiallyCollapsed,
        isPinned: isInitiallyPinned,
    });

const setDrawerCollapsed = (isCollapsed: boolean, isPinned: boolean, target: string): NavigationAction => ({
    type: SET_DRAWER_COLLAPSED,
    payload: { collapsed: isCollapsed, pinSidebar: isPinned },
    target,
});

export {
    createDrawerRouter,
    isDrawerCollapsed,
    isDrawerPinned,
    setDrawerCollapsed,
    type DrawerRouterFactory,
};
