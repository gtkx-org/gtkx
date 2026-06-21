import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { shallowEqual } from "@gtkx/utils";
import { type RefObject, useId, useLayoutEffect, useRef } from "react";
import { AnimationCssProvider } from "./animation-css-provider.js";
import { interpolate } from "./interpolation.js";
import type { AdwSpringAnimationProps, AdwTimedAnimationProps, AnimatableProperties } from "./types.js";

export type WidgetAnimationProps =
    | ({ kind: "timed" } & AdwTimedAnimationProps)
    | ({ kind: "spring" } & AdwSpringAnimationProps);

const timedDefaults = { duration: 300 };
const springDefaults = { damping: 1, mass: 1, stiffness: 100 };

const sanitizeId = (id: string): string => `gtkx-anim-${id.replace(/[^a-zA-Z0-9]/g, "")}`;

const buildTimedAnimation = (
    widget: Gtk.Widget,
    target: Adw.CallbackAnimationTarget,
    props: AdwTimedAnimationProps,
): Adw.TimedAnimation => {
    const duration = props.duration ?? timedDefaults.duration;
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
    const damping = props.damping ?? springDefaults.damping;
    const mass = props.mass ?? springDefaults.mass;
    const stiffness = props.stiffness ?? springDefaults.stiffness;

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

const resolveInitialValues = (props: WidgetAnimationProps): AnimatableProperties => {
    const { initial, animate, animateOnMount } = props;
    const animateValues = animate ? { ...animate } : {};

    if (!animateOnMount) {
        return animateValues;
    }

    if (initial === false) {
        return {};
    }

    return initial !== undefined ? { ...initial } : animateValues;
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
        this.currentValues = resolveInitialValues(props);
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
        if (shallowEqual(previous, props.animate)) return;

        driver.startAnimation(props.animate);
    }, [ref, driver, props.animate]);

    return driver;
};
