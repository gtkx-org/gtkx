import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";

export type TimedTransition = {
    type?: "timed";
    duration?: number;
    easing?: Adw.Easing;
};

export type SpringTransition = {
    type: "spring";
    stiffness?: number;
    damping?: number;
    mass?: number;
};

export type Transition = TimedTransition | SpringTransition;

const DEFAULT_TIMED_DURATION = 250;
const DEFAULT_SPRING_STIFFNESS = 100;
const DEFAULT_SPRING_DAMPING = 10;
const DEFAULT_SPRING_MASS = 1;

function convertToDampingRatio(stiffness: number, damping: number, mass: number): number {
    const criticalDamping = 2 * Math.sqrt(stiffness * mass);
    return damping / criticalDamping;
}

export function createAnimation(
    widget: Gtk.Widget,
    from: number,
    to: number,
    transition: Transition,
    onValue: (value: number) => void,
): Adw.Animation {
    const target = new Adw.CallbackAnimationTarget(onValue);

    if (transition.type === "spring") {
        const stiffness = transition.stiffness ?? DEFAULT_SPRING_STIFFNESS;
        const damping = transition.damping ?? DEFAULT_SPRING_DAMPING;
        const mass = transition.mass ?? DEFAULT_SPRING_MASS;
        const dampingRatio = convertToDampingRatio(stiffness, damping, mass);
        const springParams = new Adw.SpringParams(dampingRatio, mass, stiffness);
        return new Adw.SpringAnimation(widget, from, to, springParams, target);
    }

    const duration = transition.duration ?? DEFAULT_TIMED_DURATION;
    const easing = transition.easing ?? Adw.Easing.EASE_OUT_CUBIC;
    const animation = new Adw.TimedAnimation(widget, from, to, duration, target);
    animation.setEasing(easing);
    return animation;
}
