/**
 * Invoke `method` on `target` with `args` when it resolves to a function,
 * returning the call result; returns `undefined` when no such method exists.
 * For dynamic dispatch where the method name is known only at runtime.
 */
export const callMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};

/**
 * Invoke `method` on `target` with `args`, throwing a {@link TypeError} when
 * `target` has no such method. The strict counterpart to {@link callMethod} for
 * operations that must not silently no-op.
 */
export const callRequiredMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new TypeError(`Method '${method}' not found on '${target.constructor.name}'`);
    }
    return Reflect.apply(fn, target, args);
};
