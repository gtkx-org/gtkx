import { camelCase } from "../string/camel-case.js";
import { sanitizeIdentifier } from "./sanitize-identifier.js";

/**
 * Converts a name to camel case and sanitizes it into a valid JavaScript identifier.
 *
 * @param name - The name to convert.
 * @returns The camel-cased, reserved-word-safe identifier.
 *
 * @example
 * toCamelIdentifier("icon_name"); // "iconName"
 * toCamelIdentifier("class"); // "class_"
 */
function toCamelIdentifier(name: string): string {
    return sanitizeIdentifier(camelCase(name));
}

export { toCamelIdentifier };
