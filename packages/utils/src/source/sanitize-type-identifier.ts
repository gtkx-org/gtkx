import { sanitizeIdentifier } from "./sanitize-identifier.ts";

const TYPE_RESERVED: Set<string> = new Set([
    "any",
    "bigint",
    "boolean",
    "never",
    "number",
    "object",
    "string",
    "symbol",
    "undefined",
    "unknown",
]);

function sanitizeTypeIdentifier(name: string): string {
    return TYPE_RESERVED.has(name) ? `${name}_` : sanitizeIdentifier(name);
}

export { sanitizeTypeIdentifier };
