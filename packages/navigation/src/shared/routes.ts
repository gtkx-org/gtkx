import type { NavigationState } from "@react-navigation/core";

type FocusedRoute<State extends NavigationState> = State["routes"][number];

const getFocusedRoute = <State extends NavigationState>(state: State): FocusedRoute<State> => {
    const route = state.routes[state.index];

    if (route === undefined) {
        throw new Error(`Navigation state has no route at index ${String(state.index)}`);
    }

    return route;
};

const requireDescriptor = <Descriptor>(descriptors: Record<string, Descriptor>, key: string): Descriptor => {
    const descriptor = descriptors[key];

    if (descriptor === undefined) {
        throw new Error(`No descriptor for route "${key}"`);
    }

    return descriptor;
};

export { getFocusedRoute, requireDescriptor };
