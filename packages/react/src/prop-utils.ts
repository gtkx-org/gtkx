import type { Props } from "./factory.js";

/** Extracts a number property from props with a default value. */
export const getNumberProp = (props: Props, key: string, defaultValue: number): number => {
    const value = props[key];
    return typeof value === "number" ? value : defaultValue;
};

/** Extracts a string property from props with a default value. */
export const getStringProp = (props: Props, key: string, defaultValue: string): string => {
    const value = props[key];
    return typeof value === "string" ? value : defaultValue;
};
