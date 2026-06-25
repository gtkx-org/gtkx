import type { ReactNode } from "react";

export type AnimatableProperties = {
    opacity?: number;
    x?: number;
    y?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    rotate?: number;
    skewX?: number;
    skewY?: number;
};

export type NamedEasing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export type RepeatType = "loop" | "reverse" | "mirror";

export type Transition = {
    type?: "tween" | "spring";
    duration?: number;
    ease?: NamedEasing;
    delay?: number;
    stiffness?: number;
    damping?: number;
    mass?: number;
    velocity?: number;
    repeat?: number;
    repeatType?: RepeatType;
};

export type WidgetAnimationProps = {
    initial?: AnimatableProperties | false;
    animate?: AnimatableProperties;
    exit?: AnimatableProperties;
    transition?: Transition;
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
    children?: ReactNode;
};
