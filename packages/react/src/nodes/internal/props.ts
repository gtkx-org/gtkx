/**
 * Returns whether `key` differs between two prop snapshots.
 *
 * A `null` previous snapshot counts as a change for every key, so the first
 * commit always applies. Values are compared by strict equality (`===`).
 *
 * @typeParam T - The props shape.
 * @param oldProps - The previous props, or `null` on the first commit.
 * @param newProps - The current props.
 * @param key - The key to compare.
 * @returns Whether `newProps[key]` differs from `oldProps[key]`.
 */
export const hasChanged = <T>(oldProps: T | null, newProps: T, key: keyof T): boolean =>
    !oldProps || oldProps[key] !== newProps[key];
