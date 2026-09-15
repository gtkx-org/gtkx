import type { DistributedOmit } from "type-fest";
import { omit as omitKeys } from "es-toolkit";

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): DistributedOmit<T, K> {
    return omitKeys(obj, keys) as DistributedOmit<T, K>;
}

export { omit };

export type { DistributedOmit } from "type-fest";
