import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { shallowEqual } from "@gtkx/utils";
import type { RefObject } from "react";
import { AnimationCssProvider } from "./animation-css-provider.js";
import { interpolate } from "./interpolation.js";
import { buildAnimation, secondsToMilliseconds } from "./transition.js";
import type { AnimationTarget, WidgetAnimationProps } from "./types.js";

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
