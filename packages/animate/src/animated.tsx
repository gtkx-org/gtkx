import type * as Gtk from "@gtkx/gi/gtk";
import { createElementComponent } from "@gtkx/react";
import { createElement, type JSX, type ReactNode, type Ref } from "react";
import type { WidgetAnimationProps } from "./types.js";
import { useAnimatedWidget } from "./use-animated-widget.js";

export type AnimationProps = Omit<WidgetAnimationProps, "children">;

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
