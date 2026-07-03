export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    prototype: T;
};

export function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);
    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
}

export function walkClassChain<T>(cls: AnyClass | null, visit: (ancestor: AnyClass) => T | undefined): T | undefined {
    let current = cls;
    while (current !== null) {
        const result = visit(current);
        if (result !== undefined) return result;
        current = getParentClass(current);
    }
    return undefined;
}
