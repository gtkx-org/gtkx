import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useId, useLayoutEffect, useRef } from "react";
import {
    AnimationCssProvider,
    areAnimatedPropsEqual,
    DEFAULT_SPRING_DAMPING,
    DEFAULT_SPRING_MASS,
    DEFAULT_SPRING_STIFFNESS,
    DEFAULT_TIMED_DURATION,
    interpolate,
} from "./animation-css.js";
import type { AdwSpringAnimationProps, AdwTimedAnimationProps, AnimatableProperties } from "./types.js";

export type WidgetAnimationProps =
    | ({ kind: "timed" } & AdwTimedAnimationProps)
    | ({ kind: "spring" } & AdwSpringAnimationProps);

const sanitizeId = (id: string): string => `gtkx-anim-${id.replace(/[^a-zA-Z0-9]/g, "")}`;

const buildTimedAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    props: AdwTimedAnimationProps,
): Adw.TimedAnimation => {
    const duration = props.duration ?? DEFAULT_TIMED_DURATION;
    const animation = Adw.TimedAnimation.new(widget, 0, 1, duration, target);

    if (props.easing !== undefined) animation.setEasing(props.easing);
    if (props.repeat !== undefined) animation.setRepeatCount(props.repeat);
    if (props.reverse !== undefined) animation.setReverse(props.reverse);
    if (props.alternate !== undefined) animation.setAlternate(props.alternate);

    return animation;
};

const buildSpringAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    props: AdwSpringAnimationProps,
): Adw.SpringAnimation => {
    const damping = props.damping ?? DEFAULT_SPRING_DAMPING;
    const mass = props.mass ?? DEFAULT_SPRING_MASS;
    const stiffness = props.stiffness ?? DEFAULT_SPRING_STIFFNESS;

    const springParams = Adw.SpringParams.new(damping, mass, stiffness);
    const animation = Adw.SpringAnimation.new(widget, 0, 1, springParams, target);

    if (props.initialVelocity !== undefined) animation.setInitialVelocity(props.initialVelocity);
    if (props.clamp !== undefined) animation.setClamp(props.clamp);

    return animation;
};

const buildAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    props: WidgetAnimationProps,
): Adw.Animation =>
    props.kind === "spring" ? buildSpringAnimation(widget, target, props) : buildTimedAnimation(widget, target, props);

const baselineValues = (props: WidgetAnimationProps): AnimatableProperties => {
    const { initial, animate, animateOnMount } = props;

    if (initial === false || !animateOnMount) {
        return animate ? { ...animate } : {};
    }

    return { ...(initial ?? animate ?? {}) };
};

const mountValues = (props: WidgetAnimationProps): AnimatableProperties => {
    const { initial, animate, animateOnMount } = props;

    if (animateOnMount && animate) {
        return { ...(initial !== false ? (initial ?? animate ?? {}) : {}) };
    }

    return baselineValues(props);
};

export class AnimationDriver {
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

    public applyMount(): void {
        const widget = this.ref.current;
        if (!widget) return;

        this.cssProvider.attach(widget);

        const props = this.propsRef.current;
        this.currentValues = mountValues(props);
        this.cssProvider.write(this.currentValues);

        if (props.animateOnMount && props.animate) {
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

        props.onAnimationStart?.();

        const callback = Adw.CallbackAnimationTarget.new((progress: number) => {
            this.currentValues = interpolate(from, to, progress);
            this.cssProvider.write(this.currentValues);
        });

        const animation = buildAnimation(widget, callback, props);
        animation.on("done", () => {
            this.currentValues = { ...to };
            this.currentAnimation = null;
            this.propsRef.current.onAnimationComplete?.();
            onComplete?.();
        });

        this.currentAnimation = animation;
        this.play(animation, props.delay ?? 0);
    }

    public dispose(): void {
        if (this.delayTimer !== null) {
            clearTimeout(this.delayTimer);
            this.delayTimer = null;
        }
        this.cancelAnimation();
        this.cssProvider.dispose();
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
        if (this.currentAnimation) {
            this.currentAnimation.skip();
            this.currentAnimation = null;
        }
    }
}

export const useWidgetAnimation = (ref: RefObject<Gtk.Widget | null>, props: WidgetAnimationProps): AnimationDriver => {
    const className = sanitizeId(useId());
    const propsRef = useRef(props);
    propsRef.current = props;

    const driverRef = useRef<AnimationDriver | null>(null);
    if (!driverRef.current) {
        driverRef.current = new AnimationDriver(className, ref, propsRef);
    }
    const driver = driverRef.current;

    useLayoutEffect(() => {
        driver.applyMount();
        return () => driver.dispose();
    }, [driver]);

    const previousAnimateRef = useRef<AnimatableProperties | undefined>(props.animate);
    useLayoutEffect(() => {
        const previous = previousAnimateRef.current;
        previousAnimateRef.current = props.animate;

        if (!ref.current || !props.animate) return;
        if (areAnimatedPropsEqual(previous, props.animate)) return;

        driver.startAnimation(props.animate);
    }, [ref, driver, props.animate]);

    return driver;
};
