import type { ParamListBase, RouteProp, StackNavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import { Component } from "react";
import type { StackDescriptor, StackDescriptorMap } from "./types.js";

type StackState = StackNavigationState<ParamListBase>;
type Describe = (route: RouteProp<ParamListBase>, isPlaceholder: boolean) => StackDescriptor;
type PageSnapshot = { descriptor: StackDescriptor; previous?: StackDescriptor };
type SnapshotMap = Readonly<Record<string, PageSnapshot | undefined>>;

type PageTracking = {
    order: readonly string[];
    focusedKey: string | undefined;
    closing: SnapshotMap;
    hidden: readonly string[];
};

type StackPagesValue = {
    pages: readonly PageSnapshot[];
    release: (key: string) => void;
    activate: (key: string) => void;
    isInitial: boolean;
};

type StackPagesProps = {
    state: StackState;
    descriptors: StackDescriptorMap;
    describe: Describe;
    offset: number;
    children: (value: StackPagesValue) => ReactNode;
};

type StackPagesState = PageTracking & { snapshots: SnapshotMap; isInitial: boolean };

const getFocusedKey = (state: StackState, offset: number): string | undefined =>
    state.index < offset ? undefined : state.routes[state.index]?.key;

const mountedKeys = (state: StackState, offset: number): string[] => [
    ...state.routes.slice(offset).map((route) => route.key),
    ...state.preloadedRoutes.map((route) => route.key),
];

const neededKeys = (state: StackState, closing: SnapshotMap, offset: number): string[] => [
    ...mountedKeys(state, offset),
    ...Object.keys(closing),
];

const hasSameMembers = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((key) => right.includes(key));

const appendOrder = (previous: readonly string[], needed: readonly string[]): string[] => [
    ...previous.filter((key) => needed.includes(key)),
    ...needed.filter((key) => !previous.includes(key)),
];

const withoutKeys = (map: SnapshotMap, keys: readonly string[]): SnapshotMap =>
    Object.fromEntries(Object.entries(map).filter(([key]) => !keys.includes(key)));

const nextClosing = (
    tracking: PageTracking,
    state: StackState,
    committed: SnapshotMap,
    offset: number,
): SnapshotMap => {
    const mounted = mountedKeys(state, offset);
    const kept = withoutKeys(tracking.closing, mounted);
    const { focusedKey } = tracking;

    if (focusedKey === undefined || mounted.includes(focusedKey) || tracking.hidden.includes(focusedKey)) {
        return kept;
    }

    const snapshot = committed[focusedKey];

    return snapshot === undefined ? kept : { ...kept, [focusedKey]: snapshot };
};

const advance = (
    tracking: PageTracking,
    state: StackState,
    committed: SnapshotMap,
    offset: number,
): PageTracking => {
    const closing = nextClosing(tracking, state, committed, offset);
    const retained = new Set(neededKeys(state, closing, offset));

    return {
        order: appendOrder(tracking.order, [...retained]),
        focusedKey: getFocusedKey(state, offset),
        closing,
        hidden: tracking.hidden.filter((key) => retained.has(key)),
    };
};

const initialTracking = (state: StackState, offset: number): PageTracking => ({
    order: mountedKeys(state, offset),
    focusedKey: getFocusedKey(state, offset),
    closing: {},
    hidden: [],
});

const activeSnapshots = (
    routes: StackState["routes"],
    descriptors: StackDescriptorMap,
): Record<string, PageSnapshot> => {
    const snapshots: Record<string, PageSnapshot> = {};

    for (const [index, route] of routes.entries()) {
        const descriptor = descriptors[route.key];

        if (descriptor === undefined) {
            continue;
        }

        const previousKey = routes[index - 1]?.key;

        snapshots[route.key] = previousKey === undefined
            ? { descriptor }
            : { descriptor, previous: descriptors[previousKey] };
    }

    return snapshots;
};

const preloadedSnapshots = (state: StackState, describe: Describe): Record<string, PageSnapshot> =>
    Object.fromEntries(state.preloadedRoutes.map((route) => [route.key, { descriptor: describe(route, true) }]));

const currentSnapshots = (
    state: StackState,
    descriptors: StackDescriptorMap,
    describe: Describe,
    offset: number,
): SnapshotMap => ({
    ...activeSnapshots(state.routes.slice(offset), descriptors),
    ...preloadedSnapshots(state, describe),
});

const initialStackPagesState = (props: StackPagesProps): StackPagesState => ({
    ...initialTracking(props.state, props.offset),
    snapshots: currentSnapshots(props.state, props.descriptors, props.describe, props.offset),
    isInitial: true,
});

const trackingFor = (props: StackPagesProps, state: StackPagesState): PageTracking => {
    const required = neededKeys(props.state, state.closing, props.offset);

    return hasSameMembers(state.order, required) && state.focusedKey === getFocusedKey(props.state, props.offset)
        ? state
        : advance(state, props.state, state.snapshots, props.offset);
};

class StackPages extends Component<StackPagesProps, StackPagesState> {
    static getDerivedStateFromProps(props: StackPagesProps, state: StackPagesState): StackPagesState {
        const tracking = trackingFor(props, state);

        return {
            order: tracking.order,
            focusedKey: tracking.focusedKey,
            closing: tracking.closing,
            hidden: tracking.hidden,
            snapshots: currentSnapshots(props.state, props.descriptors, props.describe, props.offset),
            isInitial: state.isInitial,
        };
    }

    private readonly release = (key: string): void => {
        this.setState((current) => {
            if (current.closing[key] === undefined) {
                return current.hidden.includes(key) ? null : { ...current, hidden: [...current.hidden, key] };
            }

            return {
                ...current,
                order: current.order.filter((entry) => entry !== key),
                closing: withoutKeys(current.closing, [key]),
                hidden: current.hidden.filter((entry) => entry !== key),
            };
        });
    };

    private readonly activate = (key: string): void => {
        this.setState((current) => current.hidden.includes(key)
            ? { ...current, hidden: current.hidden.filter((entry) => entry !== key) }
            : null);
    };

    override state: StackPagesState = initialStackPagesState(this.props);

    override componentDidMount(): void {
        this.setState({ isInitial: false });
    }

    override render(): ReactNode {
        const { order, snapshots, closing, isInitial } = this.state;

        const pages = order
            .map((key) => snapshots[key] ?? closing[key])
            .filter((page) => page !== undefined);

        return this.props.children({ pages, release: this.release, activate: this.activate, isInitial });
    }
}

export { type Describe, StackPages };
