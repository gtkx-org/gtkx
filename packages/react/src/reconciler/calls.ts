import type { Arg, BuildArg, Call, ListProp } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import { createObject } from "./instance.js";
import type { Props } from "./kinds.js";
import { typeInfoOf } from "./metadata.js";

export type CallContext = {
    child?: GObject.Object | null;
    item?: unknown;
    index?: number;
    sibling?: GObject.Object | null;
    adopted?: GObject.Object | null;
    props?: Props | undefined;
};

const resolveRef = (ref: string, ctx: CallContext): unknown => {
    switch (ref) {
        case "child":
            return ctx.child;
        case "item":
            return ctx.item;
        case "index":
            return ctx.index;
        case "sibling":
            return ctx.sibling ?? null;
        case "adopted":
            return ctx.adopted;
        default:
            return undefined;
    }
};

const readField = (item: unknown, field: string): unknown =>
    typeof item === "object" && item !== null ? (item as Record<string, unknown>)[field] : undefined;

const buildNested = (arg: BuildArg, ctx: CallContext): GObject.Object => {
    const object = createObject(arg.build);
    const rule = typeInfoOf(arg.build).listProps.get(arg.prop);
    const items = readField(ctx.item, arg.from);
    if (rule !== undefined && Array.isArray(items)) {
        for (const item of items) addListItem(object, rule, item, ctx.props);
    }
    return object;
};

const resolveArg = (arg: Arg, ctx: CallContext): unknown => {
    if (typeof arg === "string") return resolveRef(arg, ctx);
    if ("build" in arg) return buildNested(arg, ctx);
    if ("prop" in arg) return ctx.props?.[arg.prop];
    if ("field" in arg) {
        const value = readField(ctx.item, arg.field);
        return value === undefined ? arg.or : value;
    }
    return arg.literal;
};

const invoke = (target: GObject.Object, method: string, args: unknown[]): unknown => {
    const fn: unknown = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new Error(`Method ${method} is not available on ${target.constructor.name}`);
    }
    return Reflect.apply(fn as (...args: unknown[]) => unknown, target, args);
};

export const runCall = (target: GObject.Object, call: Call, ctx: CallContext, implicitArgs: unknown[]): unknown => {
    if (typeof call === "string") return invoke(target, call, implicitArgs);
    return invoke(
        target,
        call.method,
        call.args.map((arg) => resolveArg(arg, ctx)),
    );
};

const appliesTo = (call: Call, item: unknown): boolean => {
    if (typeof call === "string") return true;
    if (call.when !== undefined && readField(item, call.when) === undefined) return false;
    return call.unless === undefined || call.unless.every((field) => readField(item, field) === undefined);
};

export const addListItem = (target: GObject.Object, rule: ListProp, item: unknown, props: Props | undefined): void => {
    for (const call of Array.isArray(rule.add) ? rule.add : [rule.add]) {
        if (appliesTo(call, item)) runCall(target, call, { item, props }, [item]);
    }
};

export const callMethod = (target: GObject.Object, method: string, args: unknown[]): unknown =>
    invoke(target, method, args);
