import type { ParamListBase, RouterConfigOptions, StackNavigationState } from "@react-navigation/core";
import { StackRouter } from "@react-navigation/routers";

type StackState = StackNavigationState<ParamListBase>;
type StackRoute = StackState["routes"][number];
type StackRouterFactory = typeof StackRouter;
type StackRouterInstance = ReturnType<StackRouterFactory>;
type SidebarSlot = { route: StackRoute | undefined; serial: number };
type RouterAction = Parameters<StackRouterInstance["getStateForAction"]>[1];

const sidebarName = (config: RouterConfigOptions): string | undefined => config.routeNames[0];

const buildSidebarRoute = (slot: SidebarSlot, config: RouterConfigOptions, name: string): StackRoute => {
    slot.serial += 1;

    return { key: `${name}-sidebar-${String(slot.serial)}`, name, params: config.routeParamList[name] };
};

const resolveSidebarRoute = (slot: SidebarSlot, state: StackState, config: RouterConfigOptions): StackRoute => {
    const name = sidebarName(config) ?? "";
    const existing = state.routes.find((route) => route.name === name);

    return existing ?? slot.route ?? buildSidebarRoute(slot, config, name);
};

const pinSidebar = (slot: SidebarSlot, state: StackState, config: RouterConfigOptions): StackState => {
    const name = sidebarName(config);

    if (name === undefined || state.routes[0]?.name === name) {
        slot.route = state.routes[0];

        return state;
    }

    const sidebar = resolveSidebarRoute(slot, state, config);
    const routes = [sidebar, ...state.routes.filter((route) => route.name !== name)];
    const focusedKey = state.routes[state.index]?.key;
    const index = routes.findIndex((route) => route.key === focusedKey);
    slot.route = sidebar;

    return { ...state, routes, index: index === -1 ? routes.length - 1 : index };
};

const asSelection = (action: RouterAction): RouterAction => {
    if (action.type !== "NAVIGATE" || action.payload.pop !== undefined) {
        return action;
    }

    return { ...action, payload: { ...action.payload, pop: true } };
};

const pinActionResult = (
    slot: SidebarSlot,
    result: ReturnType<StackRouterInstance["getStateForAction"]>,
    config: RouterConfigOptions,
): ReturnType<StackRouterInstance["getStateForAction"]> =>
    result?.stale === false ? pinSidebar(slot, result, config) : result;

const withPinnedSidebar = (router: StackRouterInstance, slot: SidebarSlot): StackRouterInstance => ({
    ...router,
    getInitialState: (config) => pinSidebar(slot, router.getInitialState(config), config),
    getRehydratedState: (state, config) => pinSidebar(slot, router.getRehydratedState(state, config), config),
    getStateForRouteNamesChange: (state, config) =>
        pinSidebar(slot, router.getStateForRouteNamesChange(state, config), config),
    getStateForAction: (state, action, config) =>
        pinActionResult(slot, router.getStateForAction(state, asSelection(action), config), config),
});

const splitViewRouter: StackRouterFactory = (options) =>
    withPinnedSidebar(StackRouter(options), { route: undefined, serial: 0 });

export { splitViewRouter };
