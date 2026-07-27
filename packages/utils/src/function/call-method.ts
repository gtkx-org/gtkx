/**
 * Calls the named method on `target` with the given arguments, returning `undefined` when the
 * property is missing or not callable.
 *
 * @param target - The object to read the method from and bind as `this`.
 * @param method - The name of the method to look up.
 * @param args - The arguments passed to the method.
 * @returns The method's return value, or `undefined` when it is not a function.
 *
 * @example
 * callMethod(console, "log", ["hi"]); // logs "hi"; returns undefined
 */
const isCallable = (value: unknown): value is (this: object, ...args: unknown[]) => unknown =>
    typeof value === "function";

function callMethod(target: object, method: string, args: unknown[]): unknown {
    const fn: unknown = Reflect.get(target, method);

    return isCallable(fn) ? Reflect.apply(fn, target, args) : undefined;
}

export { callMethod };
