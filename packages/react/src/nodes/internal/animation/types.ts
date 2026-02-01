import type { Easing } from "@gtkx/ffi/adw";
import type { ReactNode } from "react";

/**
 * A numeric value that can be animated.
 */
export type AnimatableValue = number;

/**
 * CSS properties that can be animated on a widget.
 *
 * All transforms are applied via GTK CSS and rendered through the widget's style context.
 */
export type AnimatableProperties = {
    /** Opacity from 0 (fully transparent) to 1 (fully opaque) */
    opacity?: AnimatableValue;
    /** Horizontal translation in pixels (positive moves right) */
    translateX?: AnimatableValue;
    /** Vertical translation in pixels (positive moves down) */
    translateY?: AnimatableValue;
    /** Uniform scale factor (1 = original size, 2 = double size) */
    scale?: AnimatableValue;
    /** Horizontal scale factor */
    scaleX?: AnimatableValue;
    /** Vertical scale factor */
    scaleY?: AnimatableValue;
    /** Rotation angle in degrees (positive rotates clockwise) */
    rotate?: AnimatableValue;
    /** Horizontal skew angle in degrees */
    skewX?: AnimatableValue;
    /** Vertical skew angle in degrees */
    skewY?: AnimatableValue;
};

/**
 * Transition configuration for timed (duration-based) animations.
 *
 * @see {@link https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.TimedAnimation.html Adw.TimedAnimation}
 */
export type TimedTransition = {
    /** Discriminant: duration-based animation with easing curves */
    mode: "timed";
    /** Animation duration in milliseconds (default: 300) */
    duration?: number;
    /** Easing function for the animation curve (default: EASE_OUT_CUBIC) */
    easing?: Easing;
    /** Delay before starting the animation in milliseconds */
    delay?: number;
    /** Number of times to repeat the animation (0 = no repeat, -1 = infinite) */
    repeat?: number;
    /** Whether to play the animation in reverse */
    reverse?: boolean;
    /** Whether to alternate direction on each repeat */
    alternate?: boolean;
};

/**
 * Transition configuration for spring (physics-based) animations.
 *
 * Spring animations simulate a mass attached to a spring, providing natural-feeling motion.
 * The animation settles when the spring reaches equilibrium.
 *
 * @see {@link https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.SpringAnimation.html Adw.SpringAnimation}
 */
export type SpringTransition = {
    /** Discriminant: physics-based spring animation */
    mode: "spring";
    /** Damping ratio controlling oscillation decay (default: 1, critically damped) */
    damping?: number;
    /** Spring stiffness in N/m affecting animation speed (default: 100) */
    stiffness?: number;
    /** Virtual mass in kg affecting momentum (default: 1) */
    mass?: number;
    /** Initial velocity to apply at animation start */
    initialVelocity?: number;
    /** Whether to clamp the animation value to prevent overshooting */
    clamp?: boolean;
    /** Delay before starting the animation in milliseconds */
    delay?: number;
};

/**
 * Discriminated union of all transition configurations.
 *
 * The `mode` field determines the animation type:
 * - `"timed"`: Duration-based animation with easing curves (uses {@link Adw.TimedAnimation})
 * - `"spring"`: Physics-based spring animation (uses {@link Adw.SpringAnimation})
 */
export type AnimationTransition = TimedTransition | SpringTransition;

/**
 * Props for the Animation component.
 *
 * Provides a declarative API for animating widget properties using either
 * timed (duration-based) or spring (physics-based) animations.
 *
 * @example
 * ```tsx
 * <x.Animation
 *   initial={{ opacity: 0, translateY: -20 }}
 *   animate={{ opacity: 1, translateY: 0 }}
 *   exit={{ opacity: 0, translateY: 20 }}
 *   transition={{ mode: "spring", damping: 0.8, stiffness: 200 }}
 *   animateOnMount
 * >
 *   <GtkLabel label="Animated content" />
 * </x.Animation>
 * ```
 */
export type AnimationProps = {
    /** Initial property values before animation starts, or `false` to skip initial state */
    initial?: AnimatableProperties | false;
    /** Target property values to animate towards */
    animate?: AnimatableProperties;
    /** Property values to animate to when the component unmounts */
    exit?: AnimatableProperties;
    /** Transition configuration including animation mode and parameters */
    transition?: AnimationTransition;
    /** Whether to animate from `initial` to `animate` when first mounted (default: false) */
    animateOnMount?: boolean;
    /** Callback fired when an animation begins */
    onAnimationStart?: () => void;
    /** Callback fired when an animation completes */
    onAnimationComplete?: () => void;
    /** The child widget to animate (must be a single GTK widget) */
    children?: ReactNode;
};
