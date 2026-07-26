const RESERVED: Set<string> = new Set([
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
 * Returns the name unchanged, or with a trailing underscore when it collides with a reserved word,
 * so it is safe to emit as a JavaScript identifier.
 *
 * @param name - The candidate identifier.
 * @returns The name, suffixed with `_` when it is a reserved word.
 *
 * @example
 * sanitizeIdentifier("iconName"); // "iconName"
 * sanitizeIdentifier("class"); // "class_"
 */
function sanitizeIdentifier(name: string): string {
    return RESERVED.has(name) ? `${name}_` : name;
}

export { sanitizeIdentifier };
