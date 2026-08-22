import type * as Adw from "@gtkx/gi/adw";
import type { ParamListBase, StackNavigationState } from "@react-navigation/core";
import type { ReactNode, RefObject } from "react";
import { AdwNavigationPage, AdwNavigationView, AdwToolbarView } from "@gtkx/jsx/adw";
import { useCallback, useEffect, useRef } from "react";
import type { Describe } from "./stack-pages.js";
import type { OptionsByKey } from "./sync-navigation-stack.js";
import type {
    StackDescriptor,
    StackDescriptorMap,
    StackNavigationConfig,
    StackNavigationEventMap,
    StackNavigationHelpers,
    StackNavigationOptions,
} from "./types.js";
import { HeaderBar } from "../shared/header-bar.js";
import { useStackPages } from "./stack-pages.js";
import { reconcilePoppedStack, syncNavigationStack } from "./sync-navigation-stack.js";

type ViewRef = RefObject<Adw.NavigationView | null>;
type MutableOptions = Record<string, StackNavigationOptions>;

type StackViewProps = StackNavigationConfig & {
    state: StackNavigationState<ParamListBase>;
    navigation: StackNavigationHelpers;
    descriptors: StackDescriptorMap;
    describe: Describe;
};

type StackPageProps = {
    descriptor: StackDescriptor;
    previous?: StackDescriptor;
    navigation: StackNavigationHelpers;
    onHidden: (key: string) => void;
};

type TransitionEvent = keyof StackNavigationEventMap;

const previousDescriptor = (
    state: StackNavigationState<ParamListBase>,
    descriptors: StackDescriptorMap,
    key: string,
): StackDescriptor | undefined => {
    const index = state.routes.findIndex((route) => route.key === key);
    const previousKey = index > 0 ? state.routes[index - 1]?.key : undefined;

    return previousKey === undefined ? undefined : descriptors[previousKey];
};

const useLatest = <T,>(value: T): RefObject<T> => {
    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref;
};

const useTrackedOptions = (descriptors: StackDescriptorMap): RefObject<MutableOptions> => {
    const optionsRef = useRef<MutableOptions>({});

    useEffect(() => {
        for (const [key, descriptor] of Object.entries(descriptors)) {
            optionsRef.current[key] = descriptor.options;
        }
    }, [descriptors]);

    return optionsRef;
};

const useStackSync = (
    viewRef: ViewRef,
    state: StackNavigationState<ParamListBase>,
    options: RefObject<OptionsByKey>,
): void => {
    const isInitialRef = useRef(true);

    useEffect(() => {
        const view = viewRef.current;

        if (view === null) {
            return;
        }

        syncNavigationStack(view, state.routes.map((route) => route.key), options.current, isInitialRef.current);
        isInitialRef.current = false;
    }, [viewRef, state, options]);
};

const usePoppedHandler = (
    viewRef: ViewRef,
    navigation: StackNavigationHelpers,
    options: RefObject<OptionsByKey>,
): (() => void) => {
    const navigationRef = useLatest(navigation);
    const isScheduledRef = useRef(false);

    return useCallback(() => {
        if (isScheduledRef.current) {
            return;
        }

        isScheduledRef.current = true;

        queueMicrotask(() => {
            isScheduledRef.current = false;
            const view = viewRef.current;

            if (view !== null) {
                reconcilePoppedStack(view, navigationRef.current, options.current);
            }
        });
    }, [viewRef, navigationRef, options]);
};

const StackPageContent = ({ descriptor, previous }: Omit<StackPageProps, "navigation" | "onHidden">): ReactNode => {
    const { route, options, navigation } = descriptor;

    if (options.headerShown === false) {
        return descriptor.render();
    }

    const back = previous === undefined ? undefined : { title: previous.options.title ?? previous.route.name };

    const topBar = options.header === undefined
        ? <HeaderBar options={options} showBackButton={options.headerBackVisible ?? true} />
        : <>{options.header({ route, navigation, options, back })}</>;

    return <AdwToolbarView topBar={topBar}>{descriptor.render()}</AdwToolbarView>;
};

const StackPage = ({ descriptor, previous, navigation, onHidden }: StackPageProps): ReactNode => {
    const { route, options } = descriptor;

    const emit = (type: TransitionEvent, isClosing: boolean): void => {
        navigation.emit({ type, data: { closing: isClosing }, target: route.key });
    };

    return (
        <AdwNavigationPage
            tag={route.key}
            title={options.title ?? route.name}
            canPop={options.canPop ?? true}
            onShowing={() => {
                emit("transitionStart", false);
            }}
            onHiding={() => {
                emit("transitionStart", true);
            }}
            onShown={() => {
                emit("transitionEnd", false);
            }}
            onHidden={() => {
                emit("transitionEnd", true);
                onHidden(route.key);
            }}
        >
            <StackPageContent descriptor={descriptor} previous={previous} />
        </AdwNavigationPage>
    );
};

const StackView = ({ state, navigation, descriptors, describe, popOnEscape }: StackViewProps): ReactNode => {
    const viewRef = useRef<Adw.NavigationView | null>(null);
    const options = useTrackedOptions(descriptors);
    const { pages, release } = useStackPages(state, descriptors, describe);
    const onPopped = usePoppedHandler(viewRef, navigation, options);
    useStackSync(viewRef, state, options);

    return (
        <AdwNavigationView ref={viewRef} popOnEscape={popOnEscape ?? true} onPopped={onPopped}>
            {pages.map((descriptor) => (
                <StackPage
                    key={descriptor.route.key}
                    descriptor={descriptor}
                    previous={previousDescriptor(state, descriptors, descriptor.route.key)}
                    navigation={navigation}
                    onHidden={release}
                />
            ))}
        </AdwNavigationView>
    );
};

export { StackView };
