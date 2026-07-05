import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { resolveEasing } from "./easing.js";
import { resolveSpringParams } from "./spring-params.js";
import type { Easing, Transition } from "./types.js";

const DEFAULT_TWEEN_DURATION = 0.3;
const DEFAULT_EASE: Easing = "easeOut";

export const secondsToMilliseconds = (seconds: number): number => seconds * 1000;

const resolveDuration = (seconds: number): number =>
    seconds === Number.POSITIVE_INFINITY ? Adw.DURATION_INFINITE : secondsToMilliseconds(seconds);

const resolveRepeatCount = (repeat: number): number => (Number.isFinite(repeat) ? repeat + 1 : 0);

const applyShared = (animation: Adw.Animation, transition: Transition): void => {
    if (transition.followEnableAnimations !== undefined) {
        animation.setFollowEnableAnimationsSetting(transition.followEnableAnimations);
    }
};

const buildTweenAnimation = (
    widget: Gtk.Widget,
    target: Adw.AnimationTarget,
    transition: Transition,
): Adw.TimedAnimation => {
    const duration = resolveDuration(transition.duration ?? DEFAULT_TWEEN_DURATION);
    const animation = Adw.TimedAnimation.new(widget, 0, 1, duration, target);

    animation.setEasing(resolveEasing(transition.ease ?? DEFAULT_EASE));
    if (transition.repeat !== undefined) animation.setRepeatCount(resolveRepeatCount(transition.repeat));
    if (transition.repeatType !== undefined) {
        animation.setAlternate(transition.repeatType === "reverse" || transition.repeatType === "mirror");
    }
    if (transition.reverse !== undefined) animation.setReverse(transition.reverse);
    applyShared(animation, transition);

    return animation;
};

const buildSpringAnimation = (
    widget: Gtk.Widget,
    target: Adw.AnimationTarget,
    transition: Transition,
): Adw.SpringAnimation => {
    const animation = Adw.SpringAnimation.new(widget, 0, 1, resolveSpringParams(transition), target);

    if (transition.velocity !== undefined) animation.setInitialVelocity(transition.velocity);
    if (transition.epsilon !== undefined) animation.setEpsilon(transition.epsilon);
    if (transition.clamp !== undefined) animation.setClamp(transition.clamp);
    applyShared(animation, transition);

    return animation;
};

export const buildAnimation = (
    widget: Gtk.Widget,
    target: Adw.AnimationTarget,
    transition: Transition,
): Adw.Animation =>
    transition.type === "spring"
        ? buildSpringAnimation(widget, target, transition)
        : buildTweenAnimation(widget, target, transition);
