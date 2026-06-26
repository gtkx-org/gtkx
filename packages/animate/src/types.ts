import type { ReactNode } from "react";

export type AnimationTarget = {
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

export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut";

export type RepeatType = "loop" | "reverse";

export type Transition = {
    type?: "tween" | "spring";
    duration?: number;
    ease?: Easing;
    delay?: number;
    stiffness?: number;
    damping?: number;
    mass?: number;
    velocity?: number;
    repeat?: number;
    repeatType?: RepeatType;
};

export type WidgetAnimationProps = {
    initial?: AnimationTarget | false;
    animate?: AnimationTarget;
    exit?: AnimationTarget;
    transition?: Transition;
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
    children?: ReactNode;
};
