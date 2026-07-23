import type { Arg, Call } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";

export type CallContext = {
    child?: GObject.Object | null;
    item?: unknown;
    index?: number;
    sibling?: GObject.Object | null;
    adopted?: GObject.Object | null;
    props?: Record<string, unknown>;
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

const resolveArg = (arg: Arg, ctx: CallContext): unknown => {
    if (typeof arg === "string") return resolveRef(arg, ctx);
    if ("prop" in arg) return ctx.props?.[arg.prop];
    if ("field" in arg) {
        const item = ctx.item;
        const value =
            typeof item === "object" && item !== null ? (item as Record<string, unknown>)[arg.field] : undefined;
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

export const callMethod = (target: GObject.Object, method: string, args: unknown[]): unknown => invoke(target, method, args);
