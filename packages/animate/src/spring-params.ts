import * as Adw from "@gtkx/gi/adw";
import type { Transition } from "./types.js";

const DEFAULT_STIFFNESS = 100;
const DEFAULT_DAMPING = 10;
const DEFAULT_MASS = 1;
const DEFAULT_SPRING_DURATION = 0.8;
const DEFAULT_BOUNCE = 0.3;

const MIN_DAMPING_RATIO = 0.05;
const MAX_DAMPING_RATIO = 1;

const SPRING_MIN_DURATION = 0.01;
const SPRING_MAX_DURATION = 10;
const SAFE_MIN = 0.001;
const ROOT_ITERATIONS = 12;

const clamp = (min: number, max: number, value: number): number => Math.min(max, Math.max(min, value));

const dampingFloor = (mass: number, stiffness: number): number => MIN_DAMPING_RATIO * 2 * Math.sqrt(mass * stiffness);

const calcAngularFreq = (undampedFreq: number, dampingRatio: number): number =>
    undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio);

const approximateRoot = (
    envelope: (value: number) => number,
    derivative: (value: number) => number,
    initialGuess: number,
): number => {
    let result = initialGuess;
    for (let iteration = 1; iteration < ROOT_ITERATIONS; iteration += 1) {
        result = result - envelope(result) / derivative(result);
    }
    return result;
};

type DerivedSpring = { stiffness: number; damping: number };

const findSpring = (durationSeconds: number, bounce: number, mass: number): DerivedSpring => {
    const dampingRatio = clamp(MIN_DAMPING_RATIO, MAX_DAMPING_RATIO, 1 - bounce);
    const duration = clamp(SPRING_MIN_DURATION, SPRING_MAX_DURATION, durationSeconds);

    let envelope: (value: number) => number;
    let derivative: (value: number) => number;

    if (dampingRatio < 1) {
        envelope = (undampedFreq) => {
            const exponentialDecay = undampedFreq * dampingRatio;
            const delta = exponentialDecay * duration;
            const angularFreq = calcAngularFreq(undampedFreq, dampingRatio);
            return SAFE_MIN - (exponentialDecay / angularFreq) * Math.exp(-delta);
        };
        derivative = (undampedFreq) => {
            const exponentialDecay = undampedFreq * dampingRatio;
            const delta = exponentialDecay * duration;
            const term = dampingRatio * dampingRatio * undampedFreq * undampedFreq * duration;
            const decay = Math.exp(-delta);
            const angularFreq = calcAngularFreq(undampedFreq * undampedFreq, dampingRatio);
            const factor = -envelope(undampedFreq) + SAFE_MIN > 0 ? -1 : 1;
            return (factor * (-term * decay)) / angularFreq;
        };
    } else {
        envelope = (undampedFreq) => {
            const decay = Math.exp(-undampedFreq * duration);
            return -SAFE_MIN + decay * (undampedFreq * duration + 1);
        };
        derivative = (undampedFreq) => {
            const decay = Math.exp(-undampedFreq * duration);
            return decay * (-undampedFreq * (duration * duration));
        };
    }

    const undampedFreq = approximateRoot(envelope, derivative, 5 / duration);

    if (Number.isNaN(undampedFreq)) {
        return { stiffness: DEFAULT_STIFFNESS, damping: DEFAULT_DAMPING };
    }

    const stiffness = undampedFreq * undampedFreq * mass;
    return { stiffness, damping: dampingRatio * 2 * Math.sqrt(mass * stiffness) };
};

const fromVisualDuration = (visualDuration: number, bounce: number): Adw.SpringParams => {
    const angularFreq = (2 * Math.PI) / (visualDuration * 1.2);
    const stiffness = angularFreq * angularFreq;
    const damping = 2 * clamp(MIN_DAMPING_RATIO, MAX_DAMPING_RATIO, 1 - bounce) * Math.sqrt(stiffness);
    return Adw.SpringParams.newFull(damping, DEFAULT_MASS, stiffness);
};

export const resolveSpringParams = (transition: Transition): Adw.SpringParams => {
    const mass = transition.mass ?? DEFAULT_MASS;

    if (transition.dampingRatio !== undefined) {
        const stiffness = transition.stiffness ?? DEFAULT_STIFFNESS;
        return Adw.SpringParams.new(Math.max(MIN_DAMPING_RATIO, transition.dampingRatio), mass, stiffness);
    }

    const hasPhysics =
        transition.stiffness !== undefined || transition.damping !== undefined || transition.mass !== undefined;
    const hasDuration =
        transition.duration !== undefined || transition.bounce !== undefined || transition.visualDuration !== undefined;

    if (!hasPhysics && hasDuration) {
        if (transition.visualDuration !== undefined) {
            return fromVisualDuration(transition.visualDuration, transition.bounce ?? 0);
        }
        const derived = findSpring(
            transition.duration ?? DEFAULT_SPRING_DURATION,
            transition.bounce ?? DEFAULT_BOUNCE,
            mass,
        );
        return Adw.SpringParams.newFull(derived.damping, mass, derived.stiffness);
    }

    const stiffness = transition.stiffness ?? DEFAULT_STIFFNESS;
    const damping = Math.max(transition.damping ?? DEFAULT_DAMPING, dampingFloor(mass, stiffness));
    return Adw.SpringParams.newFull(damping, mass, stiffness);
};
