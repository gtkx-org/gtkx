import { upperFirst } from "./upper-first.js";
import { mapWordSegments } from "./word-segments.js";

/**
 * Converts an underscore- or hyphen-delimited string to camel case.
 *
 * Unlike a general-purpose converter, this splits only on `_` and `-` and keeps the first segment
 * verbatim, so GObject acronyms are preserved (`camelCase("GLArea")` stays `"GLArea"`).
 *
 * @param str - The string to convert.
 * @returns The camel-cased string.
 *
 * @example
 * camelCase("icon_name"); // "iconName"
 * camelCase("start-widget"); // "startWidget"
 * camelCase("Box"); // "Box"
 */
function camelCase(str: string): string {
    return mapWordSegments(str, (part, index) => (index === 0 ? part : upperFirst(part)));
}

export { camelCase };
