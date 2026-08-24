import type { ParamListBase, RouterConfigOptions, StackNavigationState } from "@react-navigation/core";
import { StackRouter } from "@react-navigation/routers";

type StackState = StackNavigationState<ParamListBase>;
type StackRoute = StackState["routes"][number];
type StackRouterFactory = typeof StackRouter;
type StackRouterInstance = ReturnType<StackRouterFactory>;
type RouterAction = Parameters<StackRouterInstance["getStateForAction"]>[1];
type RouterResult = ReturnType<StackRouterInstance["getStateForAction"]>;

type CanonicalContext = {
    action: RouterAction | undefined;
    before: StackState | undefined;
    config: RouterConfigOptions;
    name: string;
    previousCanonical: StackRoute | undefined;
    router: StackRouterInstance;
    shouldReplaceCanonical: boolean;
    state: StackState;
};

type PinContext = Omit<CanonicalContext, "name" | "previousCanonical">;

type ActionResultContext = {
    action: RouterAction;
    before: StackState;
    config: RouterConfigOptions;
    result: RouterResult;
    router: StackRouterInstance;
};

const sidebarName = (config: RouterConfigOptions): string | undefined => config.routeNames[0];

const buildSidebarRoute = (
    context: CanonicalContext,
    source?: StackRoute,
): StackRoute => {
    const routes = context.state.routes.filter((route) => route.name !== context.name);
    const preloadedRoutes = context.state.preloadedRoutes.filter((route) => route.name !== context.name);
    const seed = { ...context.state, routes, preloadedRoutes, index: Math.max(0, routes.length - 1) };

    const payload = source?.params === undefined
        ? { name: context.name }
        : { name: context.name, params: source.params };

    const result = context.router.getStateForAction(seed, { type: "PUSH", payload }, context.config);
    const generated = result?.stale === false ? result.routes[result.index] : undefined;

    if (generated?.name !== context.name) {
        throw new Error("The split view router could not create its sidebar route");
    }

    return source === undefined
        ? generated
        : { ...generated, ...source, key: generated.key, name: context.name };
};

const actionRouteName = (action: RouterAction | undefined): string | undefined => {
    if (action === undefined || !("payload" in action) || action.payload === undefined ||
        !("name" in action.payload)) {
        return undefined;
    }

    return action.payload.name;
};

const isSidebarSelection = (action: RouterAction | undefined, name: string): boolean =>
    action?.type !== "PRELOAD" && actionRouteName(action) === name;

const findRouteByKey = (routes: readonly StackRoute[], key: string | undefined): StackRoute | undefined =>
    key === undefined ? undefined : routes.find((route) => route.key === key);

const findNamedRoute = (routes: readonly StackRoute[], name: string): StackRoute | undefined =>
    routes.find((route) => route.name === name);

const findReplacementRoute = (
    routes: readonly StackRoute[],
    name: string,
    cachedKey: string | undefined,
): StackRoute | undefined => routes.findLast((route) => route.name === name && route.key !== cachedKey);

const sidebarCandidate = (
    previousCanonical: StackRoute | undefined,
    state: StackState,
    name: string,
    action: RouterAction | undefined,
): StackRoute | undefined => {
    const focused = state.routes[state.index];

    if (focused?.name === name) {
        return focused;
    }

    const current = findRouteByKey(state.routes, previousCanonical?.key);
    const existing = findNamedRoute(state.routes, name);

    if (!isSidebarSelection(action, name)) {
        return current ?? existing;
    }

    return findReplacementRoute(state.routes, name, previousCanonical?.key) ?? current ?? existing;
};

const replacementSidebar = (
    context: CanonicalContext,
    candidate: StackRoute | undefined,
    cached: StackRoute | undefined,
): StackRoute => {
    if (candidate !== undefined && candidate.key !== cached?.key) {
        return candidate;
    }

    return buildSidebarRoute(context, candidate);
};

const stableSidebar = (
    context: CanonicalContext,
    candidate: StackRoute | undefined,
    cached: StackRoute | undefined,
): StackRoute => {
    if (cached === undefined) {
        return candidate ?? buildSidebarRoute(context);
    }

    if (candidate === undefined || candidate === cached) {
        return cached;
    }

    return candidate.key === cached.key ? candidate : { ...candidate, key: cached.key };
};

const canonicalSidebar = (context: CanonicalContext): StackRoute => {
    const cached = context.previousCanonical?.name === context.name ? context.previousCanonical : undefined;
    const candidate = sidebarCandidate(cached, context.state, context.name, context.action);

    if (context.shouldReplaceCanonical) {
        return replacementSidebar(context, candidate, cached);
    }

    return stableSidebar(context, candidate, cached);
};

const withoutCanonical = (
    routes: readonly StackRoute[],
    name: string,
    previousKey: string | undefined,
): StackRoute[] => routes.filter((route) => route.name !== name && route.key !== previousKey);

const isFocusedSidebar = (
    focused: StackRoute | undefined,
    previousCanonical: StackRoute | undefined,
    action: RouterAction | undefined,
    name: string,
): boolean => isSidebarSelection(action, name) ||
    focused?.name === name ||
    focused?.key === previousCanonical?.key;

const routesThroughFocus = (
    sidebar: StackRoute,
    content: readonly StackRoute[],
    focused: StackRoute | undefined,
    isSidebarFocused: boolean,
): StackRoute[] => {
    if (isSidebarFocused || focused === undefined) {
        return [sidebar];
    }

    const focusedIndex = content.findIndex((route) => route.key === focused.key);

    return focusedIndex === -1 ? [sidebar] : [sidebar, ...content.slice(0, focusedIndex + 1)];
};

const pinSidebar = (
    context: PinContext,
): StackState => {
    const name = sidebarName(context.config);

    if (name === undefined) {
        return context.state;
    }

    const previousCanonical = context.before?.routes[0];

    const shouldReplaceCanonical = context.shouldReplaceCanonical ||
        (previousCanonical !== undefined && previousCanonical.name !== name);

    const focused = context.state.routes[context.state.index];

    const sidebar = canonicalSidebar({
        ...context,
        name,
        previousCanonical,
        shouldReplaceCanonical,
    });

    const content = withoutCanonical(context.state.routes, name, previousCanonical?.key);

    const routes = routesThroughFocus(
        sidebar,
        content,
        focused,
        isFocusedSidebar(focused, previousCanonical, context.action, name),
    );

    const preloadedRoutes = withoutCanonical(context.state.preloadedRoutes, name, previousCanonical?.key);

    return { ...context.state, routes, preloadedRoutes, index: routes.length - 1 };
};

const asSelection = (action: RouterAction): RouterAction => {
    if (action.type !== "NAVIGATE" || action.payload.pop !== undefined) {
        return action;
    }

    return { ...action, payload: { ...action.payload, pop: true } };
};

const pinActionResult = (
    context: ActionResultContext,
): RouterResult => {
    if (context.result === null) {
        return null;
    }

    const state = context.result.stale === false
        ? context.result
        : context.router.getRehydratedState(context.result, context.config);

    return pinSidebar({
        action: context.action,
        before: context.before,
        config: context.config,
        router: context.router,
        shouldReplaceCanonical: false,
        state,
    });
};

const retargetSidebarReplace = (
    state: StackState,
    action: RouterAction,
    config: RouterConfigOptions,
): RouterAction => {
    if (action.type !== "REPLACE" || action.target !== state.key) {
        return action;
    }

    const name = sidebarName(config);
    const canonical = state.routes[0]?.name === name ? state.routes[0] : undefined;
    const focused = state.routes[state.index];

    if (canonical === undefined || focused === undefined || focused.key === canonical.key ||
        action.source !== canonical.key || action.payload.name === name) {
        return action;
    }

    return { ...action, source: focused.key };
};

const normalizeState = (
    router: StackRouterInstance,
    state: StackState,
    config: RouterConfigOptions,
): StackState => pinSidebar({
    action: undefined,
    before: undefined,
    config,
    router,
    shouldReplaceCanonical: false,
    state,
});

const withPinnedSidebar = (router: StackRouterInstance): StackRouterInstance => ({
    ...router,
    getInitialState: (config) => normalizeState(router, router.getInitialState(config), config),
    getRehydratedState: (state, config) => normalizeState(router, router.getRehydratedState(state, config), config),
    getStateForRouteNamesChange: (state, config) => {
        const name = sidebarName(config);

        return pinSidebar({
            action: undefined,
            before: state,
            config,
            router,
            shouldReplaceCanonical: name !== undefined && config.routeKeyChanges.includes(name),
            state: router.getStateForRouteNamesChange(state, config),
        });
    },
    getStateForAction: (state, action, config) => {
        const resolvedAction = retargetSidebarReplace(state, asSelection(action), config);

        return pinActionResult({
            action: resolvedAction,
            before: state,
            config,
            result: router.getStateForAction(state, resolvedAction, config),
            router,
        });
    },
});

const splitViewRouter: StackRouterFactory = (options) =>
    withPinnedSidebar(StackRouter(options));

export { splitViewRouter };
