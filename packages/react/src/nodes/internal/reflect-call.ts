/**
 * Invokes a method on `target` by name through `Reflect`, the table
 * interpreters' shared dispatch primitive: data rows carry method-name
 * strings, and a row whose method the target lacks is silently inert.
 *
 * @param target - The object exposing the method.
 * @param method - The camelCase method name to invoke.
 * @param args - The call's argument list.
 * @returns The call's result, or `undefined` when the method is absent.
 */
export const callMethod = (target: object, method: string, args: readonly unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};
