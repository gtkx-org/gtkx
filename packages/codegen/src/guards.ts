import { isRecord } from "@gtkx/utils";

type Guard<T> = (value: unknown) => value is T;
type FieldGuards<T> = { [K in keyof T]-?: Guard<T[K]> };

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isNumber = (value: unknown): value is number => typeof value === "number";
const isString = (value: unknown): value is string => typeof value === "string";

const arrayGuard = <T>(isEntry: Guard<T>): Guard<T[]> =>
    (value: unknown): value is T[] => Array.isArray(value) && value.every((entry: unknown) => isEntry(entry));

const hasFields = <T extends object>(value: unknown, guards: FieldGuards<T>): value is T =>
    isRecord(value) && Object.entries(guards).every(([name, guard]) => (guard as Guard<unknown>)(value[name]));

export { arrayGuard, hasFields, isBoolean, isNumber, isString };
