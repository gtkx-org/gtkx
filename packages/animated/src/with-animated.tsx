import type { Lookup } from "@react-spring/types";
import { useMergedRef } from "@gtkx/react/internal";
import {
    addFluidObserver,
    type FluidEvent,
    type FluidValue,
    getFluidValue,
    hasFluidValue,
    raf,
    removeFluidObserver,
    useForceUpdate,
} from "@react-spring/shared";
import { type ElementType, type ReactNode, type Ref, type RefObject, useLayoutEffect, useRef } from "react";
import type { AnimatedComponent } from "./types.js";
import { didApplyAnimatedValues } from "./apply-animated-values.js";
import { trackReducedMotion } from "./reduced-motion.js";

type AnimatedInput = { ref?: Ref<object> | undefined; [key: string]: unknown };
type Wrappable = Exclude<ElementType, string>;
type ObserverRef = { current: PropsObserver | null };

const cache: WeakMap<object, AnimatedComponent<Wrappable>> = new WeakMap();

const getDisplayName = (component: Wrappable): string => {
    const { displayName, name } = component as { displayName?: unknown; name?: unknown };

    if (typeof displayName === "string" && displayName !== "") {
        return displayName;
    }

    return typeof name === "string" && name !== "" ? name : "Anonymous";
};

const isFluidProp = (value: unknown): boolean => hasFluidValue(value) || isFluidArray(value);

function isFluidArray(value: unknown): value is unknown[] {
    return Array.isArray(value) && value.some((item) => isFluidProp(item));
}

function resolveValue(value: unknown): unknown {
    return isFluidArray(value) ? value.map((item) => resolveValue(item)) : getFluidValue(value);
}

const resolveProps = (props: Lookup, isAnimatedOnly: boolean): Lookup => {
    const resolved: Lookup = {};

    for (const name in props) {
        const value: unknown = props[name];

        if (isFluidProp(value)) {
            resolved[name] = resolveValue(value);
        } else if (!isAnimatedOnly) {
            resolved[name] = value;
        }
    }

    return resolved;
};

const collectDependencies = (value: unknown, dependencies: Set<FluidValue>): void => {
    if (hasFluidValue(value)) {
        dependencies.add(value);
    } else if (isFluidArray(value)) {
        for (const item of value) {
            collectDependencies(item, dependencies);
        }
    }
};

const getDependencies = (props: Lookup): Set<FluidValue> => {
    const dependencies: Set<FluidValue> = new Set();

    for (const name in props) {
        collectDependencies(props[name], dependencies);
    }

    return dependencies;
};

const getFluidNames = (props: Lookup): Set<string> => {
    const names: Set<string> = new Set();

    for (const name in props) {
        if (isFluidProp(props[name])) {
            names.add(name);
        }
    }

    return names;
};

const observe = (observer: PropsObserver): void => {
    for (const dependency of observer.dependencies) {
        addFluidObserver(dependency, observer);
    }
};

const unobserve = (observer: PropsObserver): void => {
    for (const dependency of observer.dependencies) {
        removeFluidObserver(dependency, observer);
    }

    raf.cancel(observer.update);
};

const useObserver = (observer: PropsObserver): void => {
    const observerRef: ObserverRef = useRef<PropsObserver | null>(null);

    useLayoutEffect(() => {
        observerRef.current = observer;
        observe(observer);

        return () => {
            if (observerRef.current === null) {
                return;
            }

            unobserve(observerRef.current);
            observerRef.current = null;
        };
    });
};

const collectStaticReplacements = (
    props: Lookup,
    previous: Set<string>,
    current: Set<string>,
    values: Lookup,
): void => {
    for (const name of previous) {
        const value: unknown = props[name];

        if (value !== undefined && !current.has(name)) {
            values[name] = value;
        }
    }
};

const useCommitSync = (instanceRef: RefObject<object | null>, props: Lookup): void => {
    const fluidNamesRef = useRef<Set<string>>(new Set());

    useLayoutEffect(() => {
        const previous = fluidNamesRef.current;
        const current = getFluidNames(props);
        fluidNamesRef.current = current;
        trackReducedMotion();
        const instance = instanceRef.current;

        if (instance === null) {
            return;
        }

        const values = resolveProps(props, true);
        collectStaticReplacements(props, previous, current, values);
        didApplyAnimatedValues(instance, values);
    });
};

const useAnimatedUpdate = (instanceRef: RefObject<object | null>, props: Lookup): (() => void) => {
    const forceUpdate = useForceUpdate();

    return () => {
        const instance = instanceRef.current;
        const isApplied = instance !== null && didApplyAnimatedValues(instance, resolveProps(props, true));

        if (!isApplied) {
            forceUpdate();
        }
    };
};

const createAnimatedComponent = (Component: Wrappable): AnimatedComponent<Wrappable> => {
    const Animated = ({ ref: givenRef, ...props }: AnimatedInput): ReactNode => {
        const instanceRef = useRef<object | null>(null);
        const ref = useMergedRef(givenRef, instanceRef);
        const update = useAnimatedUpdate(instanceRef, props);
        useObserver(new PropsObserver(update, getDependencies(props)));
        useCommitSync(instanceRef, props);

        return <Component {...resolveProps(props, false)} ref={ref} />;
    };

    Animated.displayName = `Animated(${getDisplayName(Component)})`;

    return Animated as AnimatedComponent<Wrappable>;
};

function withAnimated<T extends Wrappable>(component: T): AnimatedComponent<T> {
    let cached = cache.get(component);

    if (cached === undefined) {
        cached = createAnimatedComponent(component);
        cache.set(component, cached);
    }

    return cached as AnimatedComponent<T>;
}

class PropsObserver {
    readonly update: () => void;

    readonly dependencies: Set<FluidValue>;

    constructor(update: () => void, dependencies: Set<FluidValue>) {
        this.update = update;
        this.dependencies = dependencies;
    }

    eventObserved(event: FluidEvent): void {
        if (event.type === "change") {
            raf.write(this.update);
        }
    }
}

export { withAnimated };
