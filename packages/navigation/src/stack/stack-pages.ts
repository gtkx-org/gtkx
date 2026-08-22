import type { ParamListBase, RouteProp, StackNavigationState } from "@react-navigation/core";
import { useCallback, useState } from "react";
import type { StackDescriptor, StackDescriptorMap } from "./types.js";

type StackState = StackNavigationState<ParamListBase>;
type Describe = (route: RouteProp<ParamListBase>, isPlaceholder: boolean) => StackDescriptor;

type PageTracking = {
    order: readonly string[];
    focusedKey: string | undefined;
    descriptors: StackDescriptorMap;
    closing: StackDescriptorMap;
};

type StackPages = {
    pages: readonly StackDescriptor[];
    release: (key: string) => void;
};

const getFocusedKey = (state: StackState): string | undefined => state.routes[state.index]?.key;

const mountedKeys = (state: StackState): string[] => [
    ...state.routes.map((route) => route.key),
    ...state.preloadedRoutes.map((route) => route.key),
];

const neededKeys = (state: StackState, closing: StackDescriptorMap): string[] => [
    ...mountedKeys(state),
    ...Object.keys(closing),
];

const hasSameMembers = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((key) => right.includes(key));

const appendOrder = (previous: readonly string[], needed: readonly string[]): string[] => [
    ...previous.filter((key) => needed.includes(key)),
    ...needed.filter((key) => !previous.includes(key)),
];

const withoutKeys = (map: StackDescriptorMap, keys: readonly string[]): StackDescriptorMap =>
    Object.fromEntries(Object.entries(map).filter(([key]) => !keys.includes(key)));

const nextClosing = (tracking: PageTracking, state: StackState): StackDescriptorMap => {
    const mounted = mountedKeys(state);
    const kept = withoutKeys(tracking.closing, mounted);
    const { focusedKey } = tracking;

    if (focusedKey === undefined || mounted.includes(focusedKey)) {
        return kept;
    }

    const descriptor = tracking.descriptors[focusedKey];

    return descriptor === undefined ? kept : { ...kept, [focusedKey]: descriptor };
};

const advance = (tracking: PageTracking, state: StackState, descriptors: StackDescriptorMap): PageTracking => {
    const closing = nextClosing(tracking, state);

    return {
        order: appendOrder(tracking.order, neededKeys(state, closing)),
        focusedKey: getFocusedKey(state),
        descriptors: { ...tracking.descriptors, ...descriptors },
        closing,
    };
};

const initialTracking = (state: StackState, descriptors: StackDescriptorMap): PageTracking => ({
    order: neededKeys(state, {}),
    focusedKey: getFocusedKey(state),
    descriptors,
    closing: {},
});

const resolvePage = (
    key: string,
    sources: { state: StackState; descriptors: StackDescriptorMap; closing: StackDescriptorMap },
    describe: Describe,
): StackDescriptor | undefined => {
    const preloaded = sources.state.preloadedRoutes.find((route) => route.key === key);

    if (preloaded !== undefined) {
        return describe(preloaded, true);
    }

    return sources.descriptors[key] ?? sources.closing[key];
};

const useStackPages = (state: StackState, descriptors: StackDescriptorMap, describe: Describe): StackPages => {
    const [tracking, setTracking] = useState<PageTracking>(() => initialTracking(state, descriptors));

    if (!hasSameMembers(tracking.order, neededKeys(state, tracking.closing)) ||
        tracking.focusedKey !== getFocusedKey(state)) {
        setTracking(advance(tracking, state, descriptors));
    }

    const release = useCallback((key: string) => {
        setTracking((current) => (current.closing[key] === undefined
            ? current
            : {
                    ...current,
                    order: current.order.filter((entry) => entry !== key),
                    closing: withoutKeys(current.closing, [key]),
                }));
    }, []);

    const sources = { state, descriptors, closing: tracking.closing };

    const pages = tracking.order
        .map((key) => resolvePage(key, sources, describe))
        .filter((page) => page !== undefined);

    return { pages, release };
};

export { type Describe, useStackPages };
