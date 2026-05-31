/**
 * Helpers for shaping values into safe JavaScript/TypeScript source fragments:
 * a reserved-word-safe identifier and a source-safe string literal. Both are
 * pure and runtime-agnostic, intended for code generators that emit TypeScript.
 */

/** Reserved words and global identifiers a generated identifier must not collide with. */
const RESERVED: ReadonlySet<string> = new Set([
    "arguments",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "eval",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
]);

/**
 * Rewrites a candidate name into a JavaScript identifier safe to use at
 * variable, parameter, or property position.
 *
 * The input is expected to already use valid identifier characters (for
 * example the output of a case-conversion helper); the only transformation
 * applied is appending an underscore when `name` collides with a reserved
 * word or global identifier, so `toIdentifier("class")` is `"class_"` and
 * `toIdentifier("iconName")` is `"iconName"`.
 *
 * @param name - The candidate identifier.
 * @returns A reserved-word-safe identifier.
 */
export const toIdentifier = (name: string): string => (RESERVED.has(name) ? `${name}_` : name);

const UNSAFE_SOURCE_CHARS = /[<>\u2028\u2029]/g;

const escapeSourceChar = (char: string): string => {
    switch (char) {
        case "<":
            return "\\u003C";
        case ">":
            return "\\u003E";
        case "\u2028":
            return "\\u2028";
        case "\u2029":
            return "\\u2029";
        default:
            return char;
    }
};

/**
 * Quotes a string for safe embedding as a literal in generated TypeScript
 * source.
 *
 * Builds a double-quoted literal with `JSON.stringify`, then escapes the
 * characters that are valid inside a JSON string yet unsafe inside JavaScript
 * source: the angle brackets that could otherwise break out of an enclosing
 * `</script>` and the U+2028/U+2029 line separators that prematurely terminate
 * a string literal. The escaped form parses back to the original value.
 *
 * @param value - The string to embed.
 * @returns A source-safe double-quoted string literal.
 */
export const quote = (value: string): string => JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, escapeSourceChar);
