import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { isShallowEqual } from "@gtkx/utils";
import type { RefObject } from "react";
import { AnimationCssProvider } from "./animation-css-provider.js";
import type { AnimationProps, AnimationTarget } from "./animation-types.js";
import { interpolate } from "./interpolation.js";
import { buildAnimation, secondsToMilliseconds } from "./transition.js";

const restValuesOf = (props: AnimationProps): AnimationTarget => {
    if (props.animate) return { ...props.animate };
    if (props.initial) return { ...props.initial };
    return {};
};

const shouldAnimateOnMount = (props: AnimationProps): boolean => {
    const { initial, animate } = props;
    if (initial === undefined || initial === false || animate === undefined) return false;
    return !isShallowEqual(initial, animate);
};

export class WidgetAnimator {
    private cssProvider: AnimationCssProvider;
    private propsRef: RefObject<AnimationProps>;
    private ref: RefObject<Gtk.Widget | null>;
    private currentValues: AnimationTarget = {};
    private currentAnimation: Adw.Animation | null = null;
    private cancelCurrent: (() => void) | null = null;
    private delayTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(className: string, ref: RefObject<Gtk.Widget | null>, propsRef: RefObject<AnimationProps>) {
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
        let cancelled = false;
        this.cancelCurrent = () => {
            cancelled = true;
        };
        animation.on("done", () => {
            if (cancelled) return;
            this.currentValues = { ...to };
            this.currentAnimation = null;
            this.cancelCurrent = null;
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
            this.cancelCurrent?.();
            if (this.currentAnimation.getState() === Adw.AnimationState.PLAYING) {
                this.currentAnimation.pause();
            }
            this.currentAnimation = null;
            this.cancelCurrent = null;
        }
    }
}
