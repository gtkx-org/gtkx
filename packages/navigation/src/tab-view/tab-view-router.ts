import type {
    CommonNavigationAction,
    NavigationAction,
    ParamListBase,
    PartialState,
    Router,
    RouterConfigOptions,
} from "@react-navigation/core";
import { BaseRouter } from "@react-navigation/routers";
import type { TabViewActionType, TabViewNavigationState, TabViewOpenOptions, TabViewRouterOptions } from "./types.js";

type State = TabViewNavigationState<ParamListBase>;
type Route = State["routes"][number];
type Action = TabViewActionType | CommonNavigationAction;
type Result = State | PartialState<State> | null;
type OpenTabAction = Extract<TabViewActionType, { type: "OPEN_TAB" }>;
type OpenPayload = OpenTabAction["payload"];
type Placement = Pick<State, "routes" | "index" | "pinnedKeys" | "parents">;

/** A page already in the native view when the navigator mounts. */
type ExistingTab = {
    route: Route;
    pinned: boolean;
    parent?: string;
    selected: boolean;
};

type CloseRange = "CLOSE_OTHER_TABS" | "CLOSE_TABS_BEFORE" | "CLOSE_TABS_AFTER";

type TabViewRouterFactory = (options: TabViewRouterOptions) => Router<State, Action>;

const TabViewActions = {
    openTab: (name: string, params?: object, options: TabViewOpenOptions = {}): TabViewActionType => ({
        type: "OPEN_TAB",
        payload: { name, params, ...options },
    }),
    closeTab: (key?: string): TabViewActionType => ({ type: "CLOSE_TAB", payload: { key } }),
    closeOtherTabs: (key?: string): TabViewActionType => ({ type: "CLOSE_OTHER_TABS", payload: { key } }),
    closeTabsBefore: (key?: string): TabViewActionType => ({ type: "CLOSE_TABS_BEFORE", payload: { key } }),
    closeTabsAfter: (key?: string): TabViewActionType => ({ type: "CLOSE_TABS_AFTER", payload: { key } }),
    selectTab: (key: string): TabViewActionType => ({ type: "SELECT_TAB", payload: { key } }),
    reorderTab: (key: string, position: number): TabViewActionType => ({
        type: "REORDER_TAB",
        payload: { key, position },
    }),
    pinTab: (key: string, pinned: boolean): TabViewActionType => ({ type: "PIN_TAB", payload: { key, pinned } }),
};

const createRouteKey = (name: string): string => `${name}-${crypto.randomUUID()}`;

const mergeParams = (defaults: object | undefined, params: object | undefined): object | undefined =>
    defaults === undefined ? params : { ...defaults, ...params };

const indexOfKey = (routes: readonly Route[], key: string | undefined): number =>
    key === undefined ? -1 : routes.findIndex((route) => route.key === key);

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const isOpenTab = (action: NavigationAction): action is OpenTabAction => action.type === "OPEN_TAB";

const focusedKey = (state: Pick<State, "routes" | "index">): string | undefined => state.routes[state.index]?.key;

const hasRoute = (state: Pick<State, "routes">, key: string): boolean =>
    state.routes.some((route) => route.key === key);

const closeRanges: Record<CloseRange, (position: number, target: number) => boolean> = {
    CLOSE_OTHER_TABS: () => true,
    CLOSE_TABS_BEFORE: (position, target) => position < target,
    CLOSE_TABS_AFTER: (position, target) => position > target,
};

const withRoutes = (state: State, routes: Route[], focused: string | undefined): State => ({
    ...state,
    routes,
    index: Math.max(indexOfKey(routes, focused), 0),
});

const isDescendantOf = (parents: Record<string, string>, key: string, ancestor: string): boolean => {
    const seen = new Set<string>();
    let current: string | undefined = key;

    while (current !== undefined && !seen.has(current)) {
        if (current === ancestor) {
            return true;
        }

        seen.add(current);
        current = parents[current];
    }

    return false;
};

const pruneParents = (routes: readonly Route[], parents: Record<string, string>): Record<string, string> => {
    const kept: Record<string, string> = {};

    for (const route of routes) {
        let current: string | undefined = route.key;

        while (current !== undefined && !(current in kept)) {
            const parent: string | undefined = parents[current];

            if (parent === undefined) {
                break;
            }

            kept[current] = parent;
            current = parent;
        }
    }

    return kept;
};

const childPosition = (state: State, parent: string): number => {
    let position = state.pinnedKeys.includes(parent) ? state.pinnedKeys.length - 1 : indexOfKey(state.routes, parent);

    for (;;) {
        position += 1;
        const route = state.routes[position];

        if (route === undefined || !isDescendantOf(state.parents, route.key, parent)) {
            return position;
        }
    }
};

const selectAfterClose = (state: State, position: number): Route | undefined => {
    const route = state.routes[position];
    const parent = route === undefined ? undefined : state.parents[route.key];
    const previous = state.routes[position - 1];

    if (parent !== undefined && previous !== undefined) {
        if (isDescendantOf(state.parents, previous.key, parent)) {
            return previous;
        }

        if (state.pinnedKeys.includes(previous.key) && state.pinnedKeys.includes(parent)) {
            return state.routes.find((candidate) => candidate.key === parent) ?? previous;
        }
    }

    return state.routes[position + 1] ?? previous;
};

const closeOne = (state: State, key: string): State | null => {
    const position = indexOfKey(state.routes, key);

    if (position === -1) {
        return state;
    }

    if (state.routes.length === 1) {
        return null;
    }

    const focused = focusedKey(state) === key ? selectAfterClose(state, position)?.key : focusedKey(state);
    const routes = state.routes.filter((route) => route.key !== key);

    return {
        ...withRoutes(state, routes, focused),
        pinnedKeys: state.pinnedKeys.filter((pinned) => pinned !== key),
        parents: pruneParents(routes, state.parents),
    };
};

const closeMany = (state: State, keys: readonly string[]): State | null => {
    const ordered = [...keys].sort((left, right) => indexOfKey(state.routes, right) - indexOfKey(state.routes, left));
    let next = state;

    for (const key of ordered) {
        const result = closeOne(next, key);

        if (result === null) {
            return null;
        }

        next = result;
    }

    return next;
};

const unpinnedKeys = (state: State, target: number, keep: (position: number, target: number) => boolean): string[] =>
    state.routes
        .filter(
            (route, position) => position !== target && !state.pinnedKeys.includes(route.key) && keep(position, target),
        )
        .map((route) => route.key);

const openTab = (state: State, payload: OpenPayload, { routeNames, routeParamList }: RouterConfigOptions): Result => {
    const { name, key, select, position, pinned = false } = payload;

    if (!routeNames.includes(name)) {
        return null;
    }

    const existing = indexOfKey(state.routes, key);

    if (existing !== -1) {
        return select === false ? state : { ...state, index: existing };
    }

    const route: Route = {
        key: key ?? createRouteKey(name),
        name,
        params: mergeParams(routeParamList[name], payload.params),
    };
    const parent =
        payload.parent !== undefined && indexOfKey(state.routes, payload.parent) !== -1 ? payload.parent : undefined;
    const pinnedCount = state.pinnedKeys.length;
    const index = pinned
        ? clamp(position ?? pinnedCount, 0, pinnedCount)
        : position !== undefined
          ? clamp(position, pinnedCount, state.routes.length)
          : parent !== undefined
            ? childPosition(state, parent)
            : state.routes.length;
    const routes = [...state.routes.slice(0, index), route, ...state.routes.slice(index)];

    return {
        ...withRoutes(state, routes, select === false ? focusedKey(state) : route.key),
        pinnedKeys: pinned
            ? [...state.pinnedKeys.slice(0, index), route.key, ...state.pinnedKeys.slice(index)]
            : state.pinnedKeys,
        parents: parent === undefined ? state.parents : { ...state.parents, [route.key]: parent },
    };
};

const selectTab = (state: State, key: string): State | null => {
    const index = indexOfKey(state.routes, key);

    if (index === -1) {
        return null;
    }

    return index === state.index ? state : { ...state, index };
};

const moveRoute = (state: State, key: string, position: number): State => {
    const route = state.routes.find((candidate) => candidate.key === key);

    if (route === undefined) {
        return state;
    }

    const others = state.routes.filter((candidate) => candidate.key !== key);

    return withRoutes(state, [...others.slice(0, position), route, ...others.slice(position)], focusedKey(state));
};

const reorderTab = (state: State, key: string, position: number): State | null => {
    const from = indexOfKey(state.routes, key);

    if (from === -1) {
        return null;
    }

    const pinnedCount = state.pinnedKeys.length;
    const isPinned = state.pinnedKeys.includes(key);
    const target = isPinned
        ? clamp(position, 0, pinnedCount - 1)
        : clamp(position, pinnedCount, state.routes.length - 1);

    if (target === from) {
        return state;
    }

    const moved = moveRoute(state, key, target);

    return isPinned ? { ...moved, pinnedKeys: moved.routes.slice(0, pinnedCount).map((route) => route.key) } : moved;
};

const pinTab = (state: State, key: string, pinned: boolean): State | null => {
    if (indexOfKey(state.routes, key) === -1) {
        return null;
    }

    if (state.pinnedKeys.includes(key) === pinned) {
        return state;
    }

    const pinnedCount = state.pinnedKeys.length;
    const moved = moveRoute(state, key, pinned ? pinnedCount : pinnedCount - 1);

    return {
        ...moved,
        pinnedKeys: pinned ? [...state.pinnedKeys, key] : state.pinnedKeys.filter((candidate) => candidate !== key),
    };
};

const navigate = (
    state: State,
    payload: { name: string; params?: object; merge?: boolean },
    options: RouterConfigOptions,
): Result => {
    if (!options.routeNames.includes(payload.name)) {
        return null;
    }

    for (let index = state.routes.length - 1; index >= 0; index -= 1) {
        const route = state.routes[index];

        if (route?.name === payload.name) {
            if (payload.params === undefined) {
                return { ...state, index };
            }

            const params = payload.merge === true ? { ...route.params, ...payload.params } : payload.params;

            return {
                ...state,
                index,
                routes: state.routes.map((candidate) => (candidate === route ? { ...route, params } : candidate)),
            };
        }
    }

    return openTab(state, { name: payload.name, params: payload.params }, options);
};

const initialRouteName = (options: TabViewRouterOptions, routeNames: string[]): string => {
    const name =
        options.initialRouteName !== undefined && routeNames.includes(options.initialRouteName)
            ? options.initialRouteName
            : routeNames[0];

    if (name === undefined) {
        throw new Error("A tab view navigator needs at least one screen.");
    }

    return name;
};

const initialPlacement = (
    options: TabViewRouterOptions,
    { routeNames, routeParamList }: RouterConfigOptions,
): Placement => {
    const name = initialRouteName(options, routeNames);

    return {
        routes: [{ key: createRouteKey(name), name, params: routeParamList[name] }],
        index: 0,
        pinnedKeys: [],
        parents: {},
    };
};

const existingPlacement = (tabs: readonly ExistingTab[], { routeParamList }: RouterConfigOptions): Placement => ({
    routes: tabs.map(({ route }) => ({ ...route, params: mergeParams(routeParamList[route.name], route.params) })),
    index: Math.max(
        tabs.findIndex((tab) => tab.selected),
        0,
    ),
    pinnedKeys: tabs.filter((tab) => tab.pinned).map((tab) => tab.route.key),
    parents: Object.fromEntries(
        tabs.flatMap((tab) =>
            tab.parent !== undefined && tabs.some((candidate) => candidate.route.key === tab.parent)
                ? [[tab.route.key, tab.parent]]
                : [],
        ),
    ),
});

const freshState = (placement: Placement, routeNames: string[]): State => ({
    stale: false,
    type: "tabview",
    key: `tabview-${crypto.randomUUID()}`,
    routeNames,
    ...placement,
});

/**
 * Creates the router factory of a tab view navigator.
 *
 * @param readExistingTabs Returns the pages already in the view when the navigator mounts, in view order.
 */
const createTabViewRouter =
    (readExistingTabs: () => readonly ExistingTab[]): TabViewRouterFactory =>
    (options) => ({
        ...BaseRouter,
        type: "tabview",

        getInitialState(config) {
            const existing = readExistingTabs().filter((tab) => config.routeNames.includes(tab.route.name));

            return freshState(
                existing.length === 0 ? initialPlacement(options, config) : existingPlacement(existing, config),
                config.routeNames,
            );
        },

        getRehydratedState(partialState, config) {
            if (partialState.stale === false) {
                return partialState;
            }

            const { routeNames, routeParamList } = config;
            const known = partialState.routes
                .filter((route) => routeNames.includes(route.name))
                .map((route) => ({
                    ...route,
                    key: route.key ?? createRouteKey(route.name),
                    params: mergeParams(routeParamList[route.name], route.params),
                }));
            const pinned = new Set(partialState.pinnedKeys ?? []);
            const pinnedRoutes = known.filter((route) => pinned.has(route.key));
            const routes = [...pinnedRoutes, ...known.filter((route) => !pinned.has(route.key))];

            if (routes.length === 0) {
                return freshState(initialPlacement(options, config), routeNames);
            }

            return freshState(
                {
                    routes,
                    index: clamp(partialState.index ?? 0, 0, routes.length - 1),
                    pinnedKeys: pinnedRoutes.map((route) => route.key),
                    parents: pruneParents(routes, partialState.parents ?? {}),
                },
                routeNames,
            );
        },

        getStateForRouteNamesChange(state, config) {
            const { routeNames, routeKeyChanges } = config;
            const routes = state.routes.filter(
                (route) => routeNames.includes(route.name) && !routeKeyChanges.includes(route.name),
            );

            if (routes.length === 0) {
                return freshState(initialPlacement(options, config), routeNames);
            }

            const keys = new Set(routes.map((route) => route.key));

            return {
                ...withRoutes(state, routes, focusedKey(state)),
                routeNames,
                pinnedKeys: state.pinnedKeys.filter((key) => keys.has(key)),
                parents: pruneParents(routes, state.parents),
            };
        },

        getStateForRouteFocus(state, key) {
            return selectTab(state, key) ?? state;
        },

        getStateForAction(state, action, config) {
            switch (action.type) {
                case "OPEN_TAB":
                    return openTab(state, action.payload, config);
                case "CLOSE_TAB": {
                    const key = action.payload.key ?? focusedKey(state);

                    return key === undefined ? null : closeOne(state, key);
                }
                case "CLOSE_OTHER_TABS":
                case "CLOSE_TABS_BEFORE":
                case "CLOSE_TABS_AFTER": {
                    const target = indexOfKey(state.routes, action.payload.key ?? focusedKey(state));

                    return target === -1
                        ? state
                        : closeMany(state, unpinnedKeys(state, target, closeRanges[action.type]));
                }
                case "SELECT_TAB":
                    return selectTab(state, action.payload.key);
                case "REORDER_TAB":
                    return reorderTab(state, action.payload.key, action.payload.position);
                case "PIN_TAB":
                    return pinTab(state, action.payload.key, action.payload.pinned);
                case "NAVIGATE":
                    return navigate(state, action.payload, config);
                default:
                    return BaseRouter.getStateForAction(state, action);
            }
        },

        shouldActionChangeFocus(action) {
            return (
                action.type === "NAVIGATE" ||
                action.type === "SELECT_TAB" ||
                (isOpenTab(action) && action.payload.select !== false)
            );
        },

        actionCreators: TabViewActions,
    });

export { createRouteKey, createTabViewRouter, type ExistingTab, focusedKey, hasRoute, TabViewActions };
