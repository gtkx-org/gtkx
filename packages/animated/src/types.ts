import type * as Gtk from "@gtkx/gi/gtk";
import type * as elements from "@gtkx/jsx";
import type { FluidValue } from "@react-spring/shared";
import type { ComponentPropsWithRef, ElementType, FunctionComponent, Ref } from "react";

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
 * The widget components of the generated `@gtkx/jsx` store, keyed by element name, each wrapped as
 * an {@link AnimatedComponent}. Only components whose `ref` exposes a `Gtk.Widget` subclass are
 * included, so `animated.GtkLabel` is available while non-widget elements such as `GtkAdjustment`
 * are wrapped explicitly through the `animated(...)` call instead.
 */
type AnimatedElementMap = {
    readonly [K in keyof typeof elements as (typeof elements)[K] extends Exclude<ElementType, string>
        ? ComponentPropsWithRef<(typeof elements)[K]> extends { ref?: Ref<infer Instance> | undefined }
            ? [NonNullable<Instance>] extends [never]
                    ? never
                    : NonNullable<Instance> extends Gtk.Widget
                        ? K
                        : never
            : never
        : never]: (typeof elements)[K] extends Exclude<ElementType, string>
        ? AnimatedComponent<(typeof elements)[K]>
        : never;
};

/**
 * The widget components of the generated `@gtkx/jsx` store, exposed as properties of `animated`.
 *
 * @deprecated Property access on `animated` is removed in GTKX 2.0; import the component and call
 * `animated(Component)` instead.
 */
/* eslint-disable-next-line sonarjs/redundant-type-aliases -- deprecated alias kept until 2.0 removes it */
type AnimatedElements = AnimatedElementMap;

export type {
    AnimatedComponent,
    AnimatedElementMap,
    /* eslint-disable-next-line @typescript-eslint/no-deprecated -- exported until 2.0 removes it */
    AnimatedElements,
    AnimatedItems,
    AnimatedProp,
    AnimatedProps,
    AnimatedStyle,
};
