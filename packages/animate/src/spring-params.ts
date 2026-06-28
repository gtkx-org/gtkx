import * as Adw from "@gtkx/gi/adw";
import type { Transition } from "./types.js";

const DEFAULT_STIFFNESS = 100;
const DEFAULT_DAMPING = 10;
const DEFAULT_MASS = 1;

const MIN_DAMPING_RATIO = 0.05;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const dampingFloor = (mass: number, stiffness: number): number => MIN_DAMPING_RATIO * 2 * Math.sqrt(mass * stiffness);

export const resolveSpringParams = (transition: Transition): Adw.SpringParams => {
    const stiffness = transition.stiffness ?? DEFAULT_STIFFNESS;
    const mass = transition.mass ?? DEFAULT_MASS;

    if (transition.dampingRatio !== undefined) {
        return Adw.SpringParams.new(Math.max(MIN_DAMPING_RATIO, transition.dampingRatio), mass, stiffness);
    }

    if (transition.bounce !== undefined) {
        const ratio = Math.max(MIN_DAMPING_RATIO, 1 - clamp01(transition.bounce));
        return Adw.SpringParams.new(ratio, mass, stiffness);
    }

    const damping = Math.max(transition.damping ?? DEFAULT_DAMPING, dampingFloor(mass, stiffness));
    return Adw.SpringParams.newFull(damping, mass, stiffness);
};
