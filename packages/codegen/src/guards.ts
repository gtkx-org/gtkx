import { isRecord } from "@gtkx/utils";

type Guard<T> = (value: unknown) => value is T;
type FieldGuards<T> = { [K in keyof T]-?: Guard<T[K]> };

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";

const arrayGuard = <T>(isEntry: Guard<T>): Guard<T[]> =>
    (value: unknown): value is T[] => Array.isArray(value) && value.every((entry: unknown) => isEntry(entry));

const optionalGuard = <T>(isPresent: Guard<T>): Guard<T | undefined> =>
    (value: unknown): value is T | undefined => value === undefined || isPresent(value);

const fieldNames = <T extends object>(guards: FieldGuards<T>): (keyof T & string)[] =>
    Object.keys(guards) as (keyof T & string)[];

const hasFields = <T extends object>(value: unknown, guards: FieldGuards<T>): value is T =>
    isRecord(value) && fieldNames(guards).every((name) => guards[name](value[name]));

export { arrayGuard, hasFields, isNumber, isString, optionalGuard };
