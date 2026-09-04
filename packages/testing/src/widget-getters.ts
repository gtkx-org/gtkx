import { getClassType, getInstanceType, TYPE_INVALID, typeName } from "@gtkx/runtime";
import { resolveWrapperClass } from "@gtkx/runtime/internal";
import { type AnyClass, walkClassChain } from "@gtkx/utils";

const UNNAMED_TYPE_TAG = "Object";

const getWidgetMethod = (widget: object, name: string): unknown => Reflect.get(widget, name);
const getWidgetTypeName = (widget: object): string | null => typeName(getInstanceType(widget));
const isClass = (value: unknown): value is AnyClass => typeof value === "function";

const nonEmpty = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined;

const getObjectClass = (object: object): AnyClass | null => {
    const cls: unknown = object.constructor;

    return isClass(cls) ? cls : null;
};

const getNearestClassName = (object: object): string | undefined =>
    walkClassChain(getObjectClass(object), (ancestor) => nonEmpty(ancestor.name));

const getUntypedClassName = (object: object): string | undefined => {
    const cls = getObjectClass(object);

    return cls !== null && getClassType(cls) === TYPE_INVALID ? nonEmpty(cls.name) : undefined;
};

const getExactWrapperName = (type: bigint): string | undefined => {
    const wrapper = resolveWrapperClass(type);

    return wrapper !== null && getClassType(wrapper) === type ? nonEmpty(wrapper.name) : undefined;
};

const getTypeTag = (object: object): string => {
    const type = getInstanceType(object);

    return (
        getUntypedClassName(object) ??
        getExactWrapperName(type) ??
        nonEmpty(typeName(type)) ??
        getNearestClassName(object) ??
        UNNAMED_TYPE_TAG
    );
};

const isDefaultWidgetName = (widget: object, name: string): boolean =>
    name.length === 0 || name === getWidgetTypeName(widget);

const hasWidgetMethod = (widget: object, name: string): boolean =>
    typeof getWidgetMethod(widget, name) === "function";

/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- callers name the signature */
const getCallableMethod = <Args extends unknown[], Result>(
    widget: object,
    name: string,
): ((...args: Args) => Result) | null => {
    const fn = getWidgetMethod(widget, name);

    return typeof fn === "function" ? (fn as (...args: Args) => Result).bind(widget) : null;
};

const callBooleanGetter = (widget: object, method: string): boolean | null => {
    const value = getCallableMethod<[], unknown>(widget, method)?.();

    return typeof value === "boolean" ? value : null;
};

const callStringGetter = (widget: object, method: string): string | null => {
    const value = getCallableMethod<[], unknown>(widget, method)?.();

    return typeof value === "string" ? value : null;
};

export {
    callBooleanGetter,
    callStringGetter,
    getCallableMethod,
    getTypeTag,
    getWidgetTypeName,
    hasWidgetMethod,
    isDefaultWidgetName,
};
