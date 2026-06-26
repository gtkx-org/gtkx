import type * as Gtk from "@gtkx/gi/gtk";
import { createElementComponent } from "@gtkx/react";
import { createElement, type JSX, type ReactNode, type Ref } from "react";
import type { WidgetAnimationProps } from "./types.js";
import { useAnimatedWidget } from "./use-animated-widget.js";

/**
 * The motion-style animation props added to every widget by {@link animated}:
 * the `initial`/`animate`/`exit` targets, the `transition`, and the start and
 * complete callbacks. The widget's own props are preserved alongside them.
 */
export type AnimationProps = Omit<WidgetAnimationProps, "children">;

/**
 * A widget component enhanced with {@link AnimationProps}. It renders the
 * wrapped widget and animates it; the widget's own props (including `children`
 * and `ref`) pass straight through.
 */
export type AnimatedComponent<P> = (props: P & AnimationProps) => ReactNode;

type ElementInstance<P> = P extends { ref?: Ref<infer T | null> | undefined } ? T : never;

type AnimatedIntrinsics = {
    [K in keyof JSX.IntrinsicElements as ElementInstance<JSX.IntrinsicElements[K]> extends Gtk.Widget
        ? K
        : never]: AnimatedComponent<JSX.IntrinsicElements[K]>;
};

const animatedByName = new Map<string, unknown>();
const animatedByComponent = new WeakMap<object, unknown>();

const animatedFactory = <P extends object>(Component: (props: P) => ReactNode): AnimatedComponent<P> => {
    const cached = animatedByComponent.get(Component);
    if (cached) return cached as AnimatedComponent<P>;

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
 * Motion-style animated widget surface over libadwaita.
 *
 * Index it by widget name to animate a built-in widget
 * (`<animated.GtkBox animate={{ opacity: 1 }} />`), or call `animated.create`
 * (or `animated` itself) to wrap a custom ref-forwarding widget component
 * (`const Card = animated.create(MyCard)`). Either way the result accepts the
 * widget's own props plus {@link AnimationProps}, and only widget-typed
 * intrinsics are exposed by name.
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
