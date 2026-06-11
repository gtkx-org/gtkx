import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";

/**
 * CSS properties that can be animated on a widget.
 *
 * All transforms are applied via GTK CSS and rendered through the widget's style context.
 */
export type AnimatableProperties = {
    /** Opacity from 0 (fully transparent) to 1 (fully opaque) */
    opacity?: number;
    /** Horizontal translation in pixels (positive moves right) */
    translateX?: number;
    /** Vertical translation in pixels (positive moves down) */
    translateY?: number;
    /** Uniform scale factor (1 = original size, 2 = double size) */
    scale?: number;
    /** Horizontal scale factor */
    scaleX?: number;
    /** Vertical scale factor */
    scaleY?: number;
    /** Rotation angle in degrees (positive rotates clockwise) */
    rotate?: number;
    /** Horizontal skew angle in degrees */
    skewX?: number;
    /** Vertical skew angle in degrees */
    skewY?: number;
};

/** @internal */
type AnimationBaseProps = {
    /** Initial property values before animation starts, or `false` to skip initial state */
    initial?: AnimatableProperties | false;
    /** Target property values to animate towards */
    animate?: AnimatableProperties;
    /** Property values to animate to when the component unmounts */
    exit?: AnimatableProperties;
    /** Whether to animate from `initial` to `animate` when first mounted (default: false) */
    animateOnMount?: boolean;
    /** Callback fired when an animation begins */
    onAnimationStart?: () => void;
    /** Callback fired when an animation completes */
    onAnimationComplete?: () => void;
    /** The child widget to animate (must be a single GTK widget) */
    children?: ReactNode;
};

/**
 * Props for a timed (duration-based) animation using Adw.TimedAnimation.
 *
 * @example
 * ```tsx
 * <AdwTimedAnimation
 *   initial={{ opacity: 0 }}
 *   animate={{ opacity: 1 }}
 *   duration={300}
 *   easing={Adw.Easing.EASE_OUT_CUBIC}
 *   animateOnMount
 * >
 *   <GtkLabel label="Fade in" />
 * </AdwTimedAnimation>
 * ```
 */
export type AdwTimedAnimationProps = AnimationBaseProps & {
    /** Animation duration in milliseconds (default: 300) */
    duration?: number;
    /** Easing function for the animation curve (default: EASE_OUT_CUBIC) */
    easing?: Adw.Easing;
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
 * Props for a spring (physics-based) animation using Adw.SpringAnimation.
 *
 * @example
 * ```tsx
 * <AdwSpringAnimation
 *   initial={{ scale: 0.9, opacity: 0 }}
 *   animate={{ scale: 1, opacity: 1 }}
 *   damping={0.8}
 *   stiffness={200}
 *   animateOnMount
 * >
 *   <GtkButton label="Spring in" />
 * </AdwSpringAnimation>
 * ```
 */
export type AdwSpringAnimationProps = AnimationBaseProps & {
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

/** Union of the timed and spring animation prop shapes. */
export type AnimationProps = AdwTimedAnimationProps | AdwSpringAnimationProps;
