import { createRequire } from "node:module";

export const callMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};

export const packageVersion = (importMetaUrl: string): string =>
    (createRequire(importMetaUrl)("../package.json") as { version: string }).version;
