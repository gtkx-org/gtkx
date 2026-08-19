import type { FluidValue } from "@react-spring/shared";
import type { ComponentPropsWithRef, ElementType, FunctionComponent } from "react";

/** An array-valued prop whose items may each be a spring or an interpolation, such as mixed text children. */
type AnimatedItems<T> = [Exclude<Extract<T, Iterable<unknown>>, string>] extends [never]
    ? never
    : Exclude<Extract<T, Iterable<unknown>>, string> extends Iterable<infer Item>
        ? Iterable<AnimatedProp<Item>>
        : never;

/** A prop value that an animated component also accepts as a spring or an interpolation. */
type AnimatedProp<T> = T | FluidValue<Exclude<T, undefined>> | AnimatedItems<Exclude<T, undefined>>;

/**
 * The props of an animated component: every prop of the wrapped component, each also accepting a
 * {@link FluidValue} such as a `SpringValue` or an `Interpolation`, while `ref` and `key` keep
 * their original types.
 */
type AnimatedProps<Props extends object> = {
    [P in keyof Props]: P extends "key" | "ref" ? Props[P] : AnimatedProp<Props[P]>;
};

/** A component returned by {@link animated}: the wrapped component with animated props. */
type AnimatedComponent<T extends Exclude<ElementType, string>> = FunctionComponent<
    AnimatedProps<ComponentPropsWithRef<T>>
>;

export type { AnimatedComponent, AnimatedItems, AnimatedProp, AnimatedProps };
