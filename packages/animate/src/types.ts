import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";

export type AnimatableProperties = {
    opacity?: number;
    translateX?: number;
    translateY?: number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    rotate?: number;
    skewX?: number;
    skewY?: number;
};

type AnimationBaseProps = {
    initial?: AnimatableProperties | false;
    animate?: AnimatableProperties;
    exit?: AnimatableProperties;
    animateOnMount?: boolean;
    delay?: number;
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
    children?: ReactNode;
};

export type AdwTimedAnimationProps = AnimationBaseProps & {
    duration?: number;
    easing?: Adw.Easing;
    repeat?: number;
    reverse?: boolean;
    alternate?: boolean;
};

export type AdwSpringAnimationProps = AnimationBaseProps & {
    damping?: number;
    stiffness?: number;
    mass?: number;
    initialVelocity?: number;
    clamp?: boolean;
};
