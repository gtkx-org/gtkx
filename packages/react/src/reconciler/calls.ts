import type { ListProp } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";

const invoke = (target: GObject.Object, method: string, args: unknown[]): unknown => {
    const fn: unknown = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new Error(`Method ${method} is not available on ${target.constructor.name}`);
    }
    return Reflect.apply(fn as (...args: unknown[]) => unknown, target, args);
};

export const runCall = (target: GObject.Object, method: string, args: unknown[]): unknown =>
    invoke(target, method, args);

export const addListItem = (target: GObject.Object, rule: ListProp, item: unknown): void => {
    for (const method of Array.isArray(rule.add) ? rule.add : [rule.add]) invoke(target, method, [item]);
};

export const callMethod = (target: GObject.Object, method: string, args: unknown[]): unknown =>
    invoke(target, method, args);
