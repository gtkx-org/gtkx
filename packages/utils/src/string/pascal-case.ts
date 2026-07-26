import { upperFirst } from "./upper-first.js";
import { mapWordSegments } from "./word-segments.js";

/**
 * Converts an underscore- or hyphen-delimited string to Pascal case.
 *
 * Splits only on `_` and `-` and capitalizes each segment's first character, so GObject acronyms
 * are preserved (`pascalCase("GLArea")` stays `"GLArea"`).
 *
 * @param str - The string to convert.
 * @returns The Pascal-cased string.
 *
 * @example
 * pascalCase("icon_name"); // "IconName"
 * pascalCase("scrolled-window"); // "ScrolledWindow"
 */
function pascalCase(str: string): string {
    return mapWordSegments(str, upperFirst);
}

export { pascalCase };
