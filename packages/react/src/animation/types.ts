import type { Easing } from "@gtkx/ffi/adw";
import type { ReactNode } from "react";

export type AnimationMode = "timed" | "spring";

export type AnimatableValue = number;

export type AnimatableProperties = {
    opacity?: AnimatableValue;
    translateX?: AnimatableValue;
    translateY?: AnimatableValue;
    scale?: AnimatableValue;
    scaleX?: AnimatableValue;
    scaleY?: AnimatableValue;
    rotate?: AnimatableValue;
    skewX?: AnimatableValue;
    skewY?: AnimatableValue;
};

export type TimedTransition = {
    duration?: number;
    easing?: Easing;
    delay?: number;
    repeat?: number;
    reverse?: boolean;
    alternate?: boolean;
};

export type SpringTransition = {
    damping?: number;
    stiffness?: number;
    mass?: number;
    initialVelocity?: number;
    clamp?: boolean;
    delay?: number;
};

export type AnimationProps<M extends AnimationMode = AnimationMode> = {
    mode: M;
    initial?: AnimatableProperties | false;
    animate?: AnimatableProperties;
    exit?: AnimatableProperties;
    transition?: M extends "timed" ? TimedTransition : SpringTransition;
    animateOnMount?: boolean;
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
    children?: ReactNode;
};
