import { isEqualWith, isPlainObject } from "es-toolkit";

const isDataContainer = (value: unknown): boolean => Array.isArray(value) || isPlainObject(value);

const compareValues = (a: unknown, b: unknown): boolean | undefined =>
    isDataContainer(a) && isDataContainer(b) ? undefined : a === b;

const isDeepEqual = (a: unknown, b: unknown): boolean => isEqualWith(a, b, compareValues);

export { isDeepEqual };
