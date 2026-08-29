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

const STYLE_PROP = "style";
const cache: WeakMap<object, AnimatedComponent<Wrappable>> = new WeakMap();

const getDisplayName = (component: Wrappable): string => {
    const { displayName, name } = component as { displayName?: unknown; name?: unknown };

    if (typeof displayName === "string" && displayName !== "") {
        return displayName;
    }

    return typeof name === "string" && name !== "" ? name : "Anonymous";
};

const isFluidProp = (value: unknown): boolean => hasFluidValue(value) || isFluidArray(value);

const isBlock = (value: unknown): value is Lookup =>
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

function isFluidArray(value: unknown): value is unknown[] {
    return Array.isArray(value) && value.some((item) => isFluidProp(item));
}

function isFluidStyle(value: unknown): value is Lookup {
    return isBlock(value) && Object.values(value).some((item) => hasFluidValue(item) || isFluidStyle(item));
}

function resolveStyle(style: Lookup): Lookup {
    const resolved: Lookup = {};

    for (const name in style) {
        const value: unknown = style[name];
        const next: unknown = isFluidStyle(value) ? resolveStyle(value) : getFluidValue(value);
        resolved[name] = next;
    }

    return resolved;
}

function resolveValue(value: unknown): unknown {
    return isFluidArray(value) ? value.map((item) => resolveValue(item)) : getFluidValue(value);
}

const isFluidNamed = (name: string, value: unknown): boolean =>
    isFluidProp(value) || (name === STYLE_PROP && isFluidStyle(value));

const resolveNamed = (name: string, value: unknown): unknown =>
    name === STYLE_PROP && isFluidStyle(value) ? resolveStyle(value) : resolveValue(value);

const resolveProps = (props: Lookup, isAnimatedOnly: boolean): Lookup => {
    const resolved: Lookup = {};

    for (const name in props) {
        const value: unknown = props[name];

        if (isFluidNamed(name, value)) {
            resolved[name] = resolveNamed(name, value);
        } else if (!isAnimatedOnly) {
            resolved[name] = value;
        }
    }

    return resolved;
};

function collectEach(items: unknown[], dependencies: Set<FluidValue>): void {
    for (const item of items) {
        collectDependencies(item, dependencies);
    }
}

function collectDependencies(value: unknown, dependencies: Set<FluidValue>): void {
    if (hasFluidValue(value)) {
        dependencies.add(value);
    } else if (isFluidArray(value)) {
        collectEach(value, dependencies);
    } else if (isFluidStyle(value)) {
        collectEach(Object.values(value), dependencies);
    }
}

const collectNamed = (name: string, value: unknown, dependencies: Set<FluidValue>): void => {
    if (isFluidNamed(name, value)) {
        collectDependencies(value, dependencies);
    }
};

const getDependencies = (props: Lookup): Set<FluidValue> => {
    const dependencies: Set<FluidValue> = new Set();

    for (const name in props) {
        collectNamed(name, props[name], dependencies);
    }

    return dependencies;
};

const getFluidNames = (props: Lookup): Set<string> => {
    const names: Set<string> = new Set();

    for (const name in props) {
        if (isFluidNamed(name, props[name])) {
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
    useLayoutEffect(() => {
        observe(observer);

        return () => {
            unobserve(observer);
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
