export const callMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};

export const invokeRequiredMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new TypeError(`Method '${method}' not found on '${target.constructor.name}'`);
    }
    return Reflect.apply(fn, target, args);
};
