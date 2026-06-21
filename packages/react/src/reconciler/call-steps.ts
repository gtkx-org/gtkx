import type { CallStep, PropCondition } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import { invokeRequiredMethod } from "./reflect-call.js";

export const itemField = (item: unknown, path: string): unknown =>
    typeof item === "object" && item !== null ? Reflect.get(item, path) : undefined;

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

export const runCallStep = (target: GObject.Object, step: CallStep, item: unknown): void => {
    if (step.when && !satisfiesCondition(itemField(item, step.when.path), step.when.is)) return;
    invokeRequiredMethod(
        target,
        step.method,
        step.args.map((arg) => resolveCallArg(arg, item)),
    );
};

export const runCallSteps = (target: GObject.Object, steps: CallStep[], item: unknown): void => {
    for (const step of steps) runCallStep(target, step, item);
};
