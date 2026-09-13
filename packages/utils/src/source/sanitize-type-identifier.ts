import { escapeIdentifierStart } from "./escape-identifier-start.ts";
import { escapeReserved } from "./escape-reserved.ts";
import { isReservedIdentifier } from "./sanitize-identifier.ts";

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

const isReservedTypeIdentifier = (name: string): boolean => isReservedIdentifier(name) || TYPE_RESERVED.has(name);

function sanitizeTypeIdentifier(name: string): string {
    return escapeIdentifierStart(escapeReserved(name, isReservedTypeIdentifier));
}

export { sanitizeTypeIdentifier };
