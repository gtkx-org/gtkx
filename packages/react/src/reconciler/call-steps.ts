/**
 * The shared {@link "@gtkx/config".CallStep} engine.
 *
 * Both the array-prop and the object/virtual-prop interpreters drive GTK calls
 * from serializable {@link "@gtkx/config".CallStep} rows whose arguments resolve
 * against a runtime item. This module owns that resolution — field access,
 * argument binding, and the single presence/truthiness predicate — so neither
 * interpreter re-spells it.
 */
import type { CallStep, PropCondition } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import { callMethod } from "./reflect-call.js";

/** Reads `path` off `item` when it is an object, or `undefined` otherwise. */
export const itemField = (item: unknown, path: string): unknown =>
    typeof item === "object" && item !== null ? Reflect.get(item, path) : undefined;

/**
 * Whether `value` satisfies `condition`: `"defined"` admits anything but
 * `undefined`, `"nonNull"` anything but `null`/`undefined`, `"truthy"` any
 * truthy value, and an absent condition admits everything.
 *
 * @param value - The value to test.
 * @param condition - The presence/truthiness predicate, or `undefined` for always-true.
 */
export const satisfiesCondition = (value: unknown, condition: PropCondition | undefined): boolean => {
    if (condition === undefined) return true;
    if (condition === "defined") return value !== undefined;
    if (condition === "nonNull") return value != null;
    return Boolean(value);
};

const resolveCallArg = (arg: CallStep["args"][number], item: unknown): unknown => {
    if (arg.kind === "value") return arg.value;
    if (arg.path === undefined) return item;
    const value = itemField(item, arg.path);
    return "fallback" in arg ? (value ?? arg.fallback) : value;
};

/**
 * Runs one {@link "@gtkx/config".CallStep} against `target`, resolving its
 * arguments from `item` and skipping the call when the step's `when` guard fails.
 *
 * @param target - The backing GObject the call applies to.
 * @param step - The call step to run.
 * @param item - The value the step's `item` arguments resolve against.
 */
export const runCallStep = (target: GObject.Object, step: CallStep, item: unknown): void => {
    if (step.when && !satisfiesCondition(itemField(item, step.when.path), step.when.is)) return;
    callMethod(
        target,
        step.method,
        step.args.map((arg) => resolveCallArg(arg, item)),
    );
};

/**
 * Runs a sequence of {@link "@gtkx/config".CallStep}s against `target`, with
 * each step's arguments resolved from `item`'s fields. Shared by the
 * array-prop and object-prop interpreters.
 *
 * @param target - The backing GObject the calls apply to.
 * @param steps - The call steps to run, in order.
 * @param item - The value the steps' `item` arguments resolve against.
 */
export const runCallSteps = (target: GObject.Object, steps: readonly CallStep[], item: unknown): void => {
    for (const step of steps) runCallStep(target, step, item);
};
