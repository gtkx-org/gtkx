import { isSameArrayBy } from "./is-same-array-by.ts";

function isSameArray<T>(a: T[], b: T[]): boolean {
    return isSameArrayBy(a, b, (x, y) => x === y);
}

export { isSameArray };
