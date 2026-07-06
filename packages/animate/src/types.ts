import type * as Adw from "@gtkx/gi/adw";

/**
 * Animatable visual properties of a widget. Every field is serialized to GTK CSS on each frame:
 * `opacity` maps to the CSS `opacity` property, while `x`, `y`, `scale`, `scaleX`, `scaleY`,
 * `rotate`, `skewX`, and `skewY` compose a single CSS `transform`.
 *
 * Prefer `opacity` for inexpensive fades: it only queues a redraw, whereas any transform field
 * queues a parent size allocation on every frame.
 */
export type AnimationTarget = {
    /** Opacity from 0 (transparent) to 1 (opaque). */
    opacity?: number;
    /** Horizontal translation in pixels. */
    x?: number;
    /** Vertical translation in pixels. */
    y?: number;
    /** Uniform scale factor; overrides `scaleX` and `scaleY` when set. */
    scale?: number;
    /** Horizontal scale factor, applied when `scale` is unset. */
    scaleX?: number;
    /** Vertical scale factor, applied when `scale` is unset. */
    scaleY?: number;
    /** Rotation in degrees. */
    rotate?: number;
    /** Horizontal skew in degrees. */
    skewX?: number;
    /** Vertical skew in degrees. */
    skewY?: number;
};

/**
 * Named easing curves for tween transitions, mirroring the Framer Motion vocabulary and
 * resolving to the closest libadwaita easing. Cubic-bezier tuples, easing functions,
 * `anticipate`, and `steps` are not supported because libadwaita has no equivalent. The `back*`
 * curves approximate Motion's overshoot using libadwaita's Penner back easing.
 */
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
 * How a repeating transition replays each iteration. `loop` restarts from the beginning, while
 * `reverse` and `mirror` alternate direction on each iteration. libadwaita has a single
 * alternation mode, so `mirror` behaves identically to `reverse`.
 */
export type RepeatType = "loop" | "reverse" | "mirror";

/**
 * Timing and physics for an animation. A single libadwaita animation drives every property in the
 * target together, so one transition applies to the whole change; Motion's per-property
 * transitions are not modeled. Tween fields (`duration`, `ease`) and spring fields (`stiffness`,
 * `damping`, and the others) are selected by `type`; fields belonging to the other family are
 * ignored.
 */
export type Transition = {
    /** Animation family. Defaults to `tween`. */
    type?: "tween" | "spring";
    /**
     * Tween duration in seconds. For a spring, resolves stiffness and damping when no explicit
     * physics fields are set. `Infinity` runs forever.
     */
    duration?: number;
    /** Tween easing, either a named {@link Easing} or a raw libadwaita easing value. */
    ease?: Easing | Adw.Easing;
    /** Delay before the animation starts, in seconds. */
    delay?: number;
    /** Tween: play the timeline in reverse. */
    reverse?: boolean;
    /** Number of additional repeats; the animation plays `repeat + 1` times. `Infinity` repeats forever. */
    repeat?: number;
    /** How each repeat replays. See {@link RepeatType}. */
    repeatType?: RepeatType;
    /** Forward libadwaita's global "enable animations" setting to the animation. */
    followEnableAnimations?: boolean;
    /** Spring stiffness. Overrides duration-based resolution. */
    stiffness?: number;
    /** Spring damping coefficient. Overrides duration-based resolution. */
    damping?: number;
    /** Spring damping ratio (libadwaita-native); takes precedence over the other spring fields. */
    dampingRatio?: number;
    /** Spring bounciness from 0 (no overshoot) to 1, used with `duration` or `visualDuration`. */
    bounce?: number;
    /** Perceived spring duration in seconds, used with `bounce` to derive stiffness and damping. */
    visualDuration?: number;
    /** Spring mass. */
    mass?: number;
    /** Spring initial velocity, in progress fractions (0..1) per second, not property units. */
    velocity?: number;
    /** Spring rest threshold in progress units (0..1); a smaller value settles later. */
    epsilon?: number;
    /** Spring: clamp the value so it never overshoots past the target. */
    clamp?: boolean;
};

/**
 * Declarative animation inputs shared by {@link AnimatedComponent} widgets. `initial` values are
 * applied before the first frame, after which the widget animates toward `animate`. Inside an
 * {@link AnimatePresence}, `exit` is animated to before the widget is removed.
 */
export type AnimationProps = {
    /** Starting values, or `false` to skip the mount animation and render directly at `animate`. */
    initial?: AnimationTarget | false;
    /** Target the widget animates toward while mounted. */
    animate?: AnimationTarget;
    /** Target the widget animates to before removal inside an {@link AnimatePresence}. */
    exit?: AnimationTarget;
    /** Timing and physics for the animation. */
    transition?: Transition;
    /** Called when an animation starts. */
    onAnimationStart?: () => void;
    /** Called when an animation finishes naturally; not called when an animation is interrupted. */
    onAnimationComplete?: () => void;
};
