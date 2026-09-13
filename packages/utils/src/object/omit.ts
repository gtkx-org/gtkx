import type { DistributedOmit } from "type-fest";

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): DistributedOmit<T, K> {
    const excluded: Set<PropertyKey> = new Set(keys);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (!excluded.has(key)) {
            result[key] = value;
        }
    }

    return result as DistributedOmit<T, K>;
}

export { omit };

export type { DistributedOmit } from "type-fest";
