import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { shallowEqual } from "@gtkx/utils";
import type { RefObject } from "react";
import { AnimationCssProvider } from "./animation-css-provider.js";
import { interpolate } from "./interpolation.js";
import type { AnimationTarget, Easing, Transition, WidgetAnimationProps } from "./types.js";

const tweenDefaults = { duration: 0.3 };
const springDefaults = { damping: 10, mass: 1, stiffness: 100 };

const easings: { [K in Easing]: Adw.Easing } = {
    linear: Adw.Easing.LINEAR,
    easeIn: Adw.Easing.EASE_IN,
    easeOut: Adw.Easing.EASE_OUT,
    easeInOut: Adw.Easing.EASE_IN_OUT,
};

const secondsToMilliseconds = (seconds: number): number => seconds * 1000;

const buildTweenAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    transition: Transition,
): Adw.TimedAnimation => {
    const duration = secondsToMilliseconds(transition.duration ?? tweenDefaults.duration);
    const animation = Adw.TimedAnimation.new(widget, 0, 1, duration, target);

    if (transition.ease !== undefined) animation.setEasing(easings[transition.ease]);
    if (transition.repeat !== undefined) animation.setRepeatCount(transition.repeat);
    if (transition.repeatType !== undefined) animation.setAlternate(transition.repeatType !== "loop");

    return animation;
};

const buildSpringAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    transition: Transition,
): Adw.SpringAnimation => {
    const damping = transition.damping ?? springDefaults.damping;
    const mass = transition.mass ?? springDefaults.mass;
    const stiffness = transition.stiffness ?? springDefaults.stiffness;

    const springParams = Adw.SpringParams.newFull(damping, mass, stiffness);
    const animation = Adw.SpringAnimation.new(widget, 0, 1, springParams, target);

    if (transition.velocity !== undefined) animation.setInitialVelocity(transition.velocity);

    return animation;
};

const buildAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    transition: Transition,
): Adw.Animation =>
    transition.type === "spring"
        ? buildSpringAnimation(widget, target, transition)
        : buildTweenAnimation(widget, target, transition);

const restValuesOf = (props: WidgetAnimationProps): AnimationTarget => {
    if (props.animate) return { ...props.animate };
    if (props.initial) return { ...props.initial };
    return {};
};

const shouldAnimateOnMount = (props: WidgetAnimationProps): boolean => {
    const { initial, animate } = props;
    if (initial === undefined || initial === false || animate === undefined) return false;
    return !shallowEqual(initial, animate);
};

/**
 * Imperative driver that animates a single GTK widget by writing interpolated
 * opacity and transform values to a per-widget GTK CSS provider.
 *
 * Obtain an instance from {@link useWidgetAnimation}, then call
 * {@link WidgetAnimator.startAnimation} to transition the widget toward a new
 * {@link AnimationTarget}.
 */
export class WidgetAnimator {
    private cssProvider: AnimationCssProvider;
    private propsRef: RefObject<WidgetAnimationProps>;
    private ref: RefObject<Gtk.Widget | null>;
    private currentValues: AnimationTarget = {};
    private currentAnimation: Adw.Animation | null = null;
    private delayTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param className - Unique GTK CSS class scoping this animator's styles.
     * @param ref - Ref to the widget being animated.
     * @param propsRef - Ref to the latest {@link WidgetAnimationProps}.
     */
    constructor(className: string, ref: RefObject<Gtk.Widget | null>, propsRef: RefObject<WidgetAnimationProps>) {
        this.cssProvider = new AnimationCssProvider(className);
        this.ref = ref;
        this.propsRef = propsRef;
    }

    /**
     * Attaches the CSS provider to the widget and applies its mount state.
     *
     * When `animateOnMount` is `true` and the props request an enter transition,
     * the widget starts from its `initial` values and animates to `animate`;
     * otherwise it is written directly to its resting values.
     *
     * @param animateOnMount - Whether to play the enter animation on mount.
     */
    public applyMount(animateOnMount: boolean): void {
        const widget = this.ref.current;
        if (!widget) return;

        this.cssProvider.attach(widget);

        const props = this.propsRef.current;
        const willAnimateOnMount = animateOnMount && shouldAnimateOnMount(props);

        this.currentValues = willAnimateOnMount && props.initial ? { ...props.initial } : restValuesOf(props);
        this.cssProvider.write(this.currentValues);

        if (willAnimateOnMount && props.animate) {
            this.startAnimation(props.animate);
        }
    }

    /**
     * Animates the widget from its current values to the supplied target,
     * honoring the transition configured on the current props.
     *
     * Any in-flight animation is cancelled before the new one begins.
     *
     * @param target - The {@link AnimationTarget} to animate toward.
     * @param onComplete - Optional callback invoked once the animation settles.
     */
    public startAnimation(target: AnimationTarget, onComplete?: () => void): void {
        const widget = this.ref.current;
        if (!widget) return;

        this.cancelAnimation();

        const from = { ...this.currentValues };
        const to = { ...target };
        const props = this.propsRef.current;
        const transition = props.transition ?? {};

        props.onAnimationStart?.();

        const callback = Adw.CallbackAnimationTarget.new((progress: number) => {
            this.currentValues = interpolate(from, to, progress);
            this.cssProvider.write(this.currentValues);
        });

        const animation = buildAnimation(widget, callback, transition);
        animation.on("done", () => {
            this.currentValues = { ...to };
            this.currentAnimation = null;
            this.propsRef.current.onAnimationComplete?.();
            onComplete?.();
        });

        this.currentAnimation = animation;
        this.play(animation, secondsToMilliseconds(transition.delay ?? 0));
    }

    /**
     * Cancels any in-flight animation and detaches the CSS provider from the
     * widget, releasing all resources held by this animator.
     */
    public dispose(): void {
        this.cancelAnimation();
        this.cssProvider.dispose();
    }

    private clearDelay(): void {
        if (this.delayTimer !== null) {
            clearTimeout(this.delayTimer);
            this.delayTimer = null;
        }
    }

    private play(animation: Adw.Animation, delay: number): void {
        if (delay <= 0) {
            animation.play();
            return;
        }

        this.delayTimer = setTimeout(() => {
            this.delayTimer = null;
            if (this.currentAnimation === animation) {
                animation.play();
            }
        }, delay);
    }

    private cancelAnimation(): void {
        this.clearDelay();
        if (this.currentAnimation) {
            this.currentAnimation.skip();
            this.currentAnimation = null;
        }
    }
}
