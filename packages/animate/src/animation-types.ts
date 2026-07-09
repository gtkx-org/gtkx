import type * as Adw from "@gtkx/gi/adw";

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

export type Easing =
    | "linear"
    | "easeInQuad"
    | "easeOutQuad"
    | "easeInOutQuad"
    | "easeInCubic"
    | "easeOutCubic"
    | "easeInOutCubic"
    | "easeInQuart"
    | "easeOutQuart"
    | "easeInOutQuart"
    | "easeInQuint"
    | "easeOutQuint"
    | "easeInOutQuint"
    | "easeInSine"
    | "easeOutSine"
    | "easeInOutSine"
    | "easeInExpo"
    | "easeOutExpo"
    | "easeInOutExpo"
    | "easeInCirc"
    | "easeOutCirc"
    | "easeInOutCirc"
    | "easeInElastic"
    | "easeOutElastic"
    | "easeInOutElastic"
    | "easeInBack"
    | "easeOutBack"
    | "easeInOutBack"
    | "easeInBounce"
    | "easeOutBounce"
    | "easeInOutBounce"
    | "ease"
    | "easeIn"
    | "easeOut"
    | "easeInOut"
    | "circIn"
    | "circOut"
    | "circInOut"
    | "backIn"
    | "backOut"
    | "backInOut";

export type RepeatType = "loop" | "reverse" | "mirror";

export type Transition = {
    type?: "tween" | "spring";
    duration?: number;
    ease?: Easing | Adw.Easing;
    delay?: number;
    reverse?: boolean;
    repeat?: number;
    repeatType?: RepeatType;
    followEnableAnimations?: boolean;
    stiffness?: number;
    damping?: number;
    dampingRatio?: number;
    bounce?: number;
    visualDuration?: number;
    mass?: number;
    velocity?: number;
    epsilon?: number;
    clamp?: boolean;
};

export type AnimationProps = {
    initial?: AnimationTarget | false;
    animate?: AnimationTarget;
    exit?: AnimationTarget;
    transition?: Transition;
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
};
