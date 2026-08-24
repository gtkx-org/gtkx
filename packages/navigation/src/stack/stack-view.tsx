import type { NavigationStackEntry } from "@gtkx/react/adw";
import type { ParamListBase, StackNavigationState } from "@react-navigation/core";
import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import { AdwNavigationPage, AdwNavigationView, AdwToolbarView } from "@gtkx/jsx/adw";
import { StackActions, usePreventRemoveContext } from "@react-navigation/core";
import { Component, useEffect } from "react";
import type { Describe } from "./stack-pages.js";
import type {
    StackDescriptor,
    StackDescriptorMap,
    StackNavigationConfig,
    StackNavigationEventMap,
    StackNavigationHelpers,
} from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { StackPages } from "./stack-pages.js";

type StackViewProps = StackNavigationConfig & {
    state: StackNavigationState<ParamListBase>;
    navigation: StackNavigationHelpers;
    descriptors: StackDescriptorMap;
    describe: Describe;
    offset?: number;
};

type StackPageProps = {
    descriptor: StackDescriptor;
    previous?: StackDescriptor;
    navigation: StackNavigationHelpers;
    onHidden: (key: string) => void;
    onShowing: (key: string) => void;
    suppressInitialTransition: boolean;
    dispatchTransition: StackEventBindings["dispatchTransition"];
};

type StackPageContentProps = Pick<
    StackPageProps,
    "descriptor" | "previous"
>;

type TransitionEvent = keyof StackNavigationEventMap;

type PendingTransition = {
    navigation: StackNavigationHelpers;
    key: string;
    type: TransitionEvent;
    isClosing: boolean;
    shouldEmit: boolean;
    after?: () => void;
};

type StackEventBindings = {
    dispatchTransition: (transition: PendingTransition) => void;
    onPopped: (page: Adw.NavigationPage) => void;
};

type StackEventCoordinatorProps = {
    navigation: StackNavigationHelpers;
    protectedRouteKeys: ReadonlySet<string>;
    children: (bindings: StackEventBindings) => ReactNode;
};

type NativePopReconciliation = {
    source: string;
    target: string;
    count: number;
};

type NativeTransitionBuffer = {
    source: string;
    transitions: PendingTransition[];
};

type StackPageTransition = Pick<
    StackPageProps,
    "navigation" | "onHidden" | "onShowing" | "suppressInitialTransition"
> & Pick<StackEventBindings, "dispatchTransition"> & { key: string };

const isShowingEndFor = (transition: PendingTransition, key: string): boolean =>
    transition.key === key && transition.type === "transitionEnd" && !transition.isClosing;

const isNativePopTransition = (transition: PendingTransition, focused: string): boolean =>
    transition.type === "transitionStart" && (
        transition.isClosing ? transition.key === focused : transition.key !== focused
    );

const nativePopSource = (
    transition: PendingTransition,
    protectedRouteKeys: ReadonlySet<string>,
): string | null => {
    if (protectedRouteKeys.size === 0) {
        return null;
    }

    const state = transition.navigation.getState();
    const focused = state.routes[state.index]?.key;

    return focused !== undefined && isNativePopTransition(transition, focused) ? focused : null;
};

const emitTransition = (
    navigation: StackNavigationHelpers,
    key: string,
    type: TransitionEvent,
    isClosing: boolean,
): void => {
    navigation.emit({ type, data: { closing: isClosing }, target: key });
};

const deliverTransition = (transition: PendingTransition): void => {
    try {
        if (transition.shouldEmit) {
            emitTransition(transition.navigation, transition.key, transition.type, transition.isClosing);
        }
    } finally {
        transition.after?.();
    }
};

const startShowing = (transition: StackPageTransition): void => {
    transition.dispatchTransition({
        navigation: transition.navigation,
        key: transition.key,
        type: "transitionStart",
        isClosing: false,
        shouldEmit: !transition.suppressInitialTransition,
        after: () => {
            transition.onShowing(transition.key);
        },
    });
};

const startHiding = (transition: StackPageTransition): void => {
    transition.dispatchTransition({
        navigation: transition.navigation,
        key: transition.key,
        type: "transitionStart",
        isClosing: true,
        shouldEmit: !transition.suppressInitialTransition,
    });
};

const finishShowing = (transition: StackPageTransition): void => {
    transition.dispatchTransition({
        navigation: transition.navigation,
        key: transition.key,
        type: "transitionEnd",
        isClosing: false,
        shouldEmit: !transition.suppressInitialTransition,
    });
};

const finishHiding = (transition: StackPageTransition): void => {
    transition.dispatchTransition({
        navigation: transition.navigation,
        key: transition.key,
        type: "transitionEnd",
        isClosing: true,
        shouldEmit: !transition.suppressInitialTransition,
        after: () => {
            transition.onHidden(transition.key);
        },
    });
};

const transitionHandlers = (transition: StackPageTransition) => ({
    onShowing: (): void => {
        startShowing(transition);
    },
    onHiding: (): void => {
        startHiding(transition);
    },
    onShown: (): void => {
        finishShowing(transition);
    },
    onHidden: (): void => {
        finishHiding(transition);
    },
});

const PassiveEffectsReady = ({ onReady }: { onReady: () => void }): null => {
    useEffect(() => {
        onReady();
    });

    return null;
};

const navigationStack = (
    state: StackNavigationState<ParamListBase>,
    descriptors: StackDescriptorMap,
    offset: number,
): NavigationStackEntry[] => state.routes.slice(offset).map((route) => ({
    tag: route.key,
    animateTransitions: descriptors[route.key]?.options.animation !== "none",
}));

const defaultStackHeader = ({ descriptor }: StackPageContentProps): ReactNode => {
    const { options } = descriptor;
    const shouldShowBackButton = options.headerBackVisible ?? true;

    return (
        <HeaderBar
            options={options}
            showBackButton={shouldShowBackButton}
        />
    );
};

const stackHeader = (props: StackPageContentProps): ReactNode => {
    const { descriptor, previous } = props;
    const { route, options, navigation } = descriptor;
    const back = previous === undefined ? undefined : { title: previous.options.title ?? previous.route.name };

    return options.header === undefined
        ? defaultStackHeader(props)
        : <>{options.header({ route, navigation, options, back })}</>;
};

const StackPageContent = ({
    descriptor,
    previous,
}: StackPageContentProps): ReactNode => {
    const { options } = descriptor;

    if (options.headerShown === false) {
        return descriptor.render();
    }

    return (
        <AdwToolbarView topBar={stackHeader({ descriptor, previous })}>
            {descriptor.render()}
        </AdwToolbarView>
    );
};

const StackPage = ({
    descriptor,
    previous,
    navigation,
    onHidden,
    onShowing,
    suppressInitialTransition,
    dispatchTransition,
}: StackPageProps): ReactNode => {
    const { route, options } = descriptor;

    const handlers = transitionHandlers({
        navigation,
        onHidden,
        onShowing,
        suppressInitialTransition,
        dispatchTransition,
        key: route.key,
    });

    return (
        <AdwNavigationPage
            tag={route.key}
            title={options.title ?? route.name}
            canPop={options.canPop ?? true}
            {...handlers}
        >
            <StackPageContent descriptor={descriptor} previous={previous} />
        </AdwNavigationPage>
    );
};

const StackView = (props: StackViewProps): ReactNode => {
    const { state, navigation, descriptors, describe, popOnEscape, offset = 0 } = props;
    const { preventedRoutes } = usePreventRemoveContext();

    const protectedRouteKeys = new Set(
        state.routes
            .filter((route) => preventedRoutes[route.key]?.preventRemove === true)
            .map((route) => route.key),
    );

    const isEscapeEnabled = popOnEscape ?? true;

    return (
        <StackEventCoordinator
            navigation={navigation}
            protectedRouteKeys={protectedRouteKeys}
        >
            {({ dispatchTransition, onPopped }) => (
                <StackPages
                    state={state}
                    descriptors={descriptors}
                    describe={describe}
                    offset={offset}
                >
                    {({ pages, release, activate, isInitial }) => (
                        <AdwNavigationView
                            navigationStack={navigationStack(state, descriptors, offset)}
                            popOnEscape={isEscapeEnabled}
                            onPopped={onPopped}
                        >
                            {pages.map(({ descriptor, previous }) => (
                                <StackPage
                                    key={descriptor.route.key}
                                    descriptor={descriptor}
                                    previous={previous}
                                    navigation={navigation}
                                    onHidden={release}
                                    onShowing={activate}
                                    suppressInitialTransition={isInitial}
                                    dispatchTransition={dispatchTransition}
                                />
                            ))}
                        </AdwNavigationView>
                    )}
                </StackPages>
            )}
        </StackEventCoordinator>
    );
};

class StackEventCoordinator extends Component<StackEventCoordinatorProps> {
    private effectsReady = false;
    private isActive = true;
    private pendingNativePop: NativePopReconciliation | null = null;
    private nativeTransitionBuffer: NativeTransitionBuffer | null = null;
    private rejectedNativeSource: string | null = null;
    private isPopScheduled = false;
    private pendingTransitions: PendingTransition[] = [];

    private readonly queueTransition = (transition: PendingTransition): void => {
        if (this.effectsReady) {
            deliverTransition(transition);
        } else {
            this.pendingTransitions.push(transition);
        }
    };

    private readonly discardTransitions = (transitions: readonly PendingTransition[]): void => {
        for (const transition of transitions) {
            this.queueTransition({ ...transition, shouldEmit: false });
        }
    };

    private readonly consumeRejectedTransition = (transition: PendingTransition): boolean => {
        const rejectedSource = this.rejectedNativeSource;

        if (rejectedSource === null) {
            return false;
        }

        this.queueTransition({ ...transition, shouldEmit: false });

        if (isShowingEndFor(transition, rejectedSource)) {
            this.rejectedNativeSource = null;
        }

        return true;
    };

    private readonly nativeBufferFor = (transition: PendingTransition): NativeTransitionBuffer | null => {
        const current = this.nativeTransitionBuffer;

        if (current !== null) {
            return current;
        }

        const source = nativePopSource(transition, this.props.protectedRouteKeys);

        if (source === null) {
            return null;
        }

        const created = { source, transitions: [] };
        this.nativeTransitionBuffer = created;

        return created;
    };

    private readonly addBufferedTransition = (
        buffer: NativeTransitionBuffer,
        transition: PendingTransition,
    ): void => {
        buffer.transitions.push(transition);

        if (isShowingEndFor(transition, buffer.source)) {
            this.nativeTransitionBuffer = null;
            this.discardTransitions(buffer.transitions);
        }
    };

    private readonly dispatchTransition = (transition: PendingTransition): void => {
        if (this.consumeRejectedTransition(transition)) {
            return;
        }

        const buffer = this.nativeBufferFor(transition);

        if (buffer === null) {
            this.queueTransition(transition);

            return;
        }

        this.addBufferedTransition(buffer, transition);
    };

    private readonly finishNativePop = (
        pending: NativePopReconciliation,
        wasRejected: boolean,
    ): void => {
        const buffer = this.nativeTransitionBuffer;
        this.nativeTransitionBuffer = null;

        if (buffer === null) {
            return;
        }

        if (wasRejected) {
            this.rejectedNativeSource = pending.source;
            this.discardTransitions(buffer.transitions);

            return;
        }

        for (const transition of buffer.transitions) {
            this.queueTransition(transition);
        }
    };

    private readonly discardNativePop = (): void => {
        const buffer = this.nativeTransitionBuffer;
        this.nativeTransitionBuffer = null;

        if (buffer !== null) {
            this.discardTransitions(buffer.transitions);
        }
    };

    private readonly flushPops = (): void => {
        if (!this.isActive) {
            return;
        }

        const pending = this.pendingNativePop;
        this.pendingNativePop = null;
        this.isPopScheduled = false;

        if (pending === null) {
            return;
        }

        const { navigation } = this.props;
        const state = navigation.getState();

        if (state.key !== pending.target || state.routes.every((route) => route.key !== pending.source)) {
            this.discardNativePop();

            return;
        }

        navigation.dispatch({
            ...StackActions.pop(pending.count),
            source: pending.source,
            target: pending.target,
        });

        const wasRejected = navigation.getState().routes.some((route) => route.key === pending.source);
        this.finishNativePop(pending, wasRejected);
    };

    private readonly onPopped = (page: Adw.NavigationPage): void => {
        const source = page.getTag();

        if (source === null) {
            return;
        }

        const pending = this.pendingNativePop;

        this.pendingNativePop = pending === null
            ? {
                    source,
                    target: this.props.navigation.getState().key,
                    count: 1,
                }
            : { ...pending, count: pending.count + 1 };

        if (this.isPopScheduled) {
            return;
        }

        this.isPopScheduled = true;
        queueMicrotask(this.flushPops);
    };

    private readonly onEffectsReady = (): void => {
        if (!this.isActive) {
            return;
        }

        this.effectsReady = true;
        const pending = this.pendingTransitions;
        this.pendingTransitions = [];

        for (const transition of pending) {
            deliverTransition(transition);
        }
    };

    override getSnapshotBeforeUpdate(): null {
        this.effectsReady = false;
        const rejectedSource = this.rejectedNativeSource;
        const state = this.props.navigation.getState();

        if (rejectedSource !== null && state.routes[state.index]?.key !== rejectedSource) {
            this.rejectedNativeSource = null;
        }

        return null;
    }

    override componentDidUpdate(): void {
        this.effectsReady = false;
    }

    override componentWillUnmount(): void {
        this.isActive = false;
        this.pendingNativePop = null;
        this.nativeTransitionBuffer = null;
        this.rejectedNativeSource = null;
        this.pendingTransitions = [];
    }

    override render(): ReactNode {
        return (
            <>
                {this.props.children({
                    dispatchTransition: this.dispatchTransition,
                    onPopped: this.onPopped,
                })}
                <PassiveEffectsReady onReady={this.onEffectsReady} />
            </>
        );
    }
}

export { StackView };
