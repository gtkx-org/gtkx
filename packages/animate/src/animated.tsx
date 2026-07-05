import type * as Gtk from "@gtkx/gi/gtk";
import { createElementComponent } from "@gtkx/react";
import { createElement, type JSX, type ReactNode, type Ref } from "react";
import type { WidgetAnimationProps } from "./types.js";
import { useAnimatedWidget } from "./use-animated-widget.js";

/** {@link WidgetAnimationProps} without `children`; the animation props added to every {@link animated} component. */
export type AnimationProps = Omit<WidgetAnimationProps, "children">;

/** A widget component of props `P` augmented with {@link AnimationProps}. */
export type AnimatedComponent<P> = (props: P & AnimationProps) => ReactNode;

type ElementInstance<P> = P extends { ref?: Ref<infer T | null> | undefined } ? T : never;

type AnimatedIntrinsics = {
    [K in keyof JSX.IntrinsicElements as ElementInstance<JSX.IntrinsicElements[K]> extends Gtk.Widget
        ? K
        : never]: AnimatedComponent<JSX.IntrinsicElements[K]>;
};

const animatedByName = new Map<string, unknown>();
const animatedByComponent = new WeakMap<object, unknown>();

const getCachedAnimated = <P extends object>(component: object): AnimatedComponent<P> | undefined =>
    animatedByComponent.get(component) as AnimatedComponent<P> | undefined;

const animatedFactory = <P extends object>(Component: (props: P) => ReactNode): AnimatedComponent<P> => {
    const cached = getCachedAnimated<P>(Component);
    if (cached) return cached;

    const Animated = (props: P & AnimationProps): ReactNode => {
        const { initial, animate, exit, transition, onAnimationStart, onAnimationComplete, ...rest } = props;
        const externalRef = (props as { ref?: Ref<Gtk.Widget | null> }).ref;
        const mergedRef = useAnimatedWidget(externalRef, props);
        return createElement(Component, { ...rest, ref: mergedRef } as P);
    };

    animatedByComponent.set(Component, Animated);
    return Animated;
};

type Animated = typeof animatedFactory & { create: typeof animatedFactory } & AnimatedIntrinsics;

/**
 * Factory for animation-aware widgets. Access a built-in widget by name (for example
 * `animated.GtkBox`) to obtain a component that accepts {@link AnimationProps} alongside the
 * widget's own props, or wrap a custom widget component with `animated.create(Component)`. Each
 * widget name and component resolves to a single memoized wrapper.
 */
export const animated: Animated = new Proxy(animatedFactory, {
    get(target, key) {
        if (key === "create") return target;
        if (typeof key !== "string" || key in target) return Reflect.get(target, key);
        if (!animatedByName.has(key)) {
            animatedByName.set(key, animatedFactory(createElementComponent<{ ref?: Ref<Gtk.Widget | null> }>(key)));
        }
        return animatedByName.get(key);
    },
}) as Animated;
