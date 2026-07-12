/**
 * Calls the named method on `target` with the given arguments, returning `undefined` when the
 * property is missing or not callable.
 *
 * @param target The object to read the method from and bind as `this`.
 * @param method The method name to look up.
 * @param args Arguments passed to the method.
 * @returns The method's return value, or `undefined` when it is not a function.
 */
export const callMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};
