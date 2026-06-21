/**
 * Invokes `method` on `target` with `args`, returning `undefined` when the method is absent.
 *
 * Use this for genuinely optional probes where a missing method is an expected,
 * tolerated outcome. For config-declared dispatch that must succeed, use
 * {@link invokeRequiredMethod} so missing methods surface as errors.
 *
 * @param target - The object to invoke the method on.
 * @param method - The name of the method to invoke.
 * @param args - The positional arguments to pass to the method.
 * @returns The method's return value, or `undefined` when no such method exists.
 */
export const callMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};

/**
 * Invokes `method` on `target` with `args`, throwing a {@link TypeError} when the method is absent.
 *
 * Use this for mandatory, config-declared dispatch so that codegen/runtime drift on a
 * declared method name fails loudly instead of silently no-opping.
 *
 * @param target - The object to invoke the method on.
 * @param method - The name of the method to invoke.
 * @param args - The positional arguments to pass to the method.
 * @returns The method's return value.
 * @throws {TypeError} When `target` has no callable method named `method`.
 */
export const invokeRequiredMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new TypeError(`Method '${method}' not found on '${target.constructor.name}'`);
    }
    return Reflect.apply(fn, target, args);
};
