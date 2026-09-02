import type * as Gtk from "@gtkx/gi/gtk";
import type { FluidValue } from "@react-spring/shared";
import type { ComponentPropsWithRef, ElementType, FunctionComponent, JSX, Ref } from "react";

/** An array-valued prop whose items may each be a spring or an interpolation, such as mixed text children. */
type AnimatedItems<T> = [Exclude<Extract<T, Iterable<unknown>>, string>] extends [never]
    ? never
    : Exclude<Extract<T, Iterable<unknown>>, string> extends Iterable<infer Item>
        ? Iterable<AnimatedProp<Item>>
        : never;

/** A prop value that an animated component also accepts as a spring or an interpolation. */
type AnimatedProp<T> = T | FluidValue<Exclude<T, undefined>> | AnimatedItems<Exclude<T, undefined>>;

/**
 * A `style` object whose declarations may each be a spring or an interpolation, nested blocks
 * included, so the object a spring hook returns can be handed to `style` as it is.
 */
type AnimatedStyle<T> = {
    [K in keyof T]: T[K] extends string | number | undefined | null
        ? AnimatedProp<T[K]>
        : AnimatedProp<T[K]> | AnimatedStyle<NonNullable<T[K]>>;
};

/**
 * The props of an animated component: every prop of the wrapped component, each also accepting a
 * {@link FluidValue} such as a `SpringValue` or an `Interpolation`, while `ref` and `key` keep
 * their original types.
 */
type AnimatedProps<Props extends object> = {
    [P in keyof Props]: P extends "key" | "ref"
        ? Props[P]
        : P extends "style"
            ? AnimatedProp<Props[P]> | AnimatedStyle<NonNullable<Props[P]>>
            : AnimatedProp<Props[P]>;
};

/** A component returned by {@link animated}: the wrapped component with animated props. */
type AnimatedComponent<T extends Exclude<ElementType, string>> = FunctionComponent<
    AnimatedProps<ComponentPropsWithRef<T>>
>;

/**
 * The generated JSX intrinsic elements, keyed by element name, as components accepting animated props.
 * Only elements whose `ref` exposes a `Gtk.Widget` subclass are included.
 */
type AnimatedElementMap = {
    readonly [K in keyof JSX.IntrinsicElements as JSX.IntrinsicElements[K] extends {
        ref?: Ref<infer Instance> | undefined;
    }
        ? [NonNullable<Instance>] extends [never]
                ? never
                : NonNullable<Instance> extends Gtk.Widget
                    ? K
                    : never
        : never]: JSX.IntrinsicElements[K] extends object
        ? FunctionComponent<AnimatedProps<JSX.IntrinsicElements[K]>>
        : never;
};

export type {
    AnimatedComponent,
    AnimatedElementMap,
    AnimatedItems,
    AnimatedProp,
    AnimatedProps,
    AnimatedStyle,
};
