import type { ElementType } from "react";
import * as elements from "@gtkx/jsx";
import type { AnimatedComponent, AnimatedElements } from "./types.js";
import { withAnimated } from "./with-animated.js";

type Wrappable = Exclude<ElementType, string>;
/**
 * The `animated` entrypoint: callable to wrap any component, and exposing every generated widget
 * component as a property, so `animated.GtkLabel` is the animated form of `GtkLabel`.
 */
type Animated = (<T extends Exclude<ElementType, string>>(component: T) => AnimatedComponent<T>) & AnimatedElements;

/**
 * Wraps a component so that its props accept springs and interpolations: `animated(GtkLabel)` is
 * `GtkLabel` with every prop also taking a `SpringValue` or an `Interpolation`. Animated values are
 * written to the widget on each frame without a React render. The wrapper of a given component is
 * created once and reused, so repeated lookups render the same component.
 *
 * Every widget component of the generated `@gtkx/jsx` store is also available as a property:
 * `animated.GtkLabel` is `animated(GtkLabel)` without the import. Elements whose `ref` does not
 * expose a `Gtk.Widget` subclass, such as `GtkAdjustment`, are wrapped through the call form.
 */
const animated: Animated = new Proxy(wrapComponent, {
    get(target, property, receiver): unknown {
        const component = componentFor(property);

        return component === null ? Reflect.get(target, property, receiver) : withAnimated(component);
    },
    getOwnPropertyDescriptor(target, property): PropertyDescriptor | undefined {
        const component = componentFor(property);

        if (component === null) {
            return Reflect.getOwnPropertyDescriptor(target, property);
        }

        return { configurable: true, enumerable: true, writable: false, value: withAnimated(component) };
    },
    has(target, property): boolean {
        return componentFor(property) !== null || Reflect.has(target, property);
    },
    ownKeys(target): (string | symbol)[] {
        const names = Object.keys(elements).filter((name) => componentFor(name) !== null);

        return [...new Set([...Reflect.ownKeys(target), ...names])];
    },
}) as Animated;

function componentFor(property: string | symbol): Wrappable | null {
    const value: unknown = Reflect.get(elements, property);

    return isComponent(value) ? value : null;
}

function isComponent(value: unknown): value is Wrappable {
    return typeof value === "function";
}

function wrapComponent<T extends Wrappable>(component: T): AnimatedComponent<T> {
    return withAnimated(component);
}

export { animated, type Animated };
