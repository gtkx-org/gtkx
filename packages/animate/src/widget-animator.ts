import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { shallowEqual } from "@gtkx/utils";
import type { RefObject } from "react";
import { AnimationCssProvider } from "./animation-css-provider.js";
import { interpolate } from "./interpolation.js";
import type { AnimatableProperties, NamedEasing, Transition, WidgetAnimationProps } from "./types.js";

const tweenDefaults = { duration: 0.3 };
const springDefaults = { damping: 1, mass: 1, stiffness: 100 };

const namedEasings: { [K in NamedEasing]: Adw.Easing } = {
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

    if (transition.ease !== undefined) animation.setEasing(namedEasings[transition.ease]);
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

    const springParams = Adw.SpringParams.new(damping, mass, stiffness);
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

const restValuesOf = (props: WidgetAnimationProps): AnimatableProperties => {
    if (props.animate) return { ...props.animate };
    if (props.initial) return { ...props.initial };
    return {};
};

const shouldAnimateOnMount = (props: WidgetAnimationProps): boolean => {
    const { initial, animate } = props;
    if (initial === undefined || initial === false || animate === undefined) return false;
    return !shallowEqual(initial, animate);
};

export class WidgetAnimator {
    private cssProvider: AnimationCssProvider;
    private propsRef: RefObject<WidgetAnimationProps>;
    private ref: RefObject<Gtk.Widget | null>;
    private currentValues: AnimatableProperties = {};
    private currentAnimation: Adw.Animation | null = null;
    private delayTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(className: string, ref: RefObject<Gtk.Widget | null>, propsRef: RefObject<WidgetAnimationProps>) {
        this.cssProvider = new AnimationCssProvider(className);
        this.ref = ref;
        this.propsRef = propsRef;
    }

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

    public startAnimation(target: AnimatableProperties, onComplete?: () => void): void {
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
