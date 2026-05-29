/**
 * Identifier-naming helpers shared across the GIR domain model and the
 * codegen writers.
 *
 * GIR uses snake_case for symbols, kebab-case for properties and signals,
 * and PascalCase for types. The JavaScript surface uses camelCase for
 * members and PascalCase for types — the helpers below codify those
 * conventions and reserve a handful of identifier shapes that would
 * otherwise clash with JavaScript keywords or built-ins.
 */

/** Reserved words and global identifiers we must not collide with. */
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
 * Converts a snake_case or kebab-case string to camelCase.
 *
 * Each underscore- or hyphen-separated segment after the first is
 * Title-cased and joined; leading or trailing separators are stripped.
 *
 * @param input - The snake_case or kebab-case string
 */
export const toCamelCase = (input: string): string => {
    const parts = input.split(/[_-]/g).filter((part) => part.length > 0);
    if (parts.length === 0) return input;
    const [first, ...rest] = parts;
    const head = first ?? "";
    return head + rest.map(titleCase).join("");
};

/**
 * Converts a snake_case, kebab-case, or already-PascalCase string to
 * PascalCase.
 *
 * @param input - The input identifier
 */
export const toPascalCase = (input: string): string => {
    if (input.length === 0) return input;
    const parts = input.split(/[_-]/g).filter((part) => part.length > 0);
    if (parts.length === 0) return input;
    return parts.map(titleCase).join("");
};

const titleCase = (segment: string): string => segment.charAt(0).toUpperCase() + segment.slice(1);

/**
 * Renames an identifier when it would collide with a reserved JavaScript
 * keyword. Currently appends an underscore suffix.
 *
 * @param name - The candidate identifier
 */
export const escapeReserved = (name: string): string => (RESERVED.has(name) ? `${name}_` : name);
