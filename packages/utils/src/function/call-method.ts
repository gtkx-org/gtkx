const isCallable = (value: unknown): value is (this: object, ...args: unknown[]) => unknown =>
    typeof value === "function";

function callMethod(target: object, method: string, args: unknown[]): unknown {
    const fn: unknown = Reflect.get(target, method);

    return isCallable(fn) ? Reflect.apply(fn, target, args) : undefined;
}

export { callMethod };
