import type * as Adw from "@gtkx/gi/adw";

/**
 * A visual state a widget can animate to, expressed as opacity and CSS transform values.
 * Every field is optional; omitted fields are left unchanged.
 */
export type AnimationTarget = {
    /** Opacity from 0 (transparent) to 1 (opaque). */
    opacity?: number;
    /** Horizontal translation in pixels. */
    x?: number;
    /** Vertical translation in pixels. */
    y?: number;
    /** Uniform scale factor applied to both axes. */
    scale?: number;
    /** Horizontal scale factor. */
    scaleX?: number;
    /** Vertical scale factor. */
    scaleY?: number;
    /** Rotation in degrees. */
    rotate?: number;
    /** Horizontal skew in degrees. */
    skewX?: number;
    /** Vertical skew in degrees. */
    skewY?: number;
};

/** Named easing curve applied to a tween transition. */
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

/**
 * How a repeated animation behaves on each cycle: `loop` restarts from the beginning,
 * while `reverse` and `mirror` alternate the playback direction.
 */
export type RepeatType = "loop" | "reverse" | "mirror";

/**
 * Controls the timing and physics used to animate between targets. A `tween` transition
 * is duration based and eased, while a `spring` transition is driven by physics parameters.
 */
export type Transition = {
    /** Selects a duration based `tween` (default) or a physics based `spring` animation. */
    type?: "tween" | "spring";
    /** Duration in seconds. */
    duration?: number;
    /** Easing curve for a tween, either a named {@link Easing} or an Adwaita easing. */
    ease?: Easing | Adw.Easing;
    /** Delay in seconds before the animation begins. */
    delay?: number;
    /** Plays the tween in reverse. */
    reverse?: boolean;
    /** Number of additional repetitions; a non finite value repeats indefinitely. */
    repeat?: number;
    /** How each repetition behaves. */
    repeatType?: RepeatType;
    /** Honors the system "enable animations" accessibility setting. */
    followEnableAnimations?: boolean;
    /** Spring stiffness. */
    stiffness?: number;
    /** Spring damping. */
    damping?: number;
    /** Spring damping ratio, clamped to a minimum of 0.05; higher settles faster with less overshoot. */
    dampingRatio?: number;
    /** Bounciness used when deriving spring physics from a duration; higher overshoots more. */
    bounce?: number;
    /** Perceived spring duration in seconds, used to derive the spring physics. */
    visualDuration?: number;
    /** Spring mass. */
    mass?: number;
    /** Initial spring velocity. */
    velocity?: number;
    /** Precision at which the spring is considered at rest. */
    epsilon?: number;
    /** Prevents the spring from overshooting past its target. */
    clamp?: boolean;
};

/** Animation configuration accepted by every component produced through {@link animated}. */
export type AnimationProps = {
    /** State the widget starts from before its enter animation; `false` skips the enter animation. */
    initial?: AnimationTarget | false;
    /** State the widget animates to while it is present. */
    animate?: AnimationTarget;
    /** State the widget animates to while exiting inside an `AnimatePresence`. */
    exit?: AnimationTarget;
    /** Timing and physics for the animations. */
    transition?: Transition;
    /** Called when an animation begins. */
    onAnimationStart?: () => void;
    /** Called when an animation reaches its target. */
    onAnimationComplete?: () => void;
};
